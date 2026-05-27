const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notifications: {
    uploads: { type: Boolean, default: true },
    community: { type: Boolean, default: false },
    live: { type: Boolean, default: false }
  }
}, { timestamps: true });

subscriptionSchema.index({ subscriberId: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
