const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  googleId: { type: String, sparse: true, unique: true },
  avatar: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=User&background=E50914&color=fff'
  },
  platformRole: {
    type: String,
    enum: ['user', 'platform_admin'],
    default: 'user'
  },
  isBanned: { type: Boolean, default: false },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  subscriberCount: { type: Number, default: 0 },
  unreadNotificationCount: { type: Number, default: 0 },
  notificationPreferences: {
    inApp: { enabled: { type: Boolean, default: true } },
    types: {
      new_comment: { type: Boolean, default: true },
      new_like: { type: Boolean, default: true },
      new_upload: { type: Boolean, default: true },
      community_post: { type: Boolean, default: true },
      moderator_action: { type: Boolean, default: true },
      team_invite: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
