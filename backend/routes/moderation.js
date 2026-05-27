const express = require('express');
const Comment = require('../models/Comment');
const HiddenChannelUser = require('../models/HiddenChannelUser');
const BlockedChatWord = require('../models/BlockedChatWord');
const Channel = require('../models/Channel');
const ChatMessage = require('../models/ChatMessage');
const ChatTimeout = require('../models/ChatTimeout');
const LiveStream = require('../models/LiveStream');
const ChannelMembership = require('../models/ChannelMembership');
const { protect } = require('../middleware/auth');
const { attachChannelPermissions, requirePermission } = require('../middleware/rbac');
const { logAction } = require('../services/auditService');
const { createNotification } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });

router.use(protect);
router.use('/:channelId', attachChannelPermissions);

// Hidden users
router.get('/:channelId/hidden-users', requirePermission('chat.user.hide'), async (req, res) => {
  try {
    const hidden = await HiddenChannelUser.find({ channelId: req.params.channelId })
      .populate('userId', 'username avatar');
    res.json({ success: true, hidden });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/hidden-users', requirePermission('chat.user.hide'), async (req, res) => {
  try {
    const { userId } = req.body;
    const hidden = await HiddenChannelUser.findOneAndUpdate(
      { channelId: req.params.channelId, userId },
      { hiddenBy: req.user._id },
      { upsert: true, new: true }
    );
    await logAction({ actorId: req.user._id, action: 'user.hide', channelId: req.params.channelId, entityId: userId });
    await createNotification({
      recipientId: userId,
      type: 'moderator_action',
      title: 'Hidden from channel',
      body: 'You have been hidden from this channel\'s comments and chat.',
      channelId: req.params.channelId,
      actorId: req.user._id,
      metadata: { action: 'user_hidden' }
    });
    res.json({ success: true, hidden });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/:channelId/hidden-users/:userId', requirePermission('chat.user.hide'), async (req, res) => {
  try {
    await HiddenChannelUser.findOneAndDelete({ channelId: req.params.channelId, userId: req.params.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Blocked words
router.get('/:channelId/blocked-words', requirePermission('chat.blocked_words.edit'), async (req, res) => {
  try {
    const words = await BlockedChatWord.find({ channelId: req.params.channelId });
    res.json({ success: true, words });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/blocked-words', requirePermission('chat.blocked_words.edit'), async (req, res) => {
  try {
    const { phrase } = req.body;
    const word = await BlockedChatWord.create({ channelId: req.params.channelId, phrase: phrase.toLowerCase() });
    res.status(201).json({ success: true, word });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.delete('/:channelId/blocked-words/:id', requirePermission('chat.blocked_words.edit'), async (req, res) => {
  try {
    await BlockedChatWord.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Chat settings
router.patch('/:channelId/chat-settings', requirePermission('chat.settings.edit'), async (req, res) => {
  try {
    const { enabled, mode, delaySeconds } = req.body;
    let channel = await Channel.findOne({ ownerId: req.params.channelId });
    if (!channel) channel = await Channel.create({ ownerId: req.params.channelId });
    if (enabled !== undefined) channel.chatSettings.enabled = !!enabled;
    if (mode) channel.chatSettings.mode = mode;
    if (delaySeconds !== undefined) channel.chatSettings.delaySeconds = Math.min(300, Math.max(0, delaySeconds));
    await channel.save();
    res.json({ success: true, chatSettings: channel.chatSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Live chat moderation
router.delete('/:channelId/live/:streamId/chat/:messageId', requirePermission('chat.message.delete'), async (req, res) => {
  try {
    const msg = await ChatMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ success: false, error: 'Not found' });
    msg.deletedAt = new Date();
    msg.deletedBy = req.user._id;
    await msg.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/live/:streamId/timeout', requirePermission('chat.user.timeout'), async (req, res) => {
  try {
    const { userId, durationSeconds } = req.body;
    const sec = Math.min(86400, Math.max(10, Number(durationSeconds) || 600));
    const timeout = await ChatTimeout.create({
      streamId: req.params.streamId,
      channelId: req.params.channelId,
      userId,
      expiresAt: new Date(Date.now() + sec * 1000),
      issuedBy: req.user._id
    });
    await logAction({ actorId: req.user._id, action: 'chat.timeout', channelId: req.params.channelId, metadata: { userId, durationSeconds: sec } });
    res.json({ success: true, timeout });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Mod roster for live chat
router.get('/:channelId/live-moderators', requirePermission('chat.moderator.assign'), async (req, res) => {
  try {
    const mods = await ChannelMembership.find({
      channelId: req.params.channelId,
      role: { $in: ['standard_moderator', 'managing_moderator'] },
      status: 'active'
    }).populate('userId', 'username avatar');
    res.json({ success: true, moderators: mods });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/:channelId/live-moderators', requirePermission('chat.moderator.assign'), async (req, res) => {
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

// Dashboard summary for mod console
router.get('/:channelId/dashboard', async (req, res) => {
  try {
    const perms = req.channelPermissions || [];
    const canMod = perms.some(p => p.includes('comment') || p.includes('chat'));
    if (!canMod && req.user.platformRole !== 'platform_admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const activeStream = await LiveStream.findOne({ channelId: req.params.channelId, status: 'live' });
    const recentComments = await Comment.find({ channelId: req.params.channelId, deletedAt: null })
      .sort({ createdAt: -1 }).limit(20)
      .populate('authorId', 'username')
      .populate('videoId', 'title');
    res.json({ success: true, activeStream, recentComments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
