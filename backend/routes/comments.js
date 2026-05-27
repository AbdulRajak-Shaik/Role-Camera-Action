const express = require('express');
const Comment = require('../models/Comment');
const Video = require('../models/Video');
const HiddenChannelUser = require('../models/HiddenChannelUser');
const { protect, optionalAuth } = require('../middleware/auth');
const { attachChannelPermissions, requirePermission } = require('../middleware/rbac');
const { createNotification } = require('../services/notificationService');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/video/:videoId', optionalAuth, async (req, res) => {
  try {
    const hiddenIds = [];
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ success: false, error: 'Video not found' });

    if (video.channelId || video.uploadedBy) {
      const hidden = await HiddenChannelUser.find({ channelId: video.uploadedBy }).select('userId');
      hiddenIds.push(...hidden.map(h => h.userId.toString()));
    }

    const comments = await Comment.find({
      videoId: req.params.videoId,
      deletedAt: null,
      hidden: false,
      authorId: { $nin: hiddenIds }
    })
      .sort({ pinned: -1, createdAt: -1 })
      .populate('authorId', 'username avatar')
      .limit(100);

    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/video/:videoId', protect, async (req, res) => {
  try {
    const { text, parentId } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, error: 'Comment text required' });

    const video = await Video.findById(req.params.videoId).populate('uploadedBy', 'username');
    if (!video) return res.status(404).json({ success: false, error: 'Video not found' });

    const comment = await Comment.create({
      videoId: video._id,
      authorId: req.user._id,
      channelId: video.uploadedBy._id,
      text: text.trim(),
      parentId: parentId || null
    });

    const populated = await Comment.findById(comment._id).populate('authorId', 'username avatar');

    if (video.uploadedBy._id.toString() !== req.user._id.toString()) {
      await createNotification({
        recipientId: video.uploadedBy._id,
        type: parentId ? 'comment_reply' : 'new_comment',
        title: parentId ? 'New reply on your video' : 'New comment on your video',
        body: `${req.user.username}: ${text.trim().slice(0, 80)}`,
        actionUrl: `/?v=${video._id}`,
        entityType: 'comment',
        entityId: comment._id,
        actorId: req.user._id,
        channelId: video.uploadedBy._id
      });
    }

    res.status(201).json({ success: true, comment: populated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/:id', protect, attachChannelPermissions, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });

    req.channelId = comment.channelId.toString();
    req.channelPermissions = await require('../utils/permissions').resolveChannelPermissions(
      req.user._id,
      comment.channelId,
      require('../models/ChannelMembership')
    );
    if (req.user.platformRole !== 'platform_admin' &&
        !require('../utils/permissions').hasPermission(req.channelPermissions, 'comment.delete') &&
        comment.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    comment.deletedAt = new Date();
    comment.deletedBy = req.user._id;
    await comment.save();

    await logAction({
      actorId: req.user._id,
      action: 'comment.delete',
      entityType: 'comment',
      entityId: comment._id,
      channelId: comment.channelId
    });

    if (comment.authorId.toString() !== req.user._id.toString()) {
      await createNotification({
        recipientId: comment.authorId,
        type: 'moderator_action',
        title: 'Comment removed by moderator',
        body: 'Your comment was removed from a video.',
        actionUrl: `/?v=${comment.videoId}`,
        entityType: 'comment',
        entityId: comment._id,
        actorId: req.user._id,
        channelId: comment.channelId,
        metadata: { action: 'comment_removed' }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/:id/hide', protect, attachChannelPermissions, requirePermission('comment.hide'), async (req, res) => {
  try {
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { hidden: true },
      { new: true }
    );
    if (!comment) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/:id/pin', protect, attachChannelPermissions, requirePermission('comment.pin'), async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, error: 'Not found' });
    await Comment.updateMany({ videoId: comment.videoId }, { pinned: false });
    comment.pinned = true;
    await comment.save();
    res.json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
