const mongoose = require('mongoose');

const channelMembershipSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['manager', 'editor', 'viewer', 'managing_moderator', 'standard_moderator'],
    required: true
  },
  permissions: [{ type: String }],
  status: { type: String, enum: ['active', 'pending'], default: 'active' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

channelMembershipSchema.index({ channelId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ChannelMembership', channelMembershipSchema);
