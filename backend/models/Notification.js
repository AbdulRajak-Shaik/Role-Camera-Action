const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'new_comment', 'comment_reply', 'new_like', 'new_subscriber',
      'new_upload', 'community_post', 'moderator_action', 'team_invite',
      'platform_alert', 'subscription_digest'
    ],
    required: true
  },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  read: { type: Boolean, default: false },
  readAt: Date,
  actionUrl: { type: String, default: '' },
  entityType: { type: String, default: '' },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  groupKey: { type: String, sparse: true }
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
