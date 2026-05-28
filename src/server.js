const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./database');
const setupSocket = require('./socket');
const authRoutes = require('./routes/auth');
const regionRoutes = require('./routes/regions');
const schoolRoutes = require('./routes/schools');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const dismissalRoutes = require('./routes/dismissal');
const searchRoutes = require('./routes/search');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// 初始化数据库后启动
async function start() {
  await initDb();
  console.log('数据库已初始化');

  // 初始化Socket
  const socketManager = setupSocket(io);
  app.set('socketManager', socketManager);

  // 中间件
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // 路由
  app.use('/api/auth', authRoutes);
  app.use('/api/regions', regionRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/dismissal', dismissalRoutes);
  app.use('/api/search', searchRoutes);

  // 定时任务：放学10分钟后检查未接学生
  setInterval(() => {
    const { prepareGet, prepareAll } = require('./database');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const records = prepareAll(
      `SELECT dr.*, c.school_id
       FROM dismissal_records dr
       JOIN classes c ON dr.class_id = c.id
       WHERE dr.status = 'dismissed'
         AND dr.dismissed_at <= ?
         AND date(dr.created_at) = ?`,
      [tenMinutesAgo, today]
    );

    for (const record of records) {
      const unpicked = prepareAll(
        'SELECT DISTINCT pr.student_id FROM pickup_records pr WHERE pr.dismissal_record_id = ? AND pr.picked_up = 0',
        [record.id]
      );
      for (const up of unpicked) {
        const parents = prepareAll(
          'SELECT parent_id FROM parent_students WHERE student_id = ?', [up.student_id]
        );
        for (const p of parents) {
          socketManager.sendToUser(p.parent_id, 'pickup_reminder', {
            student_id: up.student_id,
            message: '您的孩子已放学超过10分钟，请确认是否已接到学生'
          });
        }
      }
    }
  }, 30000);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log('接了么后端服务已启动: http://localhost:' + PORT);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
