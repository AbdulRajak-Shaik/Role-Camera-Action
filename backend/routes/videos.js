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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('video/')) {
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

    // Save video file to disk for streaming
    const videoDir = path.join(__dirname, '../uploads/videos');
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = path.join(videoDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    // Create a simple placeholder thumbnail (red square for now)
    const placeholderThumbnail = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
      0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
      0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
      0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
      0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
      0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
      0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
      0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
      0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
      0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD3, 0xFF, 0xD9
    ]);

    const isShort = req.body.isShort === 'true' || req.body.isShort === true;
    const video = await Video.create({
      title,
      description: description || '',
      videoData: req.file.buffer,
      videoContentType: req.file.mimetype,
      thumbnailData: placeholderThumbnail,
      thumbnailContentType: 'image/jpeg',
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
