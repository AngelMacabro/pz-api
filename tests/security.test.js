const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const testDbPath = path.resolve(__dirname, '../data/test_security.db');
process.env.DB_PATH = testDbPath;

const db = require('../src/db/database');
const migrator = require('../src/db/migrator');
const userService = require('../src/services/userService');
const authService = require('../src/services/authService');
const pzConfigService = require('../src/services/pzConfigService');

test.before(async () => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  db.init(testDbPath);
  migrator.run();

  await userService.createUser({
    username: 'solitary_admin',
    email: 'admin@sec.local',
    password: 'Password123!',
    roleNames: ['admin']
  });
});

test.after(() => {
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

test('Security - Data Sanitization & Critical Guarantees', async (t) => {
  await t.test('User objects returned by service never contain password_hash or password', () => {
    const user = userService.getUserWithPermissions(1);
    assert.equal(user.password_hash, undefined);
    assert.equal(user.password, undefined);

    const list = userService.listUsers();
    for (const u of list) {
      assert.equal(u.password_hash, undefined);
      assert.equal(u.password, undefined);
    }
  });

  await t.test('Prevents deleting the last remaining active admin', () => {
    assert.throws(() => {
      userService.deleteUser(1);
    }, /no se puede eliminar ni desactivar al único administrador activo/);
  });

  await t.test('Prevents deactivating the last remaining active admin', async () => {
    await assert.rejects(async () => {
      await userService.updateUser(1, { isActive: false });
    }, /no se puede eliminar ni desactivar al único administrador activo/);
  });

  await t.test('Allows deleting an admin when another active admin exists', async () => {
    const secondAdmin = await userService.createUser({
      username: 'second_admin',
      email: 'admin2@sec.local',
      password: 'Password123!',
      roleNames: ['admin']
    });

    // Now deleting the second admin is permitted
    const res = userService.deleteUser(secondAdmin.id);
    assert.equal(res.success, true);
  });

  await t.test('Path Traversal & Config Confinement Security', () => {
    const serverDir = pzConfigService.getServerDir();
    const validPath = path.join(serverDir, 'servertest.ini');
    assert.equal(pzConfigService.isPathAllowed(validPath), true);

    // Disallowed extensions
    assert.equal(pzConfigService.isPathAllowed(path.join(serverDir, 'malicious.exe')), false);
    assert.equal(pzConfigService.isPathAllowed(path.join(serverDir, 'script.bat')), false);

    // Path traversal attempts
    const traversalPath1 = path.resolve(__dirname, '../server.js');
    assert.equal(pzConfigService.isPathAllowed(traversalPath1), false);
    assert.throws(() => {
      pzConfigService.getRawFile(traversalPath1);
    }, /Acceso denegado/);

    const traversalPath2 = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    assert.equal(pzConfigService.isPathAllowed(traversalPath2), false);
  });

  await t.test('Session Expiration & Auto Cleanup', async () => {
    // Manually insert an expired session
    const expiredTokenHash = 'expired_token_hash_123';
    db.run(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at) 
       VALUES ('test-expired-uuid', 1, ?, ?)`,
      [expiredTokenHash, Date.now() - 10000]
    );

    const beforeClean = db.get('SELECT * FROM sessions WHERE token_hash = ?', [expiredTokenHash]);
    assert.ok(beforeClean);

    const cleanedCount = authService.cleanExpiredSessions();
    assert.ok(cleanedCount >= 1);

    const afterClean = db.get('SELECT * FROM sessions WHERE token_hash = ?', [expiredTokenHash]);
    assert.equal(afterClean, undefined);
  });
});
