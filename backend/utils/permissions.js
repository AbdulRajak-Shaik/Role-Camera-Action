const ROLE_PERMISSIONS = {
  owner: [
    'video.upload', 'video.edit', 'video.delete', 'video.publish', 'video.unpublish',
    'video.metadata.edit', 'video.thumbnail.edit', 'short.create', 'short.delete',
    'analytics.view', 'analytics.export', 'community.post', 'community.edit', 'community.delete',
    'comment.delete', 'comment.hide', 'comment.pin',
    'chat.message.delete', 'chat.user.timeout', 'chat.user.hide',
    'chat.settings.edit', 'chat.mode.edit', 'chat.delay.edit', 'chat.blocked_words.edit', 'chat.moderator.assign',
    'team.invite', 'team.remove', 'team.role.assign', 'channel.delete'
  ],
  manager: [
    'video.upload', 'video.edit', 'video.delete', 'video.publish', 'video.unpublish',
    'video.metadata.edit', 'video.thumbnail.edit', 'short.create', 'short.delete',
    'analytics.view', 'analytics.export', 'community.post', 'community.edit', 'community.delete',
    'comment.delete', 'comment.hide', 'comment.pin',
    'chat.message.delete', 'chat.user.timeout', 'chat.user.hide',
    'chat.settings.edit', 'chat.mode.edit', 'chat.delay.edit', 'chat.blocked_words.edit', 'chat.moderator.assign',
    'team.invite', 'team.remove', 'team.role.assign'
  ],
  editor: [
    'video.upload', 'video.edit', 'video.metadata.edit', 'video.thumbnail.edit', 'video.publish', 'short.create'
  ],
  viewer: ['analytics.view'],
  managing_moderator: [
    'comment.delete', 'comment.hide',
    'chat.message.delete', 'chat.user.timeout', 'chat.user.hide',
    'chat.settings.edit', 'chat.mode.edit', 'chat.delay.edit', 'chat.blocked_words.edit', 'chat.moderator.assign'
  ],
  standard_moderator: [
    'comment.delete', 'chat.message.delete', 'chat.user.timeout', 'chat.user.hide'
  ],
  platform_admin: ['platform.*', 'video.*', 'short.*', 'analytics.*', 'community.*', 'comment.*', 'chat.*', 'team.*']
};

function matchPermission(have, need) {
  if (have.includes(need)) return true;
  const [ns] = need.split('.');
  return have.includes(`${ns}.*`) || have.includes('platform.*');
}

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(permissionList, required) {
  if (!permissionList?.length) return false;
  if (Array.isArray(required)) {
    return required.some(p => hasPermission(permissionList, p));
  }
  return permissionList.some(p => matchPermission([p], required) || p === required || matchPermission(permissionList, required));
}

async function resolveChannelPermissions(userId, channelOwnerId, ChannelMembership) {
  if (!userId || !channelOwnerId) return [];
  if (userId.toString() === channelOwnerId.toString()) {
    return getRolePermissions('owner');
  }
  const membership = await ChannelMembership.findOne({
    channelId: channelOwnerId,
    userId,
    status: 'active'
  });
  if (!membership) return [];
  if (membership.permissions?.length) return membership.permissions;
  return getRolePermissions(membership.role);
}

module.exports = {
  ROLE_PERMISSIONS,
  getRolePermissions,
  hasPermission,
  resolveChannelPermissions
};
