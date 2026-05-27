const ChannelMembership = require('../models/ChannelMembership');
const { hasPermission, resolveChannelPermissions } = require('../utils/permissions');

async function attachChannelPermissions(req, res, next) {
  try {
    const channelId = req.params.channelId || req.body.channelId || req.query.channelId;
    req.channelId = channelId;
    req.channelPermissions = [];

    if (!req.user) return next();

    if (req.user.platformRole === 'platform_admin') {
      req.channelPermissions = require('../utils/permissions').getRolePermissions('platform_admin');
      return next();
    }

    if (channelId) {
      req.channelPermissions = await resolveChannelPermissions(
        req.user._id,
        channelId,
        ChannelMembership
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(...required) {
  return (req, res, next) => {
    if (req.user?.platformRole === 'platform_admin') return next();
    const perms = req.channelPermissions || [];
    const allowed = required.some(r => hasPermission(perms, r));
    if (allowed) return next();
    return res.status(403).json({ success: false, error: 'Forbidden: insufficient permissions' });
  };
}

function requirePlatformAdmin(req, res, next) {
  if (req.user?.platformRole === 'platform_admin') return next();
  return res.status(403).json({ success: false, error: 'Platform admin access required' });
}

module.exports = { attachChannelPermissions, requirePermission, requirePlatformAdmin };
