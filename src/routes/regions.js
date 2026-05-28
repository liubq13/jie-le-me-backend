const express = require('express');
const router = express.Router();
const { prepareAll } = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.get('/provinces', authMiddleware, (req, res) => {
  const provinces = prepareAll("SELECT * FROM regions WHERE level = 'province' ORDER BY code");
  res.json({ data: provinces });
});

router.get('/cities/:provinceCode', authMiddleware, (req, res) => {
  const cities = prepareAll(
    "SELECT * FROM regions WHERE level = 'city' AND parent_code = ? ORDER BY code",
    [req.params.provinceCode]
  );
  res.json({ data: cities });
});

router.get('/counties/:cityCode', authMiddleware, (req, res) => {
  const counties = prepareAll(
    "SELECT * FROM regions WHERE level = ''county'' AND parent_code = ? ORDER BY code",
    [req.params.cityCode]
  );
  res.json({ data: counties });
});

module.exports = router;

