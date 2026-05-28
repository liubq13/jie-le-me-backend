const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, getDb } = require('./database');
const authRoutes = require('./routes/auth');
const regionRoutes = require('./routes/regions');
const schoolRoutes = require('./routes/schools');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const dismissalRoutes = require('./routes/dismissal');
const searchRoutes = require('./routes/search');

const app = express();

let dbReady = false;
const initPromise = initDb().then(() => { dbReady = true; console.log('DB ready'); });

app.use(async (req, res, next) => {
  if (!dbReady) await initPromise;
  next();
});

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
app.get('/api/health', (req, res) => res.json({ ok: true, db: dbReady }));

module.exports = app;
