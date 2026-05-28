const express = require('express');
const router = express.Router();
const { prepareRun, prepareGet, prepareAll } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/initiate', authMiddleware, roleMiddleware('parent'), (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: '缺少学生ID' });
    const student = prepareGet('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ error: '学生不存在' });

    const today = new Date().toISOString().slice(0, 10);
    const record = prepareGet(
      'SELECT * FROM dismissal_records WHERE class_id = ? AND date(created_at) = ?',
      [student.class_id, today]
    );
    if (!record || record.status !== 'dismissed') {
      return res.status(400).json({ error: '班级尚未放学或无放学记录' });
    }
    const existing = prepareGet(
      "SELECT * FROM search_assists WHERE student_id = ? AND dismissal_record_id = ? AND status = 'active'",
      [student_id, record.id]
    );
    if (existing) return res.json({ data: existing, message: '已存在该学生的寻找协助' });

    const result = prepareRun(
      'INSERT INTO search_assists (dismissal_record_id, student_id, initiator_id) VALUES (?, ?, ?)',
      [record.id, student_id, req.user.id]
    );
    const assist = prepareGet('SELECT * FROM search_assists WHERE id = ?', [result.lastInsertRowid]);
    res.json({ data: assist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/found', authMiddleware, (req, res) => {
  try {
    const { lat, lng } = req.body;
    const assist = prepareGet(
      "SELECT * FROM search_assists WHERE id = ? AND status = 'active'", [req.params.id]
    );
    if (!assist) return res.status(404).json({ error: '寻找记录不存在或已结束' });

    prepareRun(
      'UPDATE search_assists SET status = ?, finder_id = ?, finder_location_lat = ?, finder_location_lng = ? WHERE id = ?',
      ['found', req.user.id, lat || null, lng || null, req.params.id]
    );
    const updated = prepareGet('SELECT * FROM search_assists WHERE id = ?', [req.params.id]);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resolve', authMiddleware, roleMiddleware('parent'), (req, res) => {
  try {
    const assist = prepareGet(
      'SELECT * FROM search_assists WHERE id = ? AND initiator_id = ?',
      [req.params.id, req.user.id]
    );
    if (!assist) return res.status(404).json({ error: '寻找记录不存在或无权操作' });

    prepareRun(
      "UPDATE search_assists SET status = 'resolved', resolved_at = datetime('now','localtime') WHERE id = ?",
      [req.params.id]
    );
    res.json({ data: { message: '已确认找到，协助取消' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/school/:schoolId/active', authMiddleware, (req, res) => {
  try {
    const assists = prepareAll(
      `SELECT sa.*, s.name as student_name, s.photo as student_photo,
              c.name as class_name, u.name as initiator_name
       FROM search_assists sa
       JOIN students s ON sa.student_id = s.id
       JOIN classes c ON s.class_id = c.id
       JOIN users u ON sa.initiator_id = u.id
       WHERE s.school_id = ? AND sa.status IN ('active','found')
         AND date(sa.created_at) = date('now','localtime')
       ORDER BY sa.created_at DESC`,
      [req.params.schoolId]
    );
    res.json({ data: assists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
