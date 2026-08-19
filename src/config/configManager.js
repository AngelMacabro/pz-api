const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configDir = path.resolve(__dirname, '../../config');
    this.configFile = path.join(this.configDir, 'settings.json');
    this.defaultConfig = this.getDefaults();
    this.config = {};
    this.init();
  }

  getDefaults() {
    const userProfile = process.env.USERPROFILE || os.homedir();
    const appRoot = path.resolve(__dirname, '../../');

    return {
      // Dashboard settings
      dashboardPort: 3000,
      dashboardHost: '127.0.0.1',

      // Paths
      serverInstallDir: path.join(appRoot, 'pz_dedicated_server'),
      steamCmdDir: path.join(appRoot, 'steamcmd'),
      cacheDir: path.join(userProfile, 'Zomboid'),

      // Steam & Branch
      appId: '380870',
      branch: 'unstable', // 'unstable' is Build 42 beta branch, or '' for public release
      branchPassword: '',
      validateFiles: true,

      // Server Process & Hardware
      serverName: 'servertest',
      minRam: '2048m',
      maxRam: '6144m',
      adminPassword: 'adminpassword123',
      serverPassword: '',
      jvmArgs: '-XX:+UseZGC -XX:-CreateCoredumpOnCrash -XX:-OmitStackTraceInFastThrow',

      // Network & Game Info
      defaultPort: 16261,
      udpPort: 16262,
      maxPlayers: 16,
      publicName: 'Mi Servidor Project Zomboid (B42)',
      publicDescription: 'Servidor dedicado administrado con PZ Web Dashboard',
      openServer: true,
      pauseEmpty: true,
      pvp: true,
      spawnPoint: '0,0,0',
      upnp: true,

      // Mods & Workshop
      workshopItems: [], // e.g. ["2680473910", "2460154811"]
      mods: [],          // e.g. ["TrueActionsDancing", "AutoLoot"]

      // Monitoring
      autoRestartOnCrash: false,
      logRetentionDays: 7
    };
  }

  init() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = { ...this.defaultConfig, ...parsed };
      } else {
        this.config = { ...this.defaultConfig };
        this.save();
      }
    } catch (err) {
      console.error('[ConfigManager] Error initializing config:', err);
      this.config = { ...this.defaultConfig };
    }
  }

  get(key) {
    if (key) {
      return this.config[key] !== undefined ? this.config[key] : this.defaultConfig[key];
    }
    return { ...this.config };
  }

  set(keyOrObj, value) {
    if (typeof keyOrObj === 'object') {
      this.config = { ...this.config, ...keyOrObj };
    } else {
      this.config[keyOrObj] = value;
    }
    this.save();
    return this.config;
  }

  save() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[ConfigManager] Error saving config file:', err);
      return false;
    }
  }

  resetToDefaults() {
    this.config = { ...this.defaultConfig };
    this.save();
    return this.config;
  }
}

module.exports = new ConfigManager();
