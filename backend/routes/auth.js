const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Channel = require('../models/Channel');
const ChannelMembership = require('../models/ChannelMembership');

const router = express.Router();

async function ensureChannel(user) {
  let channel = await Channel.findOne({ ownerId: user._id });
  if (!channel) {
    channel = await Channel.create({ ownerId: user._id, name: user.username, avatar: user.avatar });
  }
  return channel;
}

async function buildUserPayload(user) {
  const memberships = await ChannelMembership.find({ userId: user._id, status: 'active' })
    .select('channelId role');
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    subscriberCount: user.subscriberCount || 0,
    platformRole: user.platformRole || 'user',
    unreadNotificationCount: user.unreadNotificationCount || 0,
    channelId: user._id,
    memberships
  };
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

async function sendUser(res, user, status = 200) {
  await ensureChannel(user);
  const token = signToken(user._id);
  res.status(status).json({
    success: true,
    token,
    user: await buildUserPayload(user)
  });
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken'
      });
    }

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=E50914&color=fff`
    });

    if (process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
      user.platformRole = 'platform_admin';
      await user.save();
    }

    await sendUser(res, user, 201);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (user.isBanned) {
      return res.status(403).json({ success: false, error: 'Account suspended' });
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    await sendUser(res, user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential required' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        error: 'Google Sign-In is not configured. Add GOOGLE_CLIENT_ID to backend/.env'
      });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (picture) user.avatar = picture;
        await user.save();
      }
    } else {
      const baseUsername = (name || email.split('@')[0]).replace(/\s+/g, '').slice(0, 20);
      let username = baseUsername;
      let suffix = 1;
      while (await User.findOne({ username })) username = `${baseUsername}${suffix++}`;

      user = await User.create({
        username,
        email: email.toLowerCase(),
        googleId,
        avatar: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=E50914&color=fff`
      });
    }

    if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL.toLowerCase()) {
      user.platformRole = 'platform_admin';
      await user.save();
    }

    await sendUser(res, user);
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ success: false, error: 'Google sign-in failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer')) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: await buildUserPayload(user) });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

router.get('/access', async (req, res) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer')) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    const memberships = await ChannelMembership.find({ userId: user._id, status: 'active' });
    res.json({
      success: true,
      platformRole: user.platformRole,
      isPlatformAdmin: user.platformRole === 'platform_admin',
      ownsChannel: true,
      memberships,
      canAccessStudio: true,
      canAccessMod: user.platformRole === 'platform_admin' ||
        memberships.some(m => ['manager', 'editor', 'viewer', 'managing_moderator', 'standard_moderator'].includes(m.role))
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

module.exports = router;
