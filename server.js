const fs = require('fs');
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Load .env environment variables if present
if (fs.existsSync('.env')) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch (e) {
      // ignore
    }
  } else {
    // Basic fallback parser for .env
    try {
      const envContent = fs.readFileSync('.env', 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim();
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      });
    } catch (e) {
      // ignore
    }
  }
}

const configManager = require('./src/config/configManager');
const migrator = require('./src/db/migrator');
const authService = require('./src/services/authService');
const apiRoutes = require('./src/routes/api');
const wsHandler = require('./src/websocket/wsHandler');
const logService = require('./src/services/logService');

// Run database migrations on boot
try {
  migrator.run();
} catch (err) {
  console.error('[Database Migration Error]', err);
}

// Clean expired sessions on startup and every hour
try {
  const cleaned = authService.cleanExpiredSessions();
  if (cleaned > 0) {
    console.log(`[AuthService] ${cleaned} sesiones expiradas limpiadas en el arranque.`);
  }
} catch (e) {
  // ignore
}
setInterval(() => {
  try {
    authService.cleanExpiredSessions();
  } catch (e) {
    // ignore
  }
}, 60 * 60 * 1000);

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize WebSocket
wsHandler.init(server);

// Start Server
const PORT = parseInt(process.env.PORT, 10) || configManager.get('dashboardPort') || 3000;
const HOST = process.env.HOST || configManager.get('dashboardHost') || '127.0.0.1';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('===============================================================');
    console.error(` [ERROR] El puerto ${PORT} ya está siendo utilizado por otro proceso.`);
    console.error(` Cierra la otra instancia o cambia "dashboardPort" en config/settings.json o PORT en .env.`);
    console.error('===============================================================');
  } else {
    console.error('[ServerError]', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  logService.log(`PZ Build 42 Dedicated Server Dashboard iniciado en http://${HOST}:${PORT}`, 'system', 'dashboard');
  console.log('===============================================================');
  console.log(' PROJECT ZOMBOID BUILD 42 - LOCAL SERVER DASHBOARD (RBAC ENABLED)');
  console.log(` Dashboard Web URL: http://${HOST}:${PORT}`);
  console.log('===============================================================');
});
