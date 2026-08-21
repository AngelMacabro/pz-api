const crypto = require('crypto');
const db = require('../db/database');
const userService = require('./userService');
const auditService = require('./auditService');

const DEFAULT_SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const COOKIE_NAME = 'pz_session';

class AuthService {
  constructor() {
    this.sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE_MS, 10) || DEFAULT_SESSION_MAX_AGE;
    this.cookieName = COOKIE_NAME;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async login(usernameOrEmail, password, { userAgent = null, ipAddress = null } = {}) {
    if (!usernameOrEmail || !password) {
      throw new Error('Debes proporcionar usuario y contraseña');
    }

    const authUser = userService.getUserByUsernameOrEmail(usernameOrEmail);
    if (!authUser) {
      auditService.log(null, usernameOrEmail, 'auth.login_failed', 'Usuario no encontrado', ipAddress);
      throw new Error('Credenciales incorrectas');
    }

    if (!authUser.is_active) {
      auditService.log(authUser.id, authUser.username, 'auth.login_blocked', 'Usuario desactivado', ipAddress);
      throw new Error('Esta cuenta ha sido desactivada. Contacta al administrador');
    }

    const isValid = await userService.verifyPassword(password, authUser.password_hash);
    if (!isValid) {
      auditService.log(authUser.id, authUser.username, 'auth.login_failed', 'Contraseña incorrecta', ipAddress);
      throw new Error('Credenciales incorrectas');
    }

    // Success: Create session
    const rawToken = this.generateSessionToken();
    const tokenHash = this.hashToken(rawToken);
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + this.sessionMaxAge;

    db.run(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, authUser.id, tokenHash, expiresAt, userAgent, ipAddress]
    );

    userService.updateLastLogin(authUser.id);
    auditService.log(authUser.id, authUser.username, 'auth.login_success', 'Inicio de sesión exitoso', ipAddress);

    const userWithPerms = userService.getUserWithPermissions(authUser.id);

    return {
      rawToken,
      expiresAt,
      user: userWithPerms
    };
  }

  validateSession(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = this.hashToken(rawToken);
    const now = Date.now();

    const session = db.get(
      'SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?',
      [tokenHash]
    );

    if (!session) return null;

    if (session.expires_at <= now) {
      // Expired session
      db.run('DELETE FROM sessions WHERE id = ?', [session.id]);
      return null;
    }

    const user = userService.getUserWithPermissions(session.user_id);
    if (!user || !user.is_active) {
      db.run('DELETE FROM sessions WHERE id = ?', [session.id]);
      return null;
    }

    // Update last activity periodically
    try {
      db.run(
        "UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?",
        [session.id]
      );
    } catch (e) {
      // ignore
    }

    return user;
  }

  logout(rawToken, { ipAddress = null } = {}) {
    if (!rawToken) return false;

    const tokenHash = this.hashToken(rawToken);
    const session = db.get('SELECT id, user_id FROM sessions WHERE token_hash = ?', [tokenHash]);

    if (session) {
      const user = userService.getUserById(session.user_id);
      db.run('DELETE FROM sessions WHERE id = ?', [session.id]);
      if (user) {
        auditService.log(user.id, user.username, 'auth.logout', 'Cierre de sesión', ipAddress);
      }
      return true;
    }

    return false;
  }

  invalidateAllUserSessions(userId) {
    db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  }

  cleanExpiredSessions() {
    const now = Date.now();
    const result = db.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
    return result ? result.changes : 0;
  }

  getCookieOptions() {
    const isSecure = process.env.COOKIE_SECURE === 'true' || 
                     (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');

    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: this.sessionMaxAge,
      path: '/'
    };
  }
}

module.exports = new AuthService();
