const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();

// Đổi tên người dùng
router.post('/change-name', async (req, res) => {
  const {token, newName} = req.body;
  if(!/^[a-zA-Z0-9]{4,30}$/.test(newName))
    return res.status(400).json({error:'Tên sai định dạng'});
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) { return res.status(401).json({error:'Token hết hạn'});}
  const user = await User.findById(decoded.uid);
  if(!user) return res.status(401).json({error:'User không tồn tại'});
  user.username = newName;
  await user.save();
  res.json({success:true});
});

// CỘNG ĐIỂM & LẤY PROFILE
router.post('/add-point', async (req, res) => {
  const { token, addPoint } = req.body;
  if (typeof addPoint !== 'number') return res.status(400).json({error:'Thiếu số điểm'});
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) { return res.status(401).json({error:'Token hết hạn'});}
  const user = await User.findById(decoded.uid);
  if(!user) return res.status(401).json({error:'User không tồn tại'});
  user.point = (user.point || 0) + addPoint;
  await user.save();
  res.json({ success:true, point: user.point });
});

// LẤY HỒ SƠ NGƯỜI DÙNG (sau khi reload/profile)
router.post('/profile', async (req, res) => {
  const { token } = req.body;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) { return res.status(401).json({error:'Token hết hạn'});}
  const user = await User.findById(decoded.uid);
  if(!user) return res.status(401).json({error:'User không tồn tại'});
  res.json({
    username: user.username,
    id: user._id,
    point: user.point,
    avatar: user.avatar || '',
    items: user.items || []
  });
});

module.exports = router;
