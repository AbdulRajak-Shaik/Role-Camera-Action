const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const User = require('../models/User');
const Channel = require('../models/Channel');
const ChannelMembership = require('../models/ChannelMembership');
const CommunityPost = require('../models/CommunityPost');
const Comment = require('../models/Comment');
const { protect } = require('../middleware/auth');
const { attachChannelPermissions, requirePermission } = require('../middleware/rbac');
const { notifySubscribersNewUpload, notifyCommunityPost } = require('../services/notificationService');
const { logAction } = require('../services/auditService');

const router = express.Router({ mergeParams: true });

// Vercel serverless: use memory storage to avoid writing to ephemeral disk.
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

const uploadThumb = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});


router.use(protect);

// Resolve channelId — default to own channel
router.param('channelId', async (req, res, next, id) => {
  req.params.channelId = id === 'me' ? req.user._id.toString() : id;
  next();
});

router.use('/:channelId', attachChannelPermissions);

// Analytics
router.get('/:channelId/analytics', requirePermission('analytics.view'), async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const videos = await Video.find({ uploadedBy: channelId });
    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
    const totalLikes = videos.reduce((s, v) => s + (v.likes?.length || 0), 0);
    const channel = await User.findById(channelId).select('subscriberCount username');
    const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 10);

    res.json({
      success: true,
      analytics: {
        totalViews,
        totalLikes,
        videoCount: videos.length,
        subscribers: channel?.subscriberCount || 0,
        topVideos: topVideos.map(v => ({ _id: v._id, title: v.title, views: v.views, likes: v.likes?.length }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// List all channel videos (including drafts)
router.get('/:channelId/videos', requirePermission('video.edit', 'analytics.view'), async (req, res) => {
  try {
    const videos = await Video.find({ uploadedBy: req.params.channelId })
      .sort({ createdAt: -1 });
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Upload video
router.post('/:channelId/videos', requirePermission('video.upload'), uploadVideo.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No video file' });
    const { title, description, genre, isShort, status } = req.body;
    const video = await Video.create({
      title,
      description: description || '',
      genre: genre || 'drama',
      // Serverless: multer stores in memory; persist file buffers externally.
      filePath: '',

      fileName: req.file.originalname,
      uploadedBy: req.params.channelId,
      channelId: req.params.channelId,
      isShort: isShort === 'true' || isShort === true,
      status: status || 'draft',
      fileSize: req.file.size
    });
    await User.findByIdAndUpdate(req.params.channelId, { $push: { videos: video._id } });
    res.status(201).json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update metadata
router.patch('/:channelId/videos/:videoId', requirePermission('video.metadata.edit'), async (req, res) => {
  try {
    const { title, description, genre, thumbnail } = req.body;
    const video = await Video.findOne({ _id: req.params.videoId, uploadedBy: req.params.channelId });
    if (!video) return res.status(404).json({ success: false, error: 'Video not found' });
    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (genre) video.genre = genre;
    if (thumbnail) video.thumbnail = thumbnail;
    await video.save();
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/videos/:videoId/thumbnail', requirePermission('video.thumbnail.edit'), uploadThumb.single('thumbnail'), async (req, res) => {
  try {
    const video = await Video.findOne({ _id: req.params.videoId, uploadedBy: req.params.channelId });
    if (!video) return res.status(404).json({ success: false, error: 'Not found' });
    if (req.file) {
      // Serverless: multer stores in memory; persist thumbnail buffer externally.
      video.thumbnail = '';

      await video.save();
    }
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Publish
router.post('/:channelId/videos/:videoId/publish', requirePermission('video.publish'), async (req, res) => {
  try {
    const video = await Video.findOne({ _id: req.params.videoId, uploadedBy: req.params.channelId });
    if (!video) return res.status(404).json({ success: false, error: 'Not found' });
    const wasDraft = video.status !== 'published';
    video.status = 'published';
    await video.save();

    if (wasDraft) {
      const owner = await User.findById(req.params.channelId);
      await notifySubscribersNewUpload(req.params.channelId, video, owner);
    }
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/videos/:videoId/unpublish', requirePermission('video.unpublish'), async (req, res) => {
  try {
    const video = await Video.findOneAndUpdate(
      { _id: req.params.videoId, uploadedBy: req.params.channelId },
      { status: 'unpublished' },
      { new: true }
    );
    if (!video) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/:channelId/videos/:videoId', requirePermission('video.delete'), async (req, res) => {
  try {
    const video = await Video.findOneAndDelete({ _id: req.params.videoId, uploadedBy: req.params.channelId });
    if (!video) return res.status(404).json({ success: false, error: 'Not found' });
    await logAction({ actorId: req.user._id, action: 'video.delete', entityType: 'video', entityId: video._id, channelId: req.params.channelId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Community posts
router.get('/:channelId/community', async (req, res) => {
  try {
    const posts = await CommunityPost.find({ channelId: req.params.channelId, published: true })
      .sort({ createdAt: -1 })
      .populate('authorId', 'username avatar');
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/community', requirePermission('community.post'), async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    const post = await CommunityPost.create({
      channelId: req.params.channelId,
      authorId: req.user._id,
      content,
      imageUrl: imageUrl || ''
    });
    const owner = await User.findById(req.params.channelId);
    await notifyCommunityPost(req.params.channelId, post, owner);
    res.status(201).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/:channelId/community/:postId', requirePermission('community.delete'), async (req, res) => {
  try {
    await CommunityPost.findOneAndDelete({ _id: req.params.postId, channelId: req.params.channelId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Comments inbox
router.get('/:channelId/comments', requirePermission('comment.delete'), async (req, res) => {
  try {
    const videos = await Video.find({ uploadedBy: req.params.channelId }).select('_id title');
    const videoIds = videos.map(v => v._id);
    const comments = await Comment.find({ videoId: { $in: videoIds }, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('authorId', 'username avatar')
      .populate('videoId', 'title');
    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Team management
router.get('/:channelId/team', requirePermission('team.invite'), async (req, res) => {
  try {
    const members = await ChannelMembership.find({ channelId: req.params.channelId, status: 'active' })
      .populate('userId', 'username email avatar')
      .populate('invitedBy', 'username');
    res.json({ success: true, members });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/team/invite', requirePermission('team.invite'), async (req, res) => {
  try {
    const { email, role } = req.body;
    const allowed = ['manager', 'editor', 'viewer', 'managing_moderator', 'standard_moderator'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, error: 'User not found. They must register first.' });

    const membership = await ChannelMembership.findOneAndUpdate(
      { channelId: req.params.channelId, userId: user._id },
      { role, status: 'active', invitedBy: req.user._id },
      { upsert: true, new: true }
    );

    const { createNotification } = require('../services/notificationService');
    await createNotification({
      recipientId: user._id,
      type: 'team_invite',
      title: 'Channel team invitation',
      body: `You were added as ${role} on a channel`,
      actionUrl: '/studio',
      channelId: req.params.channelId,
      actorId: req.user._id
    });

    res.json({ success: true, membership });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/:channelId/team/:userId', requirePermission('team.remove'), async (req, res) => {
  try {
    await ChannelMembership.findOneAndDelete({
      channelId: req.params.channelId,
      userId: req.params.userId
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Channel settings
router.get('/:channelId/settings', async (req, res) => {
  try {
    let channel = await Channel.findOne({ ownerId: req.params.channelId });
    if (!channel) {
      const owner = await User.findById(req.params.channelId);
      channel = await Channel.create({ ownerId: req.params.channelId, name: owner?.username });
    }
    res.json({ success: true, channel });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
