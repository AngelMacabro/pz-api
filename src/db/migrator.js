const fs = require('fs');
const path = require('path');
const db = require('./database');

class Migrator {
  constructor() {
    this.migrationsDir = path.resolve(__dirname, 'migrations');
  }

  initMigrationsTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  getAppliedMigrations() {
    this.initMigrationsTable();
    const rows = db.query('SELECT name FROM _migrations ORDER BY id ASC');
    return new Set(rows.map(r => r.name));
  }

  run() {
    db.init();
    this.initMigrationsTable();

    const applied = this.getAppliedMigrations();
    if (!fs.existsSync(this.migrationsDir)) {
      return { success: true, appliedCount: 0, migrations: [] };
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const newlyApplied = [];

    for (const file of files) {
      if (!applied.has(file)) {
        const filePath = path.join(this.migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        console.log(`[Migrator] Aplicando migración: ${file}...`);
        
        db.transaction(() => {
          db.exec(sql);
          db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
        });

        newlyApplied.push(file);
        console.log(`[Migrator] Migración ${file} aplicada con éxito.`);
      }
    }

    return {
      success: true,
      appliedCount: newlyApplied.length,
      migrations: newlyApplied
    };
  }
}

module.exports = new Migrator();
