/**
 * API Client for PZ Dedicated Server Dashboard with Auth & RBAC Handling
 */
const API = {
  async fetchWithAuth(url, options = {}) {
    const defaultHeaders = {
      'Accept': 'application/json'
    };

    if (options.body && typeof options.body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config = {
      credentials: 'include', // Always send and receive cookies
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({ success: false, error: 'Respuesta no válida del servidor' }));

      // Handle 401 Unauthorized globally
      if (res.status === 401) {
        if (typeof authManager !== 'undefined') {
          authManager.setUser(null);
          // If not checking /api/auth/me, prompt login modal
          if (!url.includes('/api/auth/me')) {
            authManager.showLoginModal();
            if (window.App && window.App.showToast) {
              window.App.showToast('Sesión requerida o expirada. Por favor, inicia sesión.', 'warn');
            }
          }
        }
      }

      // Handle 403 Forbidden globally
      if (res.status === 403) {
        if (window.App && window.App.showToast) {
          window.App.showToast(data.error || 'Acceso denegado: permisos insuficientes para esta acción.', 'error');
        }
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${options.method || 'GET'} ${url}:`, err);
      throw err;
    }
  },

  // --- AUTHENTICATION ---
  async authMe() {
    return this.fetchWithAuth('/api/auth/me');
  },

  async authLogin(username, password) {
    return this.fetchWithAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async authRegister(username, email, password) {
    return this.fetchWithAuth('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },

  async authLogout() {
    return this.fetchWithAuth('/api/auth/logout', { method: 'POST' });
  },

  // --- USERS MANAGEMENT ---
  async getUsers(limit = 50, offset = 0) {
    return this.fetchWithAuth(`/api/users?limit=${limit}&offset=${offset}`);
  },

  async getUser(id) {
    return this.fetchWithAuth(`/api/users/${id}`);
  },

  async createUser(userData) {
    return this.fetchWithAuth('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(id, userData) {
    return this.fetchWithAuth(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(id) {
    return this.fetchWithAuth(`/api/users/${id}`, { method: 'DELETE' });
  },

  // --- ROLES & PERMISSIONS ---
  async getRoles() {
    return this.fetchWithAuth('/api/roles');
  },

  async getPermissions() {
    return this.fetchWithAuth('/api/roles/permissions');
  },

  async createRole(roleData) {
    return this.fetchWithAuth('/api/roles', {
      method: 'POST',
      body: JSON.stringify(roleData)
    });
  },

  async updateRole(id, roleData) {
    return this.fetchWithAuth(`/api/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(roleData)
    });
  },

  async deleteRole(id) {
    return this.fetchWithAuth(`/api/roles/${id}`, { method: 'DELETE' });
  },

  // --- AUDIT LOGS ---
  async getAuditLogs(limit = 100, offset = 0) {
    return this.fetchWithAuth(`/api/audit-logs?limit=${limit}&offset=${offset}`);
  },

  // --- STATUS & METRICS ---
  async getStatus() {
    return this.fetchWithAuth('/api/status');
  },

  async getSystemInfo() {
    return this.fetchWithAuth('/api/system-info');
  },

  // --- SERVER CONTROLS ---
  async startServer() {
    return this.fetchWithAuth('/api/server/start', { method: 'POST' });
  },

  async stopServer(force = false) {
    return this.fetchWithAuth('/api/server/stop', {
      method: 'POST',
      body: JSON.stringify({ force })
    });
  },

  async restartServer() {
    return this.fetchWithAuth('/api/server/restart', { method: 'POST' });
  },

  async killServer() {
    return this.fetchWithAuth('/api/server/kill', { method: 'POST' });
  },

  async sendCommand(command) {
    return this.fetchWithAuth('/api/server/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    });
  },

  // --- STEAMCMD ---
  async installServer() {
    return this.fetchWithAuth('/api/server/install', { method: 'POST' });
  },

  async updateServer() {
    return this.fetchWithAuth('/api/server/update', { method: 'POST' });
  },

  async cancelSteam() {
    return this.fetchWithAuth('/api/server/cancel-steam', { method: 'POST' });
  },

  // --- CONFIGURATION ---
  async getConfig() {
    return this.fetchWithAuth('/api/config');
  },

  async saveConfig(configData) {
    return this.fetchWithAuth('/api/config', {
      method: 'POST',
      body: JSON.stringify(configData)
    });
  },

  // --- MODS ---
  async getMods() {
    return this.fetchWithAuth('/api/mods');
  },

  async saveMods(workshopItems, mods) {
    return this.fetchWithAuth('/api/mods', {
      method: 'POST',
      body: JSON.stringify({ workshopItems, mods })
    });
  },

  async downloadAllMods() {
    return this.fetchWithAuth('/api/mods/download-all', { method: 'POST' });
  },

  async parseModText(text) {
    return this.fetchWithAuth('/api/mods/parse', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  // --- RAW FILE EDITING ---
  async getFilesList() {
    return this.fetchWithAuth('/api/files');
  },

  async readFile(filePath) {
    return this.fetchWithAuth(`/api/files/read?path=${encodeURIComponent(filePath)}`);
  },

  async saveFile(filePath, content) {
    return this.fetchWithAuth('/api/files/save', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content })
    });
  },

  // --- LOGS ---
  async getLogs(limit = 500) {
    return this.fetchWithAuth(`/api/logs?limit=${limit}`);
  },

  async clearLogs() {
    return this.fetchWithAuth('/api/logs', { method: 'DELETE' });
  }
};
