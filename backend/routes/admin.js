const express = require('express');
const User = require('../models/User');
const Video = require('../models/Video');
const Channel = require('../models/Channel');
const ChannelMembership = require('../models/ChannelMembership');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');
const { requirePlatformAdmin } = require('../middleware/rbac');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

router.use(protect, requirePlatformAdmin);

router.get('/stats', async (req, res) => {
  try {
    const [users, videos, channels] = await Promise.all([
      User.countDocuments(),
      Video.countDocuments(),
      Channel.countDocuments()
    ]);
    const published = await Video.countDocuments({ status: 'published' });
    const totalViews = await Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]);
    res.json({
      success: true,
      stats: {
        users,
        videos,
        publishedVideos: published,
        channels,
        totalViews: totalViews[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const query = search
      ? { $or: [{ username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};
    const users = await User.find(query).select('username email platformRole isBanned subscriberCount createdAt').limit(50).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: !!banned }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/users/:id/platform-role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'platform_admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { platformRole: role }, { new: true });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find().populate('uploadedBy', 'username').sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/videos/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const video = await Video.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/channels/:ownerId/suspend', async (req, res) => {
  try {
    const { suspended } = req.body;
    const channel = await Channel.findOneAndUpdate(
      { ownerId: req.params.ownerId },
      { suspended: !!suspended },
      { upsert: true, new: true }
    );
    res.json({ success: true, channel });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/channels/:channelId/moderators', async (req, res) => {
  try {
    const { userId, role } = req.body;
    const r = role === 'managing_moderator' ? 'managing_moderator' : 'standard_moderator';
    const membership = await ChannelMembership.findOneAndUpdate(
      { channelId: req.params.channelId, userId },
      { role: r, status: 'active', invitedBy: req.user._id },
      { upsert: true, new: true }
    );
    res.json({ success: true, membership });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actorId', 'username');
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/announce', async (req, res) => {
  try {
    const { title, body } = req.body;
    const admins = await User.find({ platformRole: 'platform_admin' });
    await Promise.all(admins.map(a =>
      createNotification({
        recipientId: a._id,
        type: 'platform_alert',
        title: title || 'Platform announcement',
        body: body || '',
        actionUrl: '/admin'
      })
    ));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
