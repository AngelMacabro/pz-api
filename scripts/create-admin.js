#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const migrator = require('../src/db/migrator');
const userService = require('../src/services/userService');
const db = require('../src/db/database');

// Ensure database is initialized & migrated
migrator.run();

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) {
      parsed.username = args[++i];
    } else if (args[i] === '--email' && args[i + 1]) {
      parsed.email = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      parsed.password = args[++i];
    }
  }
  return parsed;
}

const { Writable } = require('stream');

function prompt(question, isPassword = false) {
  let muted = false;
  const mutableStdout = new Writable({
    write: function(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      if (isPassword) {
        process.stdout.write('\n');
      }
      resolve(ans.trim());
    });
    if (isPassword) {
      muted = true;
    }
  });
}

async function main() {
  console.log('===============================================================');
  console.log(' CREACIÓN DE USUARIO ADMINISTRADOR - PZ SERVER DASHBOARD');
  console.log('===============================================================\n');

  const cliArgs = parseArgs();
  const envUsername = process.env.ADMIN_USERNAME;
  const envEmail = process.env.ADMIN_EMAIL;
  const envPassword = process.env.ADMIN_PASSWORD;

  let username = cliArgs.username || envUsername;
  let email = cliArgs.email || envEmail;
  let password = cliArgs.password || envPassword;

  if (!username) {
    username = await prompt('Nombre de usuario (ej. admin): ');
  }

  if (!email) {
    email = await prompt('Correo electrónico (ej. admin@pzserver.local): ');
  }

  if (!password) {
    password = await prompt('Contraseña (mínimo 6 caracteres): ', true);
  }

  if (!username || username.length < 3) {
    console.error('\n[ERROR] El nombre de usuario debe tener al menos 3 caracteres.');
    process.exit(1);
  }

  if (!email || !email.includes('@')) {
    console.error('\n[ERROR] Debes ingresar un correo electrónico válido.');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('\n[ERROR] La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  try {
    const existing = db.get(
      'SELECT id, username, email FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE',
      [username, email]
    );

    if (existing) {
      console.log(`\nEl usuario '${existing.username}' ya existe (ID: ${existing.id}). Actualizando contraseña y rol admin...`);
      await userService.updateUser(existing.id, {
        email,
        password,
        isActive: 1,
        roleNames: ['admin']
      });
      console.log(`[OK] Contraseña y permisos de administrador actualizados con éxito para '${existing.username}'.`);
    } else {
      const user = await userService.createUser({
        username,
        email,
        password,
        roleNames: ['admin'],
        isActive: 1
      });
      console.log(`\n[OK] ¡Usuario Administrador '${user.username}' creado con éxito! (ID: ${user.id})`);
    }

    console.log('\nAhora puedes iniciar sesión en el dashboard con estas credenciales.');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[ERROR]', err.message);
    process.exit(1);
  }
}

main();
