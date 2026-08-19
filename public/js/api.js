/**
 * API Client for PZ Dedicated Server Dashboard
 */
const API = {
  async getStatus() {
    const res = await fetch('/api/status');
    return res.json();
  },

  async getSystemInfo() {
    const res = await fetch('/api/system-info');
    return res.json();
  },

  async startServer() {
    const res = await fetch('/api/server/start', { method: 'POST' });
    return res.json();
  },

  async stopServer(force = false) {
    const res = await fetch('/api/server/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force })
    });
    return res.json();
  },

  async restartServer() {
    const res = await fetch('/api/server/restart', { method: 'POST' });
    return res.json();
  },

  async killServer() {
    const res = await fetch('/api/server/kill', { method: 'POST' });
    return res.json();
  },

  async sendCommand(command) {
    const res = await fetch('/api/server/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return res.json();
  },

  async installServer() {
    const res = await fetch('/api/server/install', { method: 'POST' });
    return res.json();
  },

  async updateServer() {
    const res = await fetch('/api/server/update', { method: 'POST' });
    return res.json();
  },

  async cancelSteam() {
    const res = await fetch('/api/server/cancel-steam', { method: 'POST' });
    return res.json();
  },

  async getConfig() {
    const res = await fetch('/api/config');
    return res.json();
  },

  async saveConfig(configData) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });
    return res.json();
  },

  async getMods() {
    const res = await fetch('/api/mods');
    return res.json();
  },

  async saveMods(workshopItems, mods) {
    const res = await fetch('/api/mods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopItems, mods })
    });
    return res.json();
  },

  async downloadAllMods() {
    const res = await fetch('/api/mods/download-all', { method: 'POST' });
    return res.json();
  },

  async parseModText(text) {
    const res = await fetch('/api/mods/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return res.json();
  },

  async getFilesList() {
    const res = await fetch('/api/files');
    return res.json();
  },

  async readFile(filePath) {
    const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
    return res.json();
  },

  async saveFile(filePath, content) {
    const res = await fetch('/api/files/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content })
    });
    return res.json();
  },

  async getLogs(limit = 500) {
    const res = await fetch(`/api/logs?limit=${limit}`);
    return res.json();
  },

  async clearLogs() {
    const res = await fetch('/api/logs', { method: 'DELETE' });
    return res.json();
  }
};
