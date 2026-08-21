const db = require('../db/database');

class AuditService {
  log(userId, username, action, details = null, ipAddress = null) {
    try {
      const detailsStr = typeof details === 'object' && details !== null 
        ? JSON.stringify(details) 
        : (details ? String(details) : null);

      db.run(
        `INSERT INTO audit_logs (user_id, username, action, details, ip_address) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId || null, username || null, action, detailsStr, ipAddress || null]
      );
    } catch (err) {
      console.error('[AuditService] Error registrando auditoría:', err);
    }
  }

  getLogs(limit = 100, offset = 0) {
    return db.query(
      `SELECT id, user_id, username, action, details, ip_address, created_at 
       FROM audit_logs 
       ORDER BY id DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  count() {
    const row = db.get('SELECT COUNT(*) as total FROM audit_logs');
    return row ? row.total : 0;
  }
}

module.exports = new AuditService();
