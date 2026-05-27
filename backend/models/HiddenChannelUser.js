const mongoose = require('mongoose');

const hiddenChannelUserSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

hiddenChannelUserSchema.index({ channelId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('HiddenChannelUser', hiddenChannelUserSchema);
