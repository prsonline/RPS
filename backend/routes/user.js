const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

module.exports = router;
