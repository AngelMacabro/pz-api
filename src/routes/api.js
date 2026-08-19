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

// --- STATUS & METRICS ---
router.get('/status', (req, res) => {
  const status = pzProcessService.getState();
  res.json({ success: true, ...status });
});

router.get('/system-info', async (req, res) => {
  try {
    const status = pzProcessService.getState();
    const metrics = await systemService.getSystemMetrics(status.pid);
    res.json({ success: true, metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SERVER CONTROLS ---
router.post('/server/start', async (req, res) => {
  try {
    const result = await pzProcessService.start();
    res.json({ success: true, message: 'Iniciando servidor...', ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/stop', async (req, res) => {
  try {
    const force = req.body && req.body.force === true;
    const result = await pzProcessService.stop(force);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/restart', async (req, res) => {
  try {
    const result = await pzProcessService.restart();
    res.json({ success: true, message: 'Reiniciando servidor...', ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/kill', (req, res) => {
  try {
    const result = pzProcessService.kill();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/command', (req, res) => {
  try {
    const { command } = req.body;
    const result = pzProcessService.sendCommand(command);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- STEAMCMD ---
router.post('/server/install', async (req, res) => {
  try {
    // Start installation asynchronously in background
    steamcmdService.installOrUpdateServer(false).catch(err => {
      console.error('[SteamCMD Install Error]', err);
    });
    res.json({ success: true, message: 'Instalación iniciada con SteamCMD.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/update', async (req, res) => {
  try {
    steamcmdService.installOrUpdateServer(true).catch(err => {
      console.error('[SteamCMD Update Error]', err);
    });
    res.json({ success: true, message: 'Actualización iniciada con SteamCMD.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/server/cancel-steam', (req, res) => {
  const result = steamcmdService.cancel();
  res.json({ success: result });
});

// --- CONFIGURATION ---
router.get('/config', (req, res) => {
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

router.post('/config', (req, res) => {
  try {
    const newConfig = req.body;
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

    res.json({ success: true, config: savedConfig });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- MODS ---
router.get('/mods', (req, res) => {
  try {
    const data = modService.getMods();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mods', (req, res) => {
  try {
    const { workshopItems, mods } = req.body;
    const result = modService.saveMods(workshopItems, mods);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/mods/download-all', async (req, res) => {
  try {
    steamcmdService.downloadWorkshopMods().catch(err => {
      console.error('[SteamCMD Mod Download Error]', err);
    });
    res.json({ success: true, message: 'Descarga de mods de Workshop iniciada con SteamCMD.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/mods/parse', (req, res) => {
  try {
    const { text } = req.body;
    const result = modService.parseModText(text || '');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- RAW FILE EDITING ---
router.get('/files', (req, res) => {
  try {
    const files = pzConfigService.listConfigFiles();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/files/read', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Ruta no especificada' });
    }
    const content = pzConfigService.getRawFile(filePath);
    res.json({ success: true, content, path: filePath });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/files/save', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Parámetros incompletos' });
    }
    pzConfigService.saveRawFile(filePath, content);
    res.json({ success: true, message: 'Archivo guardado correctamente' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- LOGS ---
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  res.json({ success: true, logs: logService.getRecentLogs(limit) });
});

router.delete('/logs', (req, res) => {
  logService.clearBuffer();
  res.json({ success: true, message: 'Logs limpiados' });
});

module.exports = router;
