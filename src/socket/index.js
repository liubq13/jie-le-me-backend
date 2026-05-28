const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// 在线用户映射: userId -> Set of socketIds
const onlineUsers = new Map();

function setupSocket(io) {
  // 认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('未登录'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Token无效'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log('用户上线:', socket.user.name, '(', socket.user.role, ')');

    // 维护在线用户
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // 加入角色房间
    socket.join('role:' + socket.user.role);
    socket.join('user:' + userId);

    socket.on('disconnect', () => {
      console.log('用户下线:', socket.user.name);
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });

  return {
    // 向某学校的所有用户广播（用于寻找协助弹窗）
    broadcastToSchool: (schoolId, event, data) => {
      io.emit('school:' + schoolId + ':' + event, data);
    },
    // 向某班级的所有用户广播
    broadcastToClass: (classId, event, data) => {
      io.emit('class:' + classId + ':' + event, data);
    },
    // 发给特定用户
    sendToUser: (userId, event, data) => {
      io.to('user:' + userId).emit(event, data);
    },
    onlineUsers
  };
}

module.exports = setupSocket;
