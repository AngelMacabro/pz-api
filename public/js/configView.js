/**
 * Configuration Form Controller
 */
class ConfigViewController {
  constructor() {
    this.form = document.getElementById('form-config');
    this.btnSave = document.getElementById('btn-save-config');
    this.init();
  }

  init() {
    if (this.btnSave) {
      this.btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveConfig();
      });
    }

    this.loadConfig();
  }

  async loadConfig() {
    try {
      const res = await API.getConfig();
      if (!res.success) return;

      const cfg = res.config || {};
      const ini = res.iniConfig || {};

      // General
      this.setVal('cfg-server-name', cfg.serverName || 'servertest');
      this.setVal('cfg-public-name', ini.PublicName || cfg.publicName || '');
      this.setVal('cfg-public-desc', ini.PublicDescription || cfg.publicDescription || '');
      this.setVal('cfg-max-players', ini.MaxPlayers || cfg.maxPlayers || 16);
      this.setVal('cfg-server-pwd', ini.Password || cfg.serverPassword || '');
      this.setVal('cfg-admin-pwd', cfg.adminPassword || '');

      this.setChecked('cfg-open-server', ini.Open !== undefined ? ini.Open === 'true' : cfg.openServer);
      this.setChecked('cfg-pvp', ini.PVP !== undefined ? ini.PVP === 'true' : cfg.pvp);
      this.setChecked('cfg-pause-empty', ini.PauseEmpty !== undefined ? ini.PauseEmpty === 'true' : cfg.pauseEmpty);

      // Hardware & Network
      this.setVal('cfg-min-ram', cfg.minRam || '2048m');
      this.setVal('cfg-max-ram', cfg.maxRam || '6144m');
      this.setVal('cfg-default-port', ini.DefaultPort || cfg.defaultPort || 16261);
      this.setVal('cfg-udp-port', ini.UDPPort || cfg.udpPort || 16262);
      this.setVal('cfg-jvm-args', cfg.jvmArgs || '');
      this.setChecked('cfg-upnp', ini.UPnP !== undefined ? ini.UPnP === 'true' : cfg.upnp);
      this.setChecked('cfg-autorestart', cfg.autoRestartOnCrash || false);

      // Paths
      this.setVal('cfg-server-dir', cfg.serverInstallDir || '');
      this.setVal('cfg-cache-dir', cfg.cacheDir || '');
      this.setVal('cfg-steamcmd-dir', cfg.steamCmdDir || '');
      this.setVal('cfg-branch', cfg.branch || 'unstable');

      // Update Dashboard Info Labels
      this.updateDashboardLabels(cfg, ini);
    } catch (err) {
      console.error('[ConfigView] Error loading config:', err);
    }
  }

  async saveConfig() {
    try {
      const data = {
        serverName: this.getVal('cfg-server-name'),
        publicName: this.getVal('cfg-public-name'),
        publicDescription: this.getVal('cfg-public-desc'),
        maxPlayers: parseInt(this.getVal('cfg-max-players'), 10) || 16,
        serverPassword: this.getVal('cfg-server-pwd'),
        adminPassword: this.getVal('cfg-admin-pwd'),
        openServer: this.getChecked('cfg-open-server'),
        pvp: this.getChecked('cfg-pvp'),
        pauseEmpty: this.getChecked('cfg-pause-empty'),

        minRam: this.getVal('cfg-min-ram'),
        maxRam: this.getVal('cfg-max-ram'),
        defaultPort: parseInt(this.getVal('cfg-default-port'), 10) || 16261,
        udpPort: parseInt(this.getVal('cfg-udp-port'), 10) || 16262,
        jvmArgs: this.getVal('cfg-jvm-args'),
        upnp: this.getChecked('cfg-upnp'),
        autoRestartOnCrash: this.getChecked('cfg-autorestart'),

        serverInstallDir: this.getVal('cfg-server-dir'),
        cacheDir: this.getVal('cfg-cache-dir'),
        steamCmdDir: this.getVal('cfg-steamcmd-dir'),
        branch: this.getVal('cfg-branch')
      };

      const res = await API.saveConfig(data);
      if (res.success) {
        if (window.App && window.App.showToast) {
          window.App.showToast('Configuración guardada y sincronizada correctamente', 'success');
        }
        this.updateDashboardLabels(res.config, {});
      }
    } catch (err) {
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error al guardar configuración: ${err.message}`, 'error');
      }
    }
  }

  updateDashboardLabels(cfg, ini) {
    const sName = cfg.serverName || 'servertest';
    const sidebarTag = document.getElementById('sidebar-server-name');
    if (sidebarTag) sidebarTag.textContent = sName;

    const dashSName = document.getElementById('dash-server-name');
    if (dashSName) dashSName.textContent = sName;

    const dashPubName = document.getElementById('dash-public-name');
    if (dashPubName) dashPubName.textContent = cfg.publicName || ini.PublicName || '-';

    const dashRam = document.getElementById('dash-ram-alloc');
    if (dashRam) dashRam.textContent = `${cfg.minRam || '2048m'} - ${cfg.maxRam || '6144m'}`;

    const dashMaxP = document.getElementById('dash-max-players');
    if (dashMaxP) dashMaxP.textContent = cfg.maxPlayers || ini.MaxPlayers || 16;

    const dashInstall = document.getElementById('dash-install-dir');
    if (dashInstall) dashInstall.textContent = cfg.serverInstallDir || '-';

    const dashCache = document.getElementById('dash-cache-dir');
    if (dashCache) dashCache.textContent = cfg.cacheDir || '-';

    const cardPorts = document.getElementById('card-ports-text');
    if (cardPorts) cardPorts.textContent = `${cfg.defaultPort || 16261} / ${cfg.udpPort || 16262}`;
  }

  getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  getChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }

  setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }
}
