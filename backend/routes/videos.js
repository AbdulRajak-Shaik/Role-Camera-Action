const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const { notifySubscribersNewUpload } = require('../services/notificationService');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads', 'videos');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed'), false);
    }
  }
});

function buildSort(sort) {
  switch (sort) {
    case 'popular':
      return { views: -1, createdAt: -1 };
    case 'trending':
      return { likes: -1, views: -1, createdAt: -1 };
    default:
      return { createdAt: -1 };
  }
}

function buildSearchQuery(search) {
  if (!search || !search.trim()) return {};
  const term = search.trim();
  return {
    $or: [
      { title: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } }
    ]
  };
}

// @route   POST /api/videos/upload
router.post('/upload', protect, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file uploaded' });
    }

    const { title, description, genre } = req.body;
    if (!title || !genre) {
      return res.status(400).json({ success: false, error: 'Title and genre are required' });
    }

    const isShort = req.body.isShort === 'true' || req.body.isShort === true;
    const video = await Video.create({
      title,
      description: description || '',
      filePath: `/uploads/videos/${req.file.filename}`,
      fileName: req.file.originalname,
      genre,
      uploadedBy: req.user._id,
      channelId: req.user._id,
      isShort,
      status: 'published',
      fileSize: req.file.size
    });

    await User.findByIdAndUpdate(req.user._id, { $push: { videos: video._id } });
    const owner = await User.findById(req.user._id);
    await notifySubscribersNewUpload(req.user._id, video, owner);

    const populated = await Video.findById(video._id).populate('uploadedBy', 'username avatar subscriberCount');

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video: populated
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error during upload' });
  }
});

// @route   GET /api/videos/liked
router.get('/liked', protect, async (req, res) => {
  try {
    const videos = await Video.find({ likes: req.user._id })
      .populate('uploadedBy', 'username avatar subscriberCount')
      .sort({ createdAt: -1 });

    res.json({ success: true, videos });
  } catch (error) {
    console.error('Liked videos error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/videos/feed/subscriptions
router.get('/feed/subscriptions', protect, async (req, res) => {
  try {
    const subs = await Subscription.find({ subscriberId: req.user._id }).select('channelId');
    const channelIds = subs.map(s => s.channelId);
    if (!channelIds.length) {
      return res.json({ success: true, videos: [] });
    }

    const videos = await Video.find({ uploadedBy: { $in: channelIds }, status: 'published' })
      .populate('uploadedBy', 'username avatar subscriberCount')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, videos });
  } catch (error) {
    console.error('Subscription feed error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/videos/my
router.get('/my', protect, async (req, res) => {
  try {
    const videos = await Video.find({ uploadedBy: req.user._id })
      .populate('uploadedBy', 'username avatar subscriberCount')
      .sort({ createdAt: -1 });

    res.json({ success: true, videos });
  } catch (error) {
    console.error('My videos error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/videos
router.get('/', async (req, res) => {
  try {
    const { genre, limit = 50, page = 1, search, sort = 'newest' } = req.query;

    const { isShort } = req.query;
    const query = { status: { $in: ['published', null] }, ...buildSearchQuery(search) };
    if (genre && genre !== 'all') query.genre = genre;
    if (isShort === 'true') query.isShort = true;
    if (isShort === 'false') query.isShort = false;

    const videos = await Video.find(query)
      .populate('uploadedBy', 'username avatar subscriberCount')
      .sort(buildSort(sort))
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Video.countDocuments(query);

    res.json({
      success: true,
      videos,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/videos/:id
router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, error: 'Invalid video ID' });
    }

    const video = await Video.findById(req.params.id)
      .populate('uploadedBy', 'username avatar subscriberCount');

    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    video.views += 1;
    await video.save();

    let isLiked = false;
    let isSubscribed = false;

    if (req.headers.authorization?.startsWith('Bearer')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
        const viewer = await User.findById(decoded.userId);
        if (viewer) {
          isLiked = video.likes.some(id => id.equals(viewer._id));
          const sub = await Subscription.findOne({ subscriberId: viewer._id, channelId: video.uploadedBy._id });
          isSubscribed = !!sub;
        }
      } catch (_) { /* optional auth */ }
    }

    res.json({
      success: true,
      video,
      isLiked,
      isSubscribed
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   PUT /api/videos/:id/like
router.put('/:id/like', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    const hasLiked = video.likes.some(id => id.equals(req.user._id));

    if (hasLiked) {
      video.likes.pull(req.user._id);
    } else {
      video.likes.push(req.user._id);
      if (video.uploadedBy.toString() !== req.user._id.toString()) {
        await createNotification({
          recipientId: video.uploadedBy,
          type: 'new_like',
          title: 'New like on your video',
          body: `${req.user.username} liked "${video.title}"`,
          actionUrl: `/?v=${video._id}`,
          entityType: 'video',
          entityId: video._id,
          actorId: req.user._id,
          channelId: video.uploadedBy,
          groupKey: `like-${video._id}`
        });
      }
    }

    await video.save();

    res.json({
      success: true,
      likes: video.likes.length,
      liked: !hasLiked
    });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only video files allowed') {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

module.exports = router;
