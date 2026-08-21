const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  init(customPath = null) {
    if (this.db) return this.db;

    const defaultPath = path.resolve(__dirname, '../../data/dashboard.db');
    this.dbPath = customPath || process.env.DB_PATH || defaultPath;

    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Performance & integrity pragmas
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');

    return this.db;
  }

  getDb() {
    if (!this.db) {
      this.init();
    }
    return this.db;
  }

  query(sql, params = []) {
    const stmt = this.getDb().prepare(sql);
    return stmt.all(...params);
  }

  get(sql, params = []) {
    const stmt = this.getDb().prepare(sql);
    return stmt.get(...params);
  }

  run(sql, params = []) {
    const stmt = this.getDb().prepare(sql);
    return stmt.run(...params);
  }

  exec(sql) {
    return this.getDb().exec(sql);
  }

  transaction(fn) {
    this.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.exec('COMMIT;');
      return result;
    } catch (err) {
      this.exec('ROLLBACK;');
      throw err;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new Database();
