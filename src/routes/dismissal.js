const express = require('express');
const router = express.Router();
const { prepareRun, prepareGet, prepareAll } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

function getTodayRecord(class_id) {
  const today = new Date().toISOString().slice(0, 10);
  let record = prepareGet(
    `SELECT * FROM dismissal_records
     WHERE class_id = ? AND date(created_at) = ?`,
    [class_id, today]
  );
  if (!record) {
    const result = prepareRun(
      'INSERT INTO dismissal_records (class_id) VALUES (?)', [class_id]
    );
    record = prepareGet('SELECT * FROM dismissal_records WHERE id = ?', [result.lastInsertRowid]);
  }
  return record;
}

router.post('/:classId/status', authMiddleware, roleMiddleware('teacher'), (req, res) => {
  try {
    const { status } = req.body;
    if (!['not_dismissed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: '状态无效' });
    }
    const cls = prepareGet('SELECT * FROM classes WHERE id = ? AND teacher_id = ?', [req.params.classId, req.user.id]);
    if (!cls) return res.status(403).json({ error: '无权操作该班级' });

    const record = getTodayRecord(parseInt(req.params.classId));
    if (status === 'dismissed') {
      prepareRun(
        "UPDATE dismissal_records SET status = ?, dismissed_at = datetime('now','localtime') WHERE id = ?",
        [status, record.id]
      );
      const students = prepareAll('SELECT * FROM students WHERE class_id = ?', [req.params.classId]);
      for (const student of students) {
        const parents = prepareAll(
          'SELECT parent_id FROM parent_students WHERE student_id = ?', [student.id]
        );
        for (const p of parents) {
          prepareRun(
            'INSERT OR IGNORE INTO pickup_records (dismissal_record_id, student_id, parent_id) VALUES (?, ?, ?)',
            [record.id, student.id, p.parent_id]
          );
        }
      }
    } else {
      prepareRun(
        'UPDATE dismissal_records SET status = ?, dismissed_at = NULL WHERE id = ?',
        [status, record.id]
      );
    }
    res.json({ data: { class_id: parseInt(req.params.classId), status } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:classId/status', authMiddleware, (req, res) => {
  try {
    const record = getTodayRecord(parseInt(req.params.classId));
    const students = prepareAll(
      `SELECT s.id, s.name, s.photo,
              COALESCE(pr.picked_up, 0) as picked_up,
              pr.picked_up_at
       FROM students s
       LEFT JOIN pickup_records pr ON pr.student_id = s.id AND pr.dismissal_record_id = ?
       WHERE s.class_id = ?
       GROUP BY s.id`,
      [record.id, req.params.classId]
    );
    res.json({
      data: { status: record.status, dismissed_at: record.dismissed_at, students }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pickup', authMiddleware, roleMiddleware('parent'), (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: '缺少学生ID' });
    const student = prepareGet('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ error: '学生不存在' });

    const record = getTodayRecord(student.class_id);
    if (record.status !== 'dismissed') {
      return res.status(400).json({ error: '班级尚未放学' });
    }
    prepareRun(
      "UPDATE pickup_records SET picked_up = 1, picked_up_at = datetime('now','localtime') WHERE dismissal_record_id = ? AND student_id = ? AND parent_id = ?",
      [record.id, student_id, req.user.id]
    );
    res.json({ data: { student_id, picked_up: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
