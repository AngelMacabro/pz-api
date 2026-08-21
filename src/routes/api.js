const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const configManager = require('../config/configManager');
const pzProcessService = require('../services/pzProcessService');
const steamcmdService = require('../services/steamcmdService');
const pzConfigService = require('../services/pzConfigService');
const modService = require('../services/modService');
const logService = require('../services/logService');
const systemService = require('../services/systemService');
const auditService = require('../services/auditService');
const { requirePermission } = require('../middleware/authMiddleware');

// Mount Sub-routers for Auth, Users, Roles, and Audit
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const auditRoutes = require('./auditRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/audit-logs', auditRoutes);

// --- STATUS & METRICS ---
router.get('/status', requirePermission('server.view'), (req, res) => {
  const status = pzProcessService.getState();
  res.json({ success: true, ...status });
});

router.get('/system-info', requirePermission('server.view'), async (req, res) => {
  try {
    const status = pzProcessService.getState();
    const metrics = await systemService.getSystemMetrics(status.pid);
    res.json({ success: true, metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SERVER CONTROLS ---
router.post('/server/start', requirePermission('server.start'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const result = await pzProcessService.start();

    auditService.log(
      req.user.id,
      req.user.username,
      'server.start',
      { pid: result.pid },
      ipAddress
    );

    res.json({ success: true, message: 'Iniciando servidor...', ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/stop', requirePermission('server.stop'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const force = req.body && req.body.force === true;
    const result = await pzProcessService.stop(force);

    auditService.log(
      req.user.id,
      req.user.username,
      force ? 'server.kill' : 'server.stop',
      { force },
      ipAddress
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/restart', requirePermission('server.restart'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const result = await pzProcessService.restart();

    auditService.log(
      req.user.id,
      req.user.username,
      'server.restart',
      {},
      ipAddress
    );

    res.json({ success: true, message: 'Reiniciando servidor...', ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/kill', requirePermission('server.stop'), (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const result = pzProcessService.kill();

    auditService.log(
      req.user.id,
      req.user.username,
      'server.kill',
      { forced: true },
      ipAddress
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/command', requirePermission('server.command'), (req, res) => {
  try {
    const { command } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const result = pzProcessService.sendCommand(command);

    auditService.log(
      req.user.id,
      req.user.username,
      'server.command',
      { command },
      ipAddress
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- STEAMCMD ---
router.post('/server/install', requirePermission('server.install'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    steamcmdService.installOrUpdateServer(false).catch(err => {
      console.error('[SteamCMD Install Error]', err);
    });

    auditService.log(
      req.user.id,
      req.user.username,
      'steamcmd.install',
      { action: 'install' },
      ipAddress
    );

    res.json({ success: true, message: 'Instalación iniciada con SteamCMD.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/update', requirePermission('server.install'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    steamcmdService.installOrUpdateServer(true).catch(err => {
      console.error('[SteamCMD Update Error]', err);
    });

    auditService.log(
      req.user.id,
      req.user.username,
      'steamcmd.update',
      { action: 'update' },
      ipAddress
    );

    res.json({ success: true, message: 'Actualización iniciada con SteamCMD.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/cancel-steam', requirePermission('server.install'), (req, res) => {
  const result = steamcmdService.cancel();
  res.json({ success: result });
});

// --- CONFIGURATION ---
router.get('/config', requirePermission('server.config.read'), (req, res) => {
  try {
    const dashboardConfig = configManager.get();
    let iniConfig = {};
    try {
      const parsed = pzConfigService.loadServerIni(dashboardConfig.serverName);
      iniConfig = parsed.data;
    } catch (e) {
      // ignore
    }
    res.json({ success: true, config: dashboardConfig, iniConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/config', requirePermission('server.config.write'), (req, res) => {
  try {
    const newConfig = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const savedConfig = configManager.set(newConfig);

    // Sync relevant fields to PZ .ini
    const iniFields = {};
    if (newConfig.publicName !== undefined) iniFields.PublicName = newConfig.publicName;
    if (newConfig.publicDescription !== undefined) iniFields.PublicDescription = newConfig.publicDescription;
    if (newConfig.serverPassword !== undefined) iniFields.Password = newConfig.serverPassword;
    if (newConfig.maxPlayers !== undefined) iniFields.MaxPlayers = newConfig.maxPlayers;
    if (newConfig.defaultPort !== undefined) iniFields.DefaultPort = newConfig.defaultPort;
    if (newConfig.udpPort !== undefined) iniFields.UDPPort = newConfig.udpPort;
    if (newConfig.openServer !== undefined) iniFields.Open = String(newConfig.openServer);
    if (newConfig.pauseEmpty !== undefined) iniFields.PauseEmpty = String(newConfig.pauseEmpty);
    if (newConfig.pvp !== undefined) iniFields.PVP = String(newConfig.pvp);
    if (newConfig.upnp !== undefined) iniFields.UPnP = String(newConfig.upnp);

    if (Object.keys(iniFields).length > 0) {
      pzConfigService.saveServerIni(iniFields, savedConfig.serverName);
    }

    auditService.log(
      req.user.id,
      req.user.username,
      'config.update',
      { updatedKeys: Object.keys(newConfig) },
      ipAddress
    );

    res.json({ success: true, config: savedConfig });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- MODS ---
router.get('/mods', requirePermission('mods.view'), (req, res) => {
  try {
    const data = modService.getMods();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mods', requirePermission('mods.manage'), (req, res) => {
  try {
    const { workshopItems, mods } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const result = modService.saveMods(workshopItems, mods);

    auditService.log(
      req.user.id,
      req.user.username,
      'mods.update',
      { workshopItemsCount: (workshopItems || []).length, modsCount: (mods || []).length },
      ipAddress
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/mods/download-all', requirePermission('mods.manage'), async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    steamcmdService.downloadWorkshopMods().catch(err => {
      console.error('[SteamCMD Mod Download Error]', err);
    });

    auditService.log(
      req.user.id,
      req.user.username,
      'mods.download_all',
      {},
      ipAddress
    );

    res.json({ success: true, message: 'Descarga de mods de Workshop iniciada con SteamCMD.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/mods/parse', requirePermission('mods.manage'), (req, res) => {
  try {
    const { text } = req.body;
    const result = modService.parseModText(text || '');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- RAW FILE EDITING ---
router.get('/files', requirePermission('files.read'), (req, res) => {
  try {
    const files = pzConfigService.listConfigFiles();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/files/read', requirePermission('files.read'), (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Ruta no especificada' });
    }
    if (!pzConfigService.isPathAllowed(filePath)) {
      return res.status(403).json({ success: false, error: 'Acceso denegado: la ruta solicitada no está permitida' });
    }
    const content = pzConfigService.getRawFile(filePath);
    res.json({ success: true, content, path: filePath });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/files/save', requirePermission('files.write'), (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || null;

    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Parámetros incompletos' });
    }
    if (!pzConfigService.isPathAllowed(filePath)) {
      return res.status(403).json({ success: false, error: 'Acceso denegado: no se puede guardar fuera del directorio permitido' });
    }

    pzConfigService.saveRawFile(filePath, content);

    auditService.log(
      req.user.id,
      req.user.username,
      'files.save',
      { path: filePath },
      ipAddress
    );

    res.json({ success: true, message: 'Archivo guardado correctamente' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- LOGS ---
router.get('/logs', requirePermission('logs.view'), (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  res.json({ success: true, logs: logService.getRecentLogs(limit) });
});

router.delete('/logs', requirePermission('logs.clear'), (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress || null;
  logService.clearBuffer();

  auditService.log(
    req.user.id,
    req.user.username,
    'logs.clear',
    {},
    ipAddress
  );

  res.json({ success: true, message: 'Logs limpiados' });
});

module.exports = router;
