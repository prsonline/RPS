const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength:4, maxlength:30, match: /^[a-zA-Z0-9]+$/ },
  email: { type: String, required: true, unique: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, required: true },
  avatar: String, // Lưu URL hoặc base64 string
  point: { type: Number, default: 0 },
  items: [{ type: String }],
  isOnline: { type: Boolean, default: false },
  lastLogin: Date,
  lastActive: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
