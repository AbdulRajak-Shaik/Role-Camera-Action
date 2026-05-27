const mongoose = require('mongoose');

const blockedChatWordSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phrase: { type: String, required: true, trim: true, lowercase: true }
}, { timestamps: true });

blockedChatWordSchema.index({ channelId: 1, phrase: 1 }, { unique: true });

module.exports = mongoose.model('BlockedChatWord', blockedChatWordSchema);
