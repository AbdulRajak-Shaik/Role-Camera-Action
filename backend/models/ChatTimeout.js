const mongoose = require('mongoose');

const chatTimeoutSchema = new mongoose.Schema({
  streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveStream', required: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

chatTimeoutSchema.index({ streamId: 1, userId: 1 });

module.exports = mongoose.model('ChatTimeout', chatTimeoutSchema);
