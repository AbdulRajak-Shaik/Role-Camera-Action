const express = require('express');
const User = require('../models/User');
const Video = require('../models/Video');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/me/subscriptions', protect, async (req, res) => {
  try {
    const subs = await Subscription.find({ subscriberId: req.user._id })
      .populate('channelId', 'username avatar subscriberCount');
    res.json({
      success: true,
      channels: subs.map(s => ({
        ...s.channelId.toObject(),
        notifications: s.notifications
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/:id/subscribe', protect, async (req, res) => {
  try {
    const channelId = req.params.id;
    if (channelId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot subscribe to yourself' });
    }

    const channel = await User.findById(channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    const existing = await Subscription.findOne({ subscriberId: req.user._id, channelId });
    let subscribed;
    let notifications = { uploads: true, community: false, live: false };

    if (existing) {
      await Subscription.deleteOne({ _id: existing._id });
      channel.subscriberCount = Math.max(0, channel.subscriberCount - 1);
      await User.findByIdAndUpdate(req.user._id, { $pull: { subscriptions: channel._id } });
      subscribed = false;
    } else {
      const sub = await Subscription.create({
        subscriberId: req.user._id,
        channelId: channel._id,
        notifications: { uploads: true, community: false, live: false }
      });
      notifications = sub.notifications;
      channel.subscriberCount += 1;
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { subscriptions: channel._id } });
      subscribed = true;
    }

    await channel.save();

    res.json({ success: true, subscribed, subscriberCount: channel.subscriberCount, notifications });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/:id/videos', async (req, res) => {
  try {
    const videos = await Video.find({ uploadedBy: req.params.id, status: 'published' })
      .populate('uploadedBy', 'username avatar subscriberCount')
      .sort({ createdAt: -1 });
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username avatar subscriberCount createdAt');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const videoCount = await Video.countDocuments({ uploadedBy: user._id, status: 'published' });

    let isSubscribed = false;
    let notifications = null;
    if (req.headers.authorization?.startsWith('Bearer')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
        const sub = await Subscription.findOne({ subscriberId: decoded.userId, channelId: user._id });
        isSubscribed = !!sub;
        notifications = sub?.notifications || null;
      } catch (_) { /* optional */ }
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        subscriberCount: user.subscriberCount,
        videoCount,
        createdAt: user.createdAt
      },
      isSubscribed,
      notifications
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
