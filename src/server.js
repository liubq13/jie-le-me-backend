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
  console.log('Database initialized');

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

  // health check
  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log('JieLeMe API running on port ' + PORT);
  });

  // Check for overdue pickups every 30 seconds (log only, clients poll)
  setInterval(() => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    try {
      const records = prepareAll(
        "SELECT dr.*, c.school_id FROM dismissal_records dr JOIN classes c ON dr.class_id = c.id WHERE dr.status = 'dismissed' AND dr.dismissed_at <= ? AND date(dr.created_at) = ?",
        [tenMinAgo, today]
      );
      for (const record of records) {
        const unpicked = prepareAll(
          'SELECT DISTINCT pr.student_id, pr.parent_id FROM pickup_records pr WHERE pr.dismissal_record_id = ? AND pr.picked_up = 0',
          [record.id]
        );
        if (unpicked.length > 0) {
          console.log('Overdue pickups for class ' + record.class_id + ': ' + unpicked.length + ' unpicked');
        }
      }
    } catch(e) { /* ignore */ }
  }, 30000);
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
