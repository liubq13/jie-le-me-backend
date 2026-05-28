const express = require('express');
const router = express.Router();
const { prepareRun, prepareGet, prepareAll } = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.get('/search', authMiddleware, (req, res) => {
  const { province_code, city_code, county_code, keyword } = req.query;
  let sql = 'SELECT * FROM schools WHERE 1=1';
  const params = [];
  if (province_code) { sql += ' AND province_code = ?'; params.push(province_code); }
  if (city_code) { sql += ' AND city_code = ?'; params.push(city_code); }
  if (county_code) { sql += ' AND county_code = ?'; params.push(county_code); }
  if (keyword) { sql += ' AND name LIKE ?'; params.push('%' + keyword + '%'); }
  sql += ' ORDER BY name';
  const schools = prepareAll(sql, params);
  res.json({ data: schools });
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, province_code, city_code, county_code } = req.body;
    if (!name || !province_code || !city_code || !county_code) {
      return res.status(400).json({ error: '请填写完整学校信息' });
    }
    const existing = prepareGet(
      'SELECT id FROM schools WHERE name = ? AND county_code = ?',
      [name, county_code]
    );
    if (existing) {
      return res.status(400).json({ error: '该区域已存在同名学校' });
    }
    const result = prepareRun(
      'INSERT INTO schools (name, province_code, city_code, county_code) VALUES (?, ?, ?, ?)',
      [name, province_code, city_code, county_code]
    );
    res.json({ data: { id: result.lastInsertRowid, name, province_code, city_code, county_code } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
