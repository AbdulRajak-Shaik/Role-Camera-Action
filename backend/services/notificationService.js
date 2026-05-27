const Notification = require('../models/Notification');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

async function shouldNotifyUser(userId, type) {
  const user = await User.findById(userId).select('notificationPreferences');
  if (!user) return false;
  const prefs = user.notificationPreferences || {};
  if (prefs.inApp?.enabled === false) return false;
  if (prefs.types && prefs.types[type] === false) return false;
  return true;
}

async function createNotification({
  recipientId,
  type,
  title,
  body,
  actionUrl = '',
  entityType = '',
  entityId = null,
  actorId = null,
  channelId = null,
  metadata = {},
  groupKey = null
}) {
  if (!recipientId) return null;
  if (!(await shouldNotifyUser(recipientId, type))) return null;

  if (groupKey) {
    const existing = await Notification.findOne({
      recipientId,
      groupKey,
      read: false,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    if (existing) {
      existing.body = body;
      existing.title = title;
      existing.metadata = { ...existing.metadata, ...metadata };
      await existing.save();
      return existing;
    }
  }

  const notification = await Notification.create({
    recipientId,
    type,
    title,
    body,
    actionUrl,
    entityType,
    entityId,
    actorId,
    channelId,
    metadata,
    groupKey
  });

  await User.findByIdAndUpdate(recipientId, { $inc: { unreadNotificationCount: 1 } });
  return notification;
}

async function notifySubscribersNewUpload(channelOwnerId, video, actor) {
  const subs = await Subscription.find({
    channelId: channelOwnerId,
    'notifications.uploads': true
  }).select('subscriberId');

  const title = `${actor.username} uploaded: ${video.title}`;
  const body = video.description?.slice(0, 120) || 'New video available';
  const actionUrl = `/?v=${video._id}`;

  await Promise.all(subs.map(sub =>
    createNotification({
      recipientId: sub.subscriberId,
      type: 'new_upload',
      title,
      body,
      actionUrl,
      entityType: 'video',
      entityId: video._id,
      actorId: actor._id,
      channelId: channelOwnerId
    })
  ));
}

async function notifyCommunityPost(channelOwnerId, post, actor) {
  const subs = await Subscription.find({
    channelId: channelOwnerId,
    'notifications.community': true
  }).select('subscriberId');

  await Promise.all(subs.map(sub =>
    createNotification({
      recipientId: sub.subscriberId,
      type: 'community_post',
      title: `${actor.username} posted in Community`,
      body: post.content?.slice(0, 120) || 'New community update',
      actionUrl: '/studio#community',
      entityType: 'community_post',
      entityId: post._id,
      actorId: actor._id,
      channelId: channelOwnerId
    })
  ));
}

module.exports = {
  createNotification,
  notifySubscribersNewUpload,
  notifyCommunityPost,
  shouldNotifyUser
};
