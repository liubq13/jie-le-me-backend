const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { prepareRun, prepareGet, prepareAll } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'student_' + Date.now() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', authMiddleware, roleMiddleware('parent'), upload.single('photo'), (req, res) => {
  try {
    const { name, class_id } = req.body;
    if (!name || !class_id) {
      return res.status(400).json({ error: '请填写学生姓名和班级' });
    }
    const binding = prepareGet(
      'SELECT id FROM class_parents WHERE class_id = ? AND parent_id = ?',
      [class_id, req.user.id]
    );
    if (!binding) {
      return res.status(403).json({ error: '您尚未加入该班级' });
    }
    const cls = prepareGet('SELECT school_id FROM classes WHERE id = ?', [class_id]);
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    const result = prepareRun(
      'INSERT INTO students (name, photo, class_id, school_id) VALUES (?, ?, ?, ?)',
      [name, photo_path, class_id, cls.school_id]
    );
    prepareRun(
      'INSERT OR IGNORE INTO parent_students (parent_id, student_id) VALUES (?, ?)',
      [req.user.id, result.lastInsertRowid]
    );
    res.json({
      data: { id: result.lastInsertRowid, name, photo: photo_path, class_id }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/bind-parent', authMiddleware, roleMiddleware('parent'), (req, res) => {
  try {
    const student = prepareGet('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!student) return res.status(404).json({ error: '学生不存在' });
    const binding = prepareGet(
      'SELECT id FROM class_parents WHERE class_id = ? AND parent_id = ?',
      [student.class_id, req.user.id]
    );
    if (!binding) return res.status(403).json({ error: '您尚未加入该班级，请先用邀请码加入' });
    prepareRun(
      'INSERT OR IGNORE INTO parent_students (parent_id, student_id) VALUES (?, ?)',
      [req.user.id, student.id]
    );
    res.json({ data: { message: '绑定成功' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/class/:classId', authMiddleware, (req, res) => {
  const students = prepareAll('SELECT * FROM students WHERE class_id = ? ORDER BY name', [req.params.classId]);
  res.json({ data: students });
});

router.get('/my', authMiddleware, roleMiddleware('parent'), (req, res) => {
  const students = prepareAll(
    `SELECT s.*, c.name as class_name, sc.name as school_name
     FROM parent_students ps
     JOIN students s ON ps.student_id = s.id
     JOIN classes c ON s.class_id = c.id
     JOIN schools sc ON s.school_id = sc.id
     WHERE ps.parent_id = ?`,
    [req.user.id]
  );
  res.json({ data: students });
});

module.exports = router;
