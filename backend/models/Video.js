const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  filePath: { type: String, required: [true, 'Video file path is required'] },
  fileName: { type: String, required: true },
  thumbnail: { type: String, default: '' },
  duration: { type: String, default: '0:00' },
  genre: {
    type: String,
    enum: ['all', 'drama', 'comedy', 'action', 'romance', 'horror', 'documentary', 'auditions'],
    default: 'drama'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'unpublished'],
    default: 'published'
  },
  isShort: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileSize: { type: Number, default: 0 }
}, { timestamps: true });

videoSchema.index({ genre: 1, createdAt: -1 });
videoSchema.index({ status: 1, createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Video', videoSchema);
