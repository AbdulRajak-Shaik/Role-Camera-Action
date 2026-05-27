const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, trim: true },
  description: { type: String, default: '', maxlength: 1000 },
  avatar: { type: String, default: '' },
  suspended: { type: Boolean, default: false },
  chatSettings: {
    enabled: { type: Boolean, default: true },
    mode: { type: String, enum: ['everyone', 'subscribers', 'members'], default: 'everyone' },
    delaySeconds: { type: Number, default: 0, min: 0, max: 300 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);
