const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const User = require('./models/User');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
['videos', 'thumbnails'].forEach(dir => fs.mkdirSync(path.join(uploadsDir, dir), { recursive: true }));
app.use('/uploads', express.static(uploadsDir));

const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));

const Video = require('./models/Video');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/naruto_video')
  .then(async () => {
    console.log('✅ MongoDB connected');
    await Video.updateMany({ status: { $exists: false } }, { $set: { status: 'published' } });
    if (process.env.ADMIN_EMAIL) {
      await User.updateOne(
        { email: process.env.ADMIN_EMAIL.toLowerCase() },
        { platformRole: 'platform_admin' }
      );
      console.log(`👑 Admin role synced for ${process.env.ADMIN_EMAIL}`);
    }
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    appName: 'Role Camera Action!'
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/studio', require('./routes/studio'));
app.use('/api/mod', require('./routes/moderation'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/live', require('./routes/live'));

// Legacy dashboard URLs → unified single-page app
app.get('/admin', (req, res) => res.redirect('/#admin'));
app.get('/studio', (req, res) => res.redirect('/#studio'));
app.get('/mod', (req, res) => res.redirect('/#mod'));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Role Camera Action! running at http://localhost:${PORT}`);
});
