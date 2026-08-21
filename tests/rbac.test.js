const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const testDbPath = path.resolve(__dirname, '../data/test_rbac.db');
process.env.DB_PATH = testDbPath;

const db = require('../src/db/database');
const migrator = require('../src/db/migrator');
const userService = require('../src/services/userService');
const authService = require('../src/services/authService');
const { hasPermission } = require('../src/middleware/authMiddleware');

test.before(async () => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  db.init(testDbPath);
  migrator.run();

  // Seed test users for each role
  await userService.createUser({
    username: 'admin_test',
    email: 'admin_test@test.local',
    password: 'Password123!',
    roleNames: ['admin']
  });

  await userService.createUser({
    username: 'operator_test',
    email: 'operator_test@test.local',
    password: 'Password123!',
    roleNames: ['operator']
  });

  await userService.createUser({
    username: 'analyst_test',
    email: 'analyst_test@test.local',
    password: 'Password123!',
    roleNames: ['analyst']
  });

  await userService.createUser({
    username: 'viewer_test',
    email: 'viewer_test@test.local',
    password: 'Password123!',
    roleNames: ['viewer']
  });
});

test.after(() => {
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

test('RBAC - Permission Evaluation & Wildcards', async (t) => {
  await t.test('Wildcard "*" grants all permissions', () => {
    assert.equal(hasPermission(['*'], 'server.start'), true);
    assert.equal(hasPermission(['*'], 'users.manage'), true);
    assert.equal(hasPermission(['*'], 'nonexistent.permission'), true);
  });

  await t.test('Category wildcard "mods.*" grants all mod operations', () => {
    const userPerms = ['mods.*', 'server.view'];
    assert.equal(hasPermission(userPerms, 'mods.view'), true);
    assert.equal(hasPermission(userPerms, 'mods.manage'), true);
    assert.equal(hasPermission(userPerms, 'server.view'), true);
    assert.equal(hasPermission(userPerms, 'server.start'), false);
  });

  await t.test('Specific permissions only grant exact matches', () => {
    const userPerms = ['server.view', 'logs.view'];
    assert.equal(hasPermission(userPerms, 'server.view'), true);
    assert.equal(hasPermission(userPerms, 'logs.view'), true);
    assert.equal(hasPermission(userPerms, 'server.start'), false);
    assert.equal(hasPermission(userPerms, 'users.manage'), false);
  });
});

test('RBAC - Role Permissions Matrix Verification', async (t) => {
  const adminUser = userService.getUserWithPermissions(1); // admin_test
  const operatorUser = userService.getUserWithPermissions(2); // operator_test
  const analystUser = userService.getUserWithPermissions(3); // analyst_test
  const viewerUser = userService.getUserWithPermissions(4); // viewer_test

  await t.test('Admin role has access to everything via "*"', () => {
    assert.ok(adminUser.permissions.includes('*'));
    assert.equal(hasPermission(adminUser.permissions, 'users.manage'), true);
    assert.equal(hasPermission(adminUser.permissions, 'server.start'), true);
    assert.equal(hasPermission(adminUser.permissions, 'roles.manage'), true);
  });

  await t.test('Operator role can manage server and mods, but NOT users or roles', () => {
    assert.equal(hasPermission(operatorUser.permissions, 'server.start'), true);
    assert.equal(hasPermission(operatorUser.permissions, 'server.stop'), true);
    assert.equal(hasPermission(operatorUser.permissions, 'mods.manage'), true);
    assert.equal(hasPermission(operatorUser.permissions, 'server.config.write'), true);
    
    // Forbidden for operator:
    assert.equal(hasPermission(operatorUser.permissions, 'users.manage'), false);
    assert.equal(hasPermission(operatorUser.permissions, 'roles.manage'), false);
    assert.equal(hasPermission(operatorUser.permissions, 'logs.clear'), false);
  });

  await t.test('Analyst role can view server and logs, but cannot start/stop or modify', () => {
    assert.equal(hasPermission(analystUser.permissions, 'server.view'), true);
    assert.equal(hasPermission(analystUser.permissions, 'logs.view'), true);

    // Forbidden for analyst:
    assert.equal(hasPermission(analystUser.permissions, 'server.start'), false);
    assert.equal(hasPermission(analystUser.permissions, 'server.stop'), false);
    assert.equal(hasPermission(analystUser.permissions, 'mods.manage'), false);
    assert.equal(hasPermission(analystUser.permissions, 'server.config.write'), false);
  });

  await t.test('Viewer role has only basic server.view read access', () => {
    assert.equal(hasPermission(viewerUser.permissions, 'server.view'), true);

    // Forbidden for viewer:
    assert.equal(hasPermission(viewerUser.permissions, 'logs.view'), false);
    assert.equal(hasPermission(viewerUser.permissions, 'server.start'), false);
    assert.equal(hasPermission(viewerUser.permissions, 'files.read'), false);
  });
});
