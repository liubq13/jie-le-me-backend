const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { initDb, prepareGet, prepareAll } = require('./database');
const authRoutes = require('./routes/auth');
const regionRoutes = require('./routes/regions');
const schoolRoutes = require('./routes/schools');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const dismissalRoutes = require('./routes/dismissal');
const searchRoutes = require('./routes/search');

const app = express();

async function start() {
  await initDb();
  console.log('Database ready');

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use('/api/auth', authRoutes);
  app.use('/api/regions', regionRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/dismissal', dismissalRoutes);
  app.use('/api/search', searchRoutes);
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  const PORT = process.env.PORT || 3000;
  http.createServer(app).listen(PORT, '0.0.0.0', () => {
    console.log('JieLeMe API on port ' + PORT);
  });

  setInterval(() => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    try {
      const records = prepareAll(
        "SELECT dr.* FROM dismissal_records dr WHERE dr.status = 'dismissed' AND dr.dismissed_at <= ? AND date(dr.created_at) = ?",
        [tenMinAgo, today]
      );
      records.forEach(r => {
        const unpicked = prepareAll(
          'SELECT DISTINCT student_id FROM pickup_records WHERE dismissal_record_id = ? AND picked_up = 0',
          [r.id]
        );
        if (unpicked.length > 0) console.log('Overdue: class ' + r.class_id + ', ' + unpicked.length + ' unpicked');
      });
    } catch(e) {}
  }, 30000);
}

start().catch(err => { console.error(err); process.exit(1); });
