const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveStream', required: true, index: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 500 },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
