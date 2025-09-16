// backend/routes/game.js
const express = require('express');
const router = express.Router();

// Có thể đặt các API liên quan đến game ở đây
// Ví dụ, trả về OK để tránh lỗi lúc chạy:
router.get('/', (req, res) => {
  res.json({msg: 'Game route OK'});
});

module.exports = router;
