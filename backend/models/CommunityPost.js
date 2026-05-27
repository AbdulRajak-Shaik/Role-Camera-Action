const mongoose = require('mongoose');

const communityPostSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 5000 },
  imageUrl: { type: String, default: '' },
  published: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CommunityPost', communityPostSchema);
