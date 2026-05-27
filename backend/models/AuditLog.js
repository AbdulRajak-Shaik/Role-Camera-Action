const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  entityType: { type: String, default: '' },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

auditLogSchema.index({ channelId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
