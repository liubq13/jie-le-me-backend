const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { prepareRun, prepareGet, prepareAll } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// 班主任创建班级（含邀请码）
router.post('/', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  try {
    const { school_id, name, grade } = req.body;
    if (!school_id || !name) {
      return res.status(400).json({ error: '请填写学校和班级名称' });
    }
    const school = prepareGet('SELECT * FROM schools WHERE id = ?', [school_id]);
    if (!school) {
      return res.status(404).json({ error: '学校不存在' });
    }
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const result = prepareRun(
      'INSERT INTO classes (school_id, name, grade, teacher_id, invite_code, invite_code_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [school_id, name, grade || '', req.user.id, invite_code, expires_at]
    );
    res.json({
      data: { id: result.lastInsertRowid, name, grade, invite_code, invite_code_expires_at: expires_at }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 班主任刷新邀请码
router.post('/:id/refresh-invite', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  try {
    const cls = prepareGet('SELECT * FROM classes WHERE id = ? AND teacher_id = ?', [req.params.id, req.user.id]);
    if (!cls) {
      return res.status(404).json({ error: '班级不存在或无权操作' });
    }
    const new_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    prepareRun(
      'UPDATE classes SET invite_code = ?, invite_code_expires_at = ? WHERE id = ?',
      [new_code, expires_at, req.params.id]
    );
    res.json({ data: { invite_code: new_code, invite_code_expires_at: expires_at } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 家长通过邀请码加入班级
router.post('/join', authMiddleware, roleMiddleware('parent'), (req, res) => {
  try {
    const { invite_code } = req.body;
    if (!invite_code) {
      return res.status(400).json({ error: '请输入邀请码' });
    }
    const cls = prepareGet('SELECT * FROM classes WHERE invite_code = ?', [invite_code]);
    if (!cls) {
      return res.status(404).json({ error: '邀请码无效' });
    }
    if (new Date(cls.invite_code_expires_at) < new Date()) {
      return res.status(400).json({ error: '邀请码已过期，请联系班主任重新获取' });
    }
    const existing = prepareGet(
      'SELECT id FROM class_parents WHERE class_id = ? AND parent_id = ?',
      [cls.id, req.user.id]
    );
    if (existing) {
      return res.json({ data: { class_id: cls.id, class_name: cls.name, message: '已在该班级中' } });
    }
    prepareRun(
      'INSERT INTO class_parents (class_id, parent_id) VALUES (?, ?)',
      [cls.id, req.user.id]
    );
    const school = prepareGet('SELECT * FROM schools WHERE id = ?', [cls.school_id]);
    res.json({
      data: { class_id: cls.id, class_name: cls.name, school_id: cls.school_id, school_name: school?.name || '' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取班主任的班级列表
router.get('/my-teaching', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  const classes = prepareAll(
    `SELECT c.*, s.name as school_name
     FROM classes c JOIN schools s ON c.school_id = s.id
     WHERE c.teacher_id = ?`,
    [req.user.id]
  );
  res.json({ data: classes });
});

// 获取家长绑定的班级列表
router.get('/my-children', authMiddleware, roleMiddleware('parent'), (req, res) => {
  const classes = prepareAll(
    `SELECT DISTINCT c.*, s.name as school_name
     FROM class_parents cp
     JOIN classes c ON cp.class_id = c.id
     JOIN schools s ON c.school_id = s.id
     WHERE cp.parent_id = ?`,
    [req.user.id]
  );
  res.json({ data: classes });
});

module.exports = router;
