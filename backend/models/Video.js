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
  videoData: { type: Buffer, required: true },
  videoContentType: { type: String, required: true },
  thumbnailData: { type: Buffer, required: true },
  thumbnailContentType: { type: String, required: true },
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

// Virtual for video URL
videoSchema.virtual('videoUrl').get(function() {
  return `/api/uploads/${this._id}/video`;
});

// Virtual for thumbnail URL
videoSchema.virtual('thumbnailUrl').get(function() {
  return `/api/uploads/${this._id}/thumbnail`;
});

// Ensure virtuals are included when converting to JSON
videoSchema.set('toJSON', { virtuals: true });
videoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Video', videoSchema);
