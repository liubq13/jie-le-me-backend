const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prepareRun, prepareGet, prepareAll } = require('../database');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

// 注册
router.post('/register', (req, res) => {
  try {
    const { phone, password, role, name } = req.body;
    if (!phone || !password || !role || !name) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (!['teacher', 'parent'].includes(role)) {
      return res.status(400).json({ error: '角色类型无效' });
    }
    const existing = prepareGet('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing) {
      return res.status(400).json({ error: '该手机号已注册' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = prepareRun(
      'INSERT INTO users (phone, password, role, name) VALUES (?, ?, ?, ?)',
      [phone, hashedPassword, role, name]
    );
    const token = jwt.sign(
      { id: result.lastInsertRowid, phone, role, name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: result.lastInsertRowid, phone, role, name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = prepareGet('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '手机号或密码错误' });
    }
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name, avatar: user.avatar }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  const user = prepareGet('SELECT id, phone, role, name, avatar FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
});

module.exports = router;
