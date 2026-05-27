const mongoose = require('mongoose');

const liveStreamSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['live', 'ended'], default: 'live' },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('LiveStream', liveStreamSchema);
