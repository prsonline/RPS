const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const isStrongPassword = require('../utils/password');
const router = express.Router();

// Đăng ký
router.post('/register', async (req, res) => {
  let {username, email, password} = req.body;
  if(!username || !email || !password) return res.status(400).json({error: 'Không đủ thông tin'});
  if(!/^[a-zA-Z0-9]{4,30}$/.test(username)) return res.status(400).json({error: 'Username sai định dạng'});
  if(!isStrongPassword(password)) return res.status(400).json({error: 'Password yếu'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error: 'Email sai định dạng!'});
  if(await User.findOne({username})) return res.status(400).json({error: 'Username đã tồn tại'});
  if(await User.findOne({email})) return res.status(400).json({error: 'Email đã tồn tại'});
  let hashed = await bcrypt.hash(password, 10);
  const user = await User.create({username, email, password: hashed});
  res.json({id: user._id, username: user.username, email: user.email});
});

// Đăng nhập
router.post('/login', async (req, res) => {
  const {username, password} = req.body;
  const user = await User.findOne({username});
  if(!user) return res.status(400).json({error: 'User không tồn tại'});
  if(!(await bcrypt.compare(password, user.password))) return res.status(400).json({error: 'Sai mật khẩu!'});
  const token = jwt.sign({uid: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});
  user.isOnline=true; user.lastLogin = new Date(); await user.save();
  res.json({token, username: user.username, id: user._id, avatar: user.avatar, point: user.point});
});

// Đổi mật khẩu
router.post('/change-password', async (req, res) => {
  const {token, oldPass, newPass} = req.body;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) { return res.status(401).json({error:'Token hết hạn'});}
  const user = await User.findById(decoded.uid);
  if(!user) return res.status(401).json({error:'User không tồn tại'});
  if(!(await bcrypt.compare(oldPass, user.password))) return res.status(400).json({error:'Sai mật khẩu cũ'});
  if(!isStrongPassword(newPass)) return res.status(400).json({error:'Mật khẩu mới chưa mạnh!'});
  user.password = await bcrypt.hash(newPass, 10);
  await user.save();
  res.json({success:true});
});

// Đăng xuất
router.post('/logout', async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.uid);
    if(user) { user.isOnline = false; await user.save(); }
  } catch {}
  res.json({success:true});
});

// Update avatar
router.post('/avatar', async (req, res) => {
  const { token, avatar } = req.body;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) { return res.status(401).json({error:'Token hết hạn'});}
  const user = await User.findById(decoded.uid);
  if(!user) return res.status(401).json({error:'User không tồn tại'});
  user.avatar = avatar;
  await user.save();
  res.json({success:true});
});

module.exports = router;
