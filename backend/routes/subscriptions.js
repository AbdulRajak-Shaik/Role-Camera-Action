const express = require('express');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const subs = await Subscription.find({ subscriberId: req.user._id })
      .populate('channelId', 'username avatar subscriberCount');
    res.json({
      success: true,
      subscriptions: subs.map(s => ({
        channel: s.channelId,
        notifications: s.notifications,
        subscribedAt: s.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/:channelId/status', protect, async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      subscriberId: req.user._id,
      channelId: req.params.channelId
    });
    res.json({
      success: true,
      subscribed: !!sub,
      notifications: sub?.notifications || { uploads: true, community: false, live: false }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/:channelId/notifications', protect, async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      subscriberId: req.user._id,
      channelId: req.params.channelId
    });
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Not subscribed to this channel' });
    }
    const { uploads, community, live } = req.body;
    if (uploads !== undefined) sub.notifications.uploads = !!uploads;
    if (community !== undefined) sub.notifications.community = !!community;
    if (live !== undefined) sub.notifications.live = !!live;
    await sub.save();
    res.json({ success: true, notifications: sub.notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
