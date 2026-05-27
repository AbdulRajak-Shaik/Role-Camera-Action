# Role Camera Action! — Admin, Roles & Notifications Specification

**Version:** 1.0  
**Stack alignment:** Express + MongoDB + JWT (existing `backend/`), vanilla JS frontend (`index.html`, `app.js`)  
**Purpose:** Actionable spec for UI/UX, backend logic, RBAC, and a scalable notification system.

---

## 1. Role Model Overview

### 1.1 Role hierarchy

```
Platform Admin (Super Admin)
    └── Channel Owner (Creator) — owns one primary channel
            └── Team Members (channel-scoped)
                    ├── Manager (Admin on channel)
                    ├── Editor
                    ├── Viewer
                    └── Moderators (channel-scoped)
                            ├── Managing Moderator
                            └── Standard Moderator
Regular User — viewer, can subscribe, comment (when enabled)
```

| Role | Scope | Dashboard access | Upload videos | Analytics | Community | Team mgmt | Live chat mod |
|------|-------|------------------|---------------|-----------|-----------|-----------|---------------|
| **Platform Admin** | Entire site | Platform Admin Dashboard | All channels (override) | Global + per-channel | All | Assign platform moderators, ban users | Yes (global) |
| **Channel Owner** | Own channel | Creator Studio | Yes | Own channel | Own channel | Invite team | Via moderators |
| **Manager** (Channel Admin) | Assigned channel | Channel Admin Dashboard | Yes | Yes | Yes | Yes (except delete channel) | Yes |
| **Editor** | Assigned channel | Limited Studio | Yes (draft/publish per policy) | No | Draft only | No | No |
| **Viewer** | Assigned channel | Read-only Studio | No | View only | No | No | No |
| **Managing Moderator** | Assigned channel | Moderation Console | No | No | No | Mod team on live chat | Full + mod roster |
| **Standard Moderator** | Assigned channel | Moderation Console | No | No | No | No | Comments + basic chat |
| **Regular User** | Self | User home | Own channel only | Own uploads only | N/A | N/A | N/A |

**Invariant:** No role except **Platform Admin** (optional policy) or **Channel Owner** can delete the **primary channel** entity.

---

## 2. Authentication & Admin Entry Points

### 2.1 Login surfaces

| Surface | URL (suggested) | Audience |
|---------|-----------------|----------|
| Public site | `/` | Everyone |
| Creator Studio | `/studio` | Channel owners, Managers, Editors |
| Moderation Console | `/mod` | Standard + Managing Moderators |
| Platform Admin | `/admin` | Platform Admin only |

### 2.2 Admin login flow (Platform Admin)

```
[User opens /admin]
    → Email/password OR Google (existing auth)
    → Backend validates credentials
    → Backend checks user.platformRole === 'platform_admin'
    → If yes: issue JWT with claims { platformRole, permissions[] }
    → Redirect to Platform Admin Dashboard
    → If no: 403 "Not authorized for admin access"
```

### 2.3 Channel team login flow

```
[User opens /studio or /mod]
    → Standard login (existing /api/auth)
    → Backend loads ChannelMembership for user + channelId
    → JWT includes channelRoles: [{ channelId, role, permissions[] }]
    → Route guard renders dashboard by highest role
```

---

## 3. Permission System (RBAC)

### 3.1 Permission keys (granular)

Use string permissions checked on every protected API route.

**Video & content**
- `video.upload`, `video.edit`, `video.delete`, `video.publish`, `video.unpublish`
- `video.metadata.edit`, `video.thumbnail.edit`
- `short.create`, `short.delete`

**Analytics**
- `analytics.view`, `analytics.export`

**Community**
- `community.post`, `community.edit`, `community.delete`

**Comments & chat**
- `comment.delete`, `comment.hide`, `comment.pin`
- `chat.message.delete`, `chat.user.timeout`, `chat.user.hide`
- `chat.settings.edit`, `chat.mode.edit`, `chat.delay.edit`, `chat.blocked_words.edit`
- `chat.moderator.assign` (Managing Moderator only)

**Team**
- `team.invite`, `team.remove`, `team.role.assign`
- `channel.delete` — **only** `channel.owner` or explicit deny for all others

**Platform (Platform Admin only)**
- `platform.user.ban`, `platform.channel.suspend`, `platform.moderator.assign`

### 3.2 Default permission maps

**Manager (Channel Admin)** — all except `channel.delete`:

```json
[
  "video.*", "short.*", "analytics.*", "community.*",
  "comment.*", "chat.*", "team.invite", "team.remove", "team.role.assign"
]
```

**Editor:**

```json
["video.upload", "video.edit", "video.metadata.edit", "video.thumbnail.edit", "video.publish"]
```

**Viewer:**

```json
["analytics.view"]
```

**Managing Moderator:**

```json
[
  "comment.delete", "comment.hide",
  "chat.message.delete", "chat.user.timeout", "chat.user.hide",
  "chat.settings.edit", "chat.mode.edit", "chat.delay.edit", "chat.blocked_words.edit",
  "chat.moderator.assign"
]
```

**Standard Moderator:**

```json
[
  "comment.delete", "chat.message.delete",
  "chat.user.timeout", "chat.user.hide"
]
```

### 3.3 Enforcement pattern (backend)

```javascript
// middleware/requirePermission.js
function requirePermission(...required) {
  return (req, res, next) => {
    const perms = resolvePermissions(req.user, req.params.channelId);
    if (required.some(p => perms.includes(p) || perms.includes(wildcard(p))))
      return next();
    return res.status(403).json({ success: false, error: 'Forbidden' });
  };
}
```

Apply to **every** mutating route. Never trust frontend role badges alone.

---

## 4. Admin (Manager) Dashboard — UI/UX

### 4.1 Layout (Channel Admin / Manager)

```
┌─────────────────────────────────────────────────────────────┐
│ Logo │ Search │ [Upload] │ 🔔 Notifications │ Avatar ▼   │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │ Main content area                                │
│          │                                                  │
│ Dashboard│  KPI cards: Views, Watch time, Subs, Revenue*   │
│ Content  │  (* revenue if monetization enabled)             │
│ Analytics│                                                  │
│ Community│  Tables / charts / editors                       │
│ Comments │                                                  │
│ Live     │                                                  │
│ Team     │                                                  │
│ Settings │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### 4.2 Manager capabilities — screen map

| Feature | Screen | Primary actions |
|---------|--------|-----------------|
| Videos | Content → Videos | CRUD, bulk delete, change visibility |
| Shorts | Content → Shorts | Upload vertical (&lt;60s), separate feed flag `isShort: true` |
| Metadata | Video editor drawer | Title, description, tags, genre, thumbnail upload |
| Analytics | Analytics | Date range, views, CTR, subs gained, top videos |
| Community | Community tab | Create post (text, image, poll), schedule, delete |
| Comments | Comments inbox | Reply as channel, hide, delete, pin |
| Live chat | Live → Active stream | Moderate queue, official channel replies |
| Team | Team | Invite by email, assign role, revoke |

### 4.3 Flow: Upload & publish video

```
[Manager clicks Upload in Studio]
    → Modal: file, title, description, genre, thumbnail (optional)
    → POST /api/videos/upload → status: draft | processing | published
    → If draft: visible only in Studio until POST /api/videos/:id/publish
    → On publish:
        → Notify subscribers with channelNotifications.uploads === true
        → Insert Notification documents (type: new_upload)
```

### 4.4 Flow: Invite team member

```
[Manager → Team → Invite]
    → Enter email + role (Editor | Viewer | Standard Mod | Managing Mod)
    → POST /api/channels/:channelId/team/invite
    → Email link with token (expires 7d)
    → Invitee accepts → ChannelMembership created
    → AuditLog entry: team.invited
```

**Constraint:** Manager cannot set role `owner` or delete channel.

---

## 5. Moderator Console — UI/UX

### 5.1 Standard Moderator views

- **Comment queue:** reported + recent on channel videos  
- **Live chat panel:** message stream with actions: Delete, Timeout (10s–24h), Hide user  

### 5.2 Managing Moderator additional views

- **Chat settings:** enable/disable chat, mode (everyone | subscribers | members), slow mode delay (0–300s)  
- **Blocked words:** add/remove phrases (auto-delete or hold for review)  
- **Mod roster:** add/remove Standard Moderators for live chat  

### 5.3 Moderator action flows

**Delete comment**
```
DELETE /api/comments/:id
    → requirePermission('comment.delete')
    → Soft-delete (deletedAt, deletedBy)
    → Notify video owner: type moderator_action, payload { action: 'comment_removed', commentId }
```

**Timeout user in live chat**
```
POST /api/live/:streamId/chat/timeout
    body: { userId, durationSeconds }  // 10 – 86400
    → ChatTimeout record with expiresAt
    → Reject new messages from user until expiry
```

**Hide user from channel**
```
POST /api/channels/:channelId/hidden-users
    → User's comments: visibility hidden (not shown publicly)
    → Live chat messages from user: filtered server-side
```

---

## 6. Notification System

### 6.1 Global UI (bell icon)

**Placement:** Header right, between Upload and user avatar (all logged-in layouts).

```
[Click bell]
    → Dropdown panel (max-height 400px, scrollable)
    → Tabs: All | Mentions | (Admin: System)
    → Each row: icon, title, body preview, relative time, read/unread dot
    → "Mark all as read" footer link
    → Empty state: "No notifications yet"
```

**Badge:** Unread count (cap display at `9+`).

### 6.2 Notification types

| type | Recipient | Trigger |
|------|-----------|---------|
| `new_comment` | Video owner / channel team with `comment.notify` | Comment on their video |
| `comment_reply` | Parent comment author | Reply to comment |
| `new_like` | Video owner | Like threshold optional (instant or batched: "10 new likes") |
| `new_subscriber` | Channel owner | New subscription (optional digest) |
| `new_upload` | Subscribers (opt-in) | Channel publishes video/short |
| `community_post` | Subscribers (opt-in) | Channel community post |
| `moderator_action` | Content owner | Comment removed, video age-restricted, etc. |
| `team_invite` | Invitee | Team invitation |
| `platform_alert` | Platform Admin | Reports threshold, system errors |
| `subscription_digest` | Subscriber | Batched new uploads (daily, optional) |

### 6.3 Data model: `Notification`

```javascript
{
  _id: ObjectId,
  recipientId: ObjectId,      // User
  type: String,               // enum above
  title: String,
  body: String,
  read: { type: Boolean, default: false },
  readAt: Date,
  createdAt: Date,
  // deep link
  actionUrl: String,          // e.g. /watch?v=abc, /studio/comments
  // polymorphic reference
  entityType: String,         // video | comment | channel | live_stream
  entityId: ObjectId,
  actorId: ObjectId,          // who triggered (commenter, liker, mod)
  channelId: ObjectId,        // optional, for channel-scoped events
  metadata: Object,           // flexible payload
  groupKey: String            // optional, for batching likes
}
```

**Indexes:** `{ recipientId: 1, read: 1, createdAt: -1 }`, `{ recipientId: 1, groupKey: 1 }` (unique sparse for dedup).

### 6.4 Delivery pipeline

```
[Domain event occurs]
    → notificationService.emit(event)
    → Resolve recipients + preferences (see 6.5)
    → Create Notification document(s)
    → Push real-time via WebSocket/SSE (optional phase 2)
    → Increment unread counter cache on User
```

**Phase 1 (MVP):** Poll `GET /api/notifications?since=` every 30s + fetch on bell open.  
**Phase 2:** Socket.io room `user:{userId}` event `notification:new`.

### 6.5 User notification preferences

```javascript
// User.notificationPreferences
{
  email: { enabled: false, digest: 'none' },
  push: { enabled: false },
  inApp: { enabled: true },
  // per-type toggles
  types: {
    new_comment: true,
    new_like: true,
    new_upload: true,
    community_post: false,
    moderator_action: true
  }
}
```

---

## 7. Subscription Notifications (per-channel bell)

### 7.1 UI behavior

On channel page / video modal channel row:

```
[Subscribe]  [🔔]  ← bell appears after subscribe
```

- **Bell outline:** notifications OFF for this channel  
- **Bell filled:** notifications ON  
- **Click bell (don't navigate):** toggle dropdown  
  - ☑ Notify me about new uploads  
  - ☐ Notify me about community posts  
  - (optional) ☐ Send as email digest  

### 7.2 Data model: extend subscription

Current: `User.subscriptions: [channelOwnerId]`

**Migrate to:**

```javascript
// Subscription collection (preferred) or embedded map
{
  subscriberId: ObjectId,
  channelId: ObjectId,        // channel owner user id or Channel document
  createdAt: Date,
  notifications: {
    uploads: { type: Boolean, default: true },
    community: { type: Boolean, default: false },
    live: { type: Boolean, default: false }
  }
}
```

### 7.3 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/users/:channelId/subscribe` | Existing; create Subscription with defaults |
| PATCH | `/api/subscriptions/:channelId/notifications` | Update `notifications.uploads`, etc. |
| GET | `/api/subscriptions` | List with notification flags |

### 7.4 Publish → notify flow

```
[Video status → published]
    → Find Subscription where channelId = X AND notifications.uploads = true
    → For each subscriber:
        → If passes User.notificationPreferences.types.new_upload
        → Create Notification { type: new_upload, actorId: channelId, entityId: videoId }
```

---

## 8. Platform Admin Dashboard

### 8.1 Capabilities (site-wide)

- User search, suspend, ban  
- Channel list, force-unpublish video, resolve reports  
- Assign **Platform Moderators** (separate from channel moderators)  
- View global metrics: DAU, uploads/day, storage  
- System announcements → `platform_alert` to all admins  

### 8.2 Assign channel Managing Moderator (Platform Admin)

```
POST /api/admin/channels/:channelId/moderators
    body: { userId, role: 'managing_moderator' | 'standard_moderator' }
    → Only platform_admin OR channel Manager with team.role.assign
```

---

## 9. API Contract Summary (new routes)

### Notifications
- `GET /api/notifications` — list (paginated, filter `unreadOnly`)
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `GET /api/notifications/unread-count`

### Admin / Studio (channel-scoped, all require channelId + permission)
- `GET /api/studio/:channelId/analytics`
- `GET|POST|PATCH|DELETE /api/studio/:channelId/videos`
- `POST /api/studio/:channelId/videos/:id/publish`
- `GET|POST /api/studio/:channelId/community`
- `GET /api/studio/:channelId/comments`
- `GET|POST|PATCH /api/studio/:channelId/team`

### Moderation
- `DELETE /api/comments/:id`
- `POST /api/live/:streamId/chat/timeout`
- `POST /api/channels/:channelId/hidden-users`
- `PATCH /api/live/:streamId/chat/settings` (Managing Mod)

### Subscriptions (extend existing)
- `PATCH /api/subscriptions/:channelId/notifications`

---

## 10. Database Collections (new / extended)

| Collection | Purpose |
|------------|---------|
| `users` | Add `platformRole`, `notificationPreferences`, `unreadNotificationCount` |
| `channels` | Channel entity (ownerId, name, avatar, settings); *optional if 1:1 with user* |
| `channelmemberships` | userId, channelId, role, permissions[], invitedAt |
| `subscriptions` | subscriberId, channelId, notifications{} |
| `notifications` | See §6.3 |
| `comments` | videoId, authorId, text, parentId, deletedAt |
| `communityposts` | channelId, content, publishedAt |
| `chattimeouts` | streamId, userId, expiresAt |
| `hiddenchannelusers` | channelId, userId, hiddenAt |
| `blockedchatwords` | channelId, phrase |
| `auditlogs` | actorId, action, entity, metadata, timestamp |

---

## 11. UI Component Checklist (frontend)

| Component | Location | Notes |
|-----------|----------|-------|
| `NotificationBell` | Header | Badge, click → panel |
| `NotificationPanel` | Dropdown | List, mark read |
| `SubscriptionBell` | Video modal channel row | Toggle per-channel |
| `AdminSidebar` | `/admin` | Platform nav |
| `StudioSidebar` | `/studio` | Channel nav |
| `ModSidebar` | `/mod` | Moderation nav |
| `RoleGuard` | Router/wrapper | Hide nav items by permission |
| `TeamTable` | Studio → Team | Invite modal |
| `CommentModerationRow` | Mod console | Action buttons |
| `LiveChatModPanel` | Mod console | Real-time (phase 2) |

---

## 12. Security & Audit

- All moderator actions write to `auditlogs` (actor, action, target, IP optional).  
- Rate-limit notification creation (prevent like-spam).  
- Batched likes: group within 5-minute window, single notification.  
- Hidden users: server filters comments/chat; never expose in public API.  
- Platform Admin routes: separate middleware `requirePlatformAdmin`.  

---

## 13. Implementation Phases (recommended)

### Phase 1 — Foundation (2–3 weeks)
- [ ] `Notification` model + bell UI + CRUD API  
- [ ] Extend subscribe → `Subscription` with notification toggles + UI bell  
- [ ] Notify on: new upload (opt-in), new comment, new like (batched)  
- [ ] `platformRole` on User + `/admin` shell (read-only metrics)

### Phase 2 — Channel teams (2–3 weeks)
- [ ] `ChannelMembership` + invite flow  
- [ ] Studio dashboard: video CRUD, metadata edit  
- [ ] RBAC middleware on all studio routes  

### Phase 3 — Moderation (2 weeks)
- [ ] Comments model + moderation console  
- [ ] Standard Moderator actions (delete, timeout, hide)  
- [ ] `moderator_action` notifications to creators  

### Phase 4 — Advanced (3+ weeks)
- [ ] Managing Moderator chat settings + blocked words  
- [ ] Community tab + notifications  
- [ ] Analytics dashboards  
- [ ] Live streaming + live chat (WebSocket)  
- [ ] Shorts feed  
- [ ] Real-time notifications (WebSocket)

---

## 14. Mapping to Current Codebase

| Existing | Spec alignment |
|----------|----------------|
| `User.subscriptions[]` | Migrate to `Subscription` collection with `notifications` flags |
| `PUT /api/users/:id/subscribe` | Keep; extend to create Subscription defaults |
| `GET /api/videos/feed/subscriptions` | Unchanged; filter published only |
| `app.js` header | Add `NotificationBell`, wire poll/WebSocket |
| `backend/routes/auth.js` | Add `platformRole` to JWT payload |
| No comments yet | Add `comments` routes per Phase 3 |

---

## 15. Example LLM Implementation Prompt

> Implement Phase 1 of `docs/ADMIN_AND_NOTIFICATIONS_SPEC.md` for Role Camera Action!: create Mongoose `Notification` and `Subscription` models, extend subscribe API with per-channel notification PATCH, add `GET/PATCH /api/notifications` routes, and add a header bell dropdown in `index.html` + `app.js` that polls unread count every 30 seconds and marks notifications read on click.

---

*End of specification.*
