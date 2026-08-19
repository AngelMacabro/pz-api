const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const configManager = require('./src/config/configManager');
const apiRoutes = require('./src/routes/api');
const wsHandler = require('./src/websocket/wsHandler');
const logService = require('./src/services/logService');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
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
const PORT = configManager.get('dashboardPort') || 3000;
const HOST = configManager.get('dashboardHost') || '127.0.0.1';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('===============================================================');
    console.error(` [ERROR] El puerto ${PORT} ya está siendo utilizado por otro proceso.`);
    console.error(` Cierra la otra instancia o cambia "dashboardPort" en config/settings.json.`);
    console.error('===============================================================');
  } else {
    console.error('[ServerError]', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  logService.log(`PZ Build 42 Dedicated Server Dashboard iniciado en http://${HOST}:${PORT}`, 'system', 'dashboard');
  console.log('===============================================================');
  console.log(' PROJECT ZOMBOID BUILD 42 - LOCAL SERVER DASHBOARD');
  console.log(` Dashboard Web URL: http://${HOST}:${PORT}`);
  console.log('===============================================================');
});

