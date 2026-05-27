const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const query = { recipientId: req.user._id };
    if (unreadOnly === 'true') query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('actorId', 'username avatar');

    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/unread-count', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('unreadNotificationCount');
    const count = user?.unreadNotificationCount ?? 0;
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    await User.findByIdAndUpdate(req.user._id, { unreadNotificationCount: 0 });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, recipientId: req.user._id });
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    if (!n.read) {
      n.read = true;
      n.readAt = new Date();
      await n.save();
      await User.findByIdAndUpdate(req.user._id, { $inc: { unreadNotificationCount: -1 } });
    }
    res.json({ success: true, notification: n });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
