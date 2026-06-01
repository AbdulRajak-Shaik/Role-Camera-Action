const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        console.error('❌ JWT_SECRET missing. Configure JWT_SECRET in Vercel env vars.');
        return res.status(503).json({ success: false, error: 'JWT not configured' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.userId).select('-password');


      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authorized, user not found' });
      }
      if (req.user.isBanned) {
        return res.status(403).json({ success: false, error: 'Account suspended' });
      }
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
};

const optionalAuth = async (req, res, next) => {
  if (!req.headers.authorization?.startsWith('Bearer')) return next();
  try {
    const token = req.headers.authorization.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET missing (optionalAuth). Configure JWT_SECRET in Vercel env vars.');
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select('-password');
  } catch (_) { /* ignore */ }

  next();
};

module.exports = { protect, optionalAuth };
