const AuditLog = require('../models/AuditLog');

async function logAction({ actorId, action, entityType = '', entityId = null, channelId = null, metadata = {} }) {
  try {
    await AuditLog.create({ actorId, action, entityType, entityId, channelId, metadata });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { logAction };
