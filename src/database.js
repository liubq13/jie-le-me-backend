const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.VERCEL ? '/tmp/data.db' : path.join(__dirname, '..', 'data.db');

let db = null;

// 保存数据库到文件
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 初始化数据库
async function initDb() {
  const SQL = await initSqlJs();

  // 尝试从文件加载
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // ---------- 建表 ----------
  db.run(`
    CREATE TABLE IF NOT EXISTS regions (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_code TEXT,
      level TEXT CHECK(level IN ('province','city','county')) NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      province_code TEXT NOT NULL,
      city_code TEXT NOT NULL,
      county_code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (province_code) REFERENCES regions(code),
      FOREIGN KEY (city_code) REFERENCES regions(code),
      FOREIGN KEY (county_code) REFERENCES regions(code)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('teacher','parent')) NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      grade TEXT,
      teacher_id INTEGER NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      invite_code_expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      photo TEXT,
      class_id INTEGER NOT NULL,
      school_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parent_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(parent_id, student_id),
      FOREIGN KEY (parent_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dismissal_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('not_dismissed','dismissed')) DEFAULT 'not_dismissed',
      dismissed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(class_id, created_at)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pickup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dismissal_record_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      picked_up INTEGER DEFAULT 0,
      picked_up_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (dismissal_record_id) REFERENCES dismissal_records(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (parent_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS search_assists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dismissal_record_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      initiator_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('active','found','resolved')) DEFAULT 'active',
      finder_id INTEGER,
      finder_location_lat REAL,
      finder_location_lng REAL,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (dismissal_record_id) REFERENCES dismissal_records(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS class_parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(class_id, parent_id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (parent_id) REFERENCES users(id)
    )
  `);

  saveDb();
  return db;
}

// 获取数据库实例
function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDb()');
  }
  return db;
}

// ---------- sql.js 风格的查询辅助方法 ----------

// prepare + run: 执行写操作
function prepareRun(sql, params = []) {
  const dbInst = getDb();
  dbInst.run(sql, params);
  const lastId = dbInst.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
  saveDb();
  return { lastInsertRowid: lastId };
}

// prepare + get: 取单行
function prepareGet(sql, params = []) {
  const dbInst = getDb();
  const stmt = dbInst.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    return row;
  }
  stmt.free();
  return null;
}

// prepare + all: 取多行
function prepareAll(sql, params = []) {
  const dbInst = getDb();
  const stmt = dbInst.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// 直接 exec
function execSql(sql) {
  const dbInst = getDb();
  const result = dbInst.exec(sql);
  saveDb();
  return result;
}

module.exports = { initDb, getDb, saveDb, prepareRun, prepareGet, prepareAll, execSql };


