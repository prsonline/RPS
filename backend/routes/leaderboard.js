const express = require('express');
const User = require('../models/User');
const router = express.Router();

router.get('/', async (req, res) => {
  let users = await User.find({}).sort({point:-1}).select('username point isOnline avatar').limit(50);
  users = users.map((u,i) => ({rank:i+1, username:u.username, point:u.point, online:u.isOnline, avatar: u.avatar}));
  res.json(users);
});

module.exports = router;
