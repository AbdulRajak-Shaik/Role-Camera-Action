const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Video = require('./models/Video');

const app = express();

// Debug helpers (Vercel logs)
function envPresent(name) {
  const v = process.env[name];
  if (!v) return false;
  return String(v).trim().length > 0;
}

console.log('[CONFIG] MONGO_URI present:', envPresent('MONGO_URI'));
console.log('[CONFIG] JWT_SECRET present:', envPresent('JWT_SECRET'));
console.log('[CONFIG] GOOGLE_CLIENT_ID present:', envPresent('GOOGLE_CLIENT_ID'));

// Add video cache headers for better streaming
app.use('/api/uploads', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=31536000');
  next();
});

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Serverless-safe Mongo connection
const mongoUri = process.env.MONGO_URI;
if (!global.__MONGOOSE_CACHE__) {
  global.__MONGOOSE_CACHE__ = {
    conn: null,
    promise: null,
    postConnectSyncComplete: false
  };
}
const mongoCache = global.__MONGOOSE_CACHE__;

async function runPostConnectSync() {
  if (mongoCache.postConnectSyncComplete) return;

  try {
    await Video.updateMany({ status: { $exists: false } }, { $set: { status: 'published' } });

    if (process.env.ADMIN_EMAIL) {
      await User.updateOne(
        { email: process.env.ADMIN_EMAIL.toLowerCase() },
        { platformRole: 'platform_admin' }
      );
      console.log(`[BOOT] Admin role synced for ${process.env.ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error('[BOOT] Post-connect sync failed:', error);
  }

  mongoCache.postConnectSyncComplete = true;
}

async function connectMongo() {
  if (mongoCache.conn) return mongoCache.conn;

  if (!mongoUri || String(mongoUri).trim().length === 0) {
    console.error('MONGO_URI missing. Set MONGO_URI in Vercel environment variables.');
    throw new Error('MONGO_URI is not configured');
  }

  if (!mongoCache.promise) {
    console.log('[DB] Opening MongoDB connection');
    mongoCache.promise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
  }

  try {
    mongoCache.conn = await mongoCache.promise;
    console.log('MongoDB connected');
    await runPostConnectSync();
    return mongoCache.conn;
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error);
    mongoCache.conn = null;
    mongoCache.promise = null;
    throw error;
  }
}

const DB_OPTIONAL_PATHS = new Set(['/api/health', '/api/config', '/api/uploads']);

app.use(async (req, res, next) => {
  if (DB_OPTIONAL_PATHS.has(req.path) || req.path.startsWith('/api/uploads')) return next();

  try {
    await connectMongo();
    return next();
  } catch (error) {
    console.error('[DB] Request blocked due to DB connection error:', {
      method: req.method,
      path: req.path,
      message: error.message
    });
    return res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

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

// Video streaming endpoint (must be before /api/videos)
app.get('/api/uploads/:id/video', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video || !video.videoData) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    res.set('Content-Type', video.videoContentType || 'video/mp4');
    res.set('Content-Length', video.videoData.length);
    res.set('Accept-Ranges', 'bytes');
    
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : video.videoData.length - 1;
      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${video.videoData.length}`);
      return res.send(video.videoData.slice(start, end + 1));
    }

    res.send(video.videoData);
  } catch (error) {
    console.error('Video serve error:', error);
    res.status(500).json({ success: false, error: 'Error serving video' });
  }
});

// Thumbnail endpoint
app.get('/api/uploads/:id/thumbnail', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video || !video.thumbnailData) {
      return res.status(404).json({ success: false, error: 'Thumbnail not found' });
    }

    res.set('Content-Type', video.thumbnailContentType || 'image/jpeg');
    res.set('Content-Length', video.thumbnailData.length);
    res.send(video.thumbnailData);
  } catch (error) {
    console.error('Thumbnail serve error:', error);
    res.status(500).json({ success: false, error: 'Error serving thumbnail' });
  }
});

app.use('/api/videos', require('./routes/videos'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/studio', require('./routes/studio'));
app.use('/api/mod', require('./routes/moderation'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/live', require('./routes/live'));

// Frontend path for local development
const frontendDir = path.join(__dirname, '..');

// Serve static files
app.use(express.static(frontendDir));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/js', express.static(path.join(frontendDir, 'js')));

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

// Local server startup (for development)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('\n');
    console.log('  \x1b[32m✔\x1b[0m  \x1b[1mRole Camera Action! — Backend\x1b[0m');
    console.log('  ─────────────────────────────────────────');
    console.log(`  \x1b[1m➜  Local:   \x1b[36m${url}\x1b[0m`);
    console.log(`  \x1b[1m➜  API:     \x1b[36m${url}/api/health\x1b[0m`);
    console.log('  ─────────────────────────────────────────');
    console.log('  Press \x1b[1mCtrl+C\x1b[0m to stop\n');
  });
}

module.exports = app;