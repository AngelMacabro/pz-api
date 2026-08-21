const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Use isolated in-memory or test database
const testDbPath = path.resolve(__dirname, '../data/test_auth.db');
process.env.DB_PATH = testDbPath;

const db = require('../src/db/database');
const migrator = require('../src/db/migrator');
const userService = require('../src/services/userService');
const authService = require('../src/services/authService');

test.before(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  db.init(testDbPath);
  migrator.run();
});

test.after(() => {
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

test('Auth Service - User creation, password hashing and verification', async (t) => {
  await t.test('Creates user with properly hashed password (not plain text)', async () => {
    const user = await userService.createUser({
      username: 'testpilot',
      email: 'testpilot@example.com',
      password: 'SuperSecret123!',
      roleNames: ['viewer']
    });

    assert.ok(user.id);
    assert.equal(user.username, 'testpilot');
    assert.equal(user.email, 'testpilot@example.com');
    assert.equal(user.password_hash, undefined, 'password_hash must be sanitized');

    // Verify in raw DB that password is not plain text
    const raw = db.get('SELECT password_hash FROM users WHERE id = ?', [user.id]);
    assert.ok(raw.password_hash.startsWith('$2'), 'Must be a valid bcrypt hash');
    assert.notEqual(raw.password_hash, 'SuperSecret123!');
  });

  await t.test('Fails on short username or password', async () => {
    await assert.rejects(async () => {
      await userService.createUser({
        username: 'ab',
        email: 'valid@example.com',
        password: '123456'
      });
    }, /al menos 3 caracteres/);

    await assert.rejects(async () => {
      await userService.createUser({
        username: 'validuser',
        email: 'valid@example.com',
        password: '123'
      });
    }, /al menos 6 caracteres/);
  });
});

test('Auth Service - Login, Session Creation & Expiration', async (t) => {
  // Create user for test
  await userService.createUser({
    username: 'logintester',
    email: 'logintester@example.com',
    password: 'Password123!',
    roleNames: ['operator']
  });

  await t.test('Successful login returns session token and user details', async () => {
    const result = await authService.login('logintester', 'Password123!', {
      userAgent: 'TestAgent/1.0',
      ipAddress: '127.0.0.1'
    });

    assert.ok(result.rawToken);
    assert.ok(result.expiresAt > Date.now());
    assert.equal(result.user.username, 'logintester');
    assert.deepEqual(result.user.roles, ['operator']);

    // Validate session
    const validated = authService.validateSession(result.rawToken);
    assert.ok(validated);
    assert.equal(validated.id, result.user.id);
  });

  await t.test('Fails login with invalid password', async () => {
    await assert.rejects(async () => {
      await authService.login('logintester', 'WrongPassword!');
    }, /Credenciales incorrectas/);
  });

  await t.test('Fails login with non-existent user', async () => {
    await assert.rejects(async () => {
      await authService.login('nobody_here', 'AnyPassword123');
    }, /Credenciales incorrectas/);
  });

  await t.test('Logout invalidates active session', async () => {
    const { rawToken } = await authService.login('logintester', 'Password123!');
    assert.ok(authService.validateSession(rawToken));

    const logoutResult = authService.logout(rawToken);
    assert.equal(logoutResult, true);

    const afterLogout = authService.validateSession(rawToken);
    assert.equal(afterLogout, null, 'Session must be null after logout');
  });

  await t.test('Deactivated user cannot log in and existing session is invalidated', async () => {
    const deactUser = await userService.createUser({
      username: 'deactivated_user',
      email: 'deact@example.com',
      password: 'Password123!',
      roleNames: ['viewer']
    });

    const { rawToken } = await authService.login('deactivated_user', 'Password123!');
    assert.ok(authService.validateSession(rawToken));

    // Deactivate user
    await userService.updateUser(deactUser.id, { isActive: false });

    // Session validation should now fail and purge the session
    const valid = authService.validateSession(rawToken);
    assert.equal(valid, null);

    // New login attempts should fail
    await assert.rejects(async () => {
      await authService.login('deactivated_user', 'Password123!');
    }, /desactivada/);
  });
});
