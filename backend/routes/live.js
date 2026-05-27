const express = require('express');
const LiveStream = require('../models/LiveStream');
const ChatMessage = require('../models/ChatMessage');
const ChatTimeout = require('../models/ChatTimeout');
const BlockedChatWord = require('../models/BlockedChatWord');
const HiddenChannelUser = require('../models/HiddenChannelUser');
const Channel = require('../models/Channel');
const Subscription = require('../models/Subscription');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/active', async (req, res) => {
  try {
    const streams = await LiveStream.find({ status: 'live' })
      .populate('channelId', 'username avatar')
      .sort({ startedAt: -1 });
    res.json({ success: true, streams });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/start', protect, async (req, res) => {
  try {
    const { title } = req.body;
    const existing = await LiveStream.findOne({ channelId: req.user._id, status: 'live' });
    if (existing) return res.json({ success: true, stream: existing });

    const stream = await LiveStream.create({
      channelId: req.user._id,
      title: title || `${req.user.username} is live`
    });
    res.status(201).json({ success: true, stream });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:streamId/end', protect, async (req, res) => {
  try {
    const stream = await LiveStream.findOneAndUpdate(
      { _id: req.params.streamId, channelId: req.user._id, status: 'live' },
      { status: 'ended', endedAt: new Date() },
      { new: true }
    );
    if (!stream) return res.status(404).json({ success: false, error: 'Stream not found' });
    res.json({ success: true, stream });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/:streamId/chat', optionalAuth, async (req, res) => {
  try {
    const stream = await LiveStream.findById(req.params.streamId);
    if (!stream) return res.status(404).json({ success: false, error: 'Stream not found' });

    const hidden = await HiddenChannelUser.find({ channelId: stream.channelId }).select('userId');
    const hiddenIds = hidden.map(h => h.userId.toString());

    const messages = await ChatMessage.find({
      streamId: stream._id,
      deletedAt: null,
      authorId: { $nin: hiddenIds }
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('authorId', 'username avatar');

    res.json({ success: true, messages: messages.reverse(), chatSettings: (await Channel.findOne({ ownerId: stream.channelId }))?.chatSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:streamId/chat', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const stream = await LiveStream.findById(req.params.streamId);
    if (!stream || stream.status !== 'live') {
      return res.status(400).json({ success: false, error: 'Stream not live' });
    }

    const channel = await Channel.findOne({ ownerId: stream.channelId });
    if (channel && !channel.chatSettings.enabled) {
      return res.status(403).json({ success: false, error: 'Chat is disabled' });
    }

    const timeout = await ChatTimeout.findOne({
      streamId: stream._id,
      userId: req.user._id,
      expiresAt: { $gt: new Date() }
    });
    if (timeout) return res.status(403).json({ success: false, error: 'You are timed out' });

    const blocked = await BlockedChatWord.find({ channelId: stream.channelId });
    const lower = text.toLowerCase();
    if (blocked.some(b => lower.includes(b.phrase))) {
      return res.status(400).json({ success: false, error: 'Message contains blocked content' });
    }

    if (channel?.chatSettings?.mode === 'subscribers') {
      const sub = await Subscription.findOne({ subscriberId: req.user._id, channelId: stream.channelId });
      if (!sub && stream.channelId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Subscribers only chat' });
      }
    }

    const message = await ChatMessage.create({
      streamId: stream._id,
      channelId: stream.channelId,
      authorId: req.user._id,
      text: text.trim()
    });

    const populated = await ChatMessage.findById(message._id).populate('authorId', 'username avatar');
    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
