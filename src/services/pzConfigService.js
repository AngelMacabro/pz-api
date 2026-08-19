const fs = require('fs');
const path = require('path');
const configManager = require('../config/configManager');
const logService = require('./logService');

class PzConfigService {
  getServerDir() {
    const cacheDir = configManager.get('cacheDir');
    return path.join(cacheDir, 'Server');
  }

  ensureServerDir() {
    const sDir = this.getServerDir();
    if (!fs.existsSync(sDir)) {
      fs.mkdirSync(sDir, { recursive: true });
    }
    return sDir;
  }

  getIniPath(serverName = null) {
    const name = serverName || configManager.get('serverName');
    return path.join(this.getServerDir(), `${name}.ini`);
  }

  getSandboxPath(serverName = null) {
    const name = serverName || configManager.get('serverName');
    return path.join(this.getServerDir(), `${name}_SandboxVars.lua`);
  }

  getSpawnRegionsPath(serverName = null) {
    const name = serverName || configManager.get('serverName');
    return path.join(this.getServerDir(), `${name}_spawnregions.lua`);
  }

  // Parse .ini into key-value map while preserving line structure for writing
  parseIni(iniContent) {
    const lines = iniContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const data = {};
    const parsedLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.length === 0) {
        parsedLines.push({ type: 'comment_or_empty', raw: line });
      } else {
        const eqIdx = line.indexOf('=');
        if (eqIdx !== -1) {
          const key = line.substring(0, eqIdx).trim();
          const value = line.substring(eqIdx + 1).trim();
          data[key] = value;
          parsedLines.push({ type: 'key_value', key, value, raw: line });
        } else {
          parsedLines.push({ type: 'other', raw: line });
        }
      }
    }

    return { data, lines: parsedLines };
  }

  // Write updated data back to INI preserving comments and ordering
  stringifyIni(parsedLines, updatedData) {
    const seenKeys = new Set();
    const resultLines = [];

    for (const item of parsedLines) {
      if (item.type === 'key_value') {
        const key = item.key;
        seenKeys.add(key);
        if (updatedData[key] !== undefined) {
          resultLines.push(`${key}=${updatedData[key]}`);
        } else {
          resultLines.push(item.raw);
        }
      } else {
        resultLines.push(item.raw);
      }
    }

    // Append any newly added keys not in original file
    for (const [key, value] of Object.entries(updatedData)) {
      if (!seenKeys.has(key)) {
        resultLines.push(`${key}=${value}`);
      }
    }

    return resultLines.join('\r\n');
  }

  loadServerIni(serverName = null) {
    const iniPath = this.getIniPath(serverName);
    if (!fs.existsSync(iniPath)) {
      this.createDefaultIni(serverName);
    }
    const content = fs.readFileSync(iniPath, 'utf-8');
    return this.parseIni(content);
  }

  saveServerIni(updatedFields, serverName = null) {
    this.ensureServerDir();
    const iniPath = this.getIniPath(serverName);
    let parsed;

    if (fs.existsSync(iniPath)) {
      // Create backup
      const backupPath = `${iniPath}.bak`;
      try {
        fs.copyFileSync(iniPath, backupPath);
      } catch (e) {
        // ignore
      }
      const existing = fs.readFileSync(iniPath, 'utf-8');
      parsed = this.parseIni(existing);
    } else {
      this.createDefaultIni(serverName);
      const existing = fs.readFileSync(iniPath, 'utf-8');
      parsed = this.parseIni(existing);
    }

    const merged = { ...parsed.data, ...updatedFields };
    const newContent = this.stringifyIni(parsed.lines, merged);
    fs.writeFileSync(iniPath, newContent, 'utf-8');
    return merged;
  }

  getRawFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo no existe: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveRawFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, `${filePath}.bak`);
      } catch (e) {
        // ignore
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  createDefaultIni(serverName = null) {
    this.ensureServerDir();
    const name = serverName || configManager.get('serverName');
    const iniPath = path.join(this.getServerDir(), `${name}.ini`);

    if (fs.existsSync(iniPath)) return;

    const defaultIni = `# Configuración del servidor Project Zomboid Build 42
PVP=true
PVPLogToolChat=true
PVPLogToolFile=true
PauseEmpty=true
GlobalChat=true
ChatStreams=s,r,a,w,y,sh,f,all
Open=true
ServerWelcomeMessage=Bienvenido al servidor de Project Zomboid Build 42! <LINE> <LINE> Panel web activo. <LINE> ¡Buena suerte sobreviviendo!
DisplayUserName=true
ShowFirstAndLastName=false
UsernameDisguises=false
HideDisguisedUserName=false
SpawnPoint=0,0,0
SafetySystem=true
ShowSafety=true
SafetyToggleTimer=2
SafetyCooldownTimer=3
DefaultPort=16261
UDPPort=16262
ResetID=1737134
Mods=
Map=Muldraugh, KY
DoLuaChecksum=true
DenyLoginOnOverloadedServer=true
Public=true
PublicName=Mi Servidor Project Zomboid (B42)
PublicDescription=Servidor dedicado Build 42
MaxPlayers=16
PingLimit=0
SafehousePreventsLootRespawn=true
DropOffWhiteListAfterDeath=false
NoFire=false
AnnounceDeath=true
AnnounceAnimalDeath=false
SaveWorldEveryMinutes=0
PlayerSafehouse=false
AdminSafehouse=false
SafehouseAllowTrepass=true
SafehouseAllowFire=true
SafehouseAllowLoot=true
Password=
MaxAccountsPerUser=3
AllowCoop=true
SleepAllowed=false
SleepNeeded=false
WorkshopItems=
SteamScoreboard=true
SteamVAC=true
UPnP=true
VoiceEnable=true
VoiceMinDistance=10.0
VoiceMaxDistance=100.0
Voice3D=true
SpeedLimit=70.0
LoginQueueEnabled=false
LoginQueueConnectTimeout=60
PlayerRespawnWithSelf=false
PlayerRespawnWithOther=false
AntiCheatPermission=2
AntiCheatXP=2
AntiCheatSafeHouse=2
AntiCheatPlayer=2
AntiCheatChecksum=2
MultiplayerStatisticsPeriod=1
DisableScoreboard=false
HideAdminsInPlayerList=false
MaxPacketsPerSecond=300
ShowCoordinates=false
ChatMessageCharacterLimit=200
ChatMessageSlowModeTime=3
`;

    fs.writeFileSync(iniPath, defaultIni, 'utf-8');
    logService.log(`Archivo de configuración creado: ${iniPath}`, 'system', 'dashboard');
    this.createDefaultSandbox(name);
  }

  createDefaultSandbox(serverName) {
    const sPath = path.join(this.getServerDir(), `${serverName}_SandboxVars.lua`);
    if (fs.existsSync(sPath)) return;

    const defaultSandbox = `SandboxVars = {
    VERSION = 6,
    Speed = 3,
    Zombies = 3,
    Distribution = 1,
    DayLength = 3,
    StartYear = 1,
    StartMonth = 7,
    StartDay = 9,
    StartTime = 2,
    WaterShut = 2,
    ElecShut = 2,
    WaterShutModifier = 14,
    ElecShutModifier = 14,
    FoodLoot = 2,
    CannedFoodLoot = 2,
    LiteratureLoot = 2,
    SurvivalGearsLoot = 2,
    MedicalLoot = 2,
    WeaponLoot = 2,
    RangedWeaponLoot = 2,
    AmmoLoot = 2,
    MechanicsLoot = 2,
    OtherLoot = 2,
    Temperature = 3,
    Rain = 3,
    ErosionSpeed = 3,
    ErosionDays = 0,
    ZombieLore = {
        Speed = 2,
        Strength = 2,
        Toughness = 2,
        Transmission = 1,
        Mortality = 5,
        Reanimate = 3,
        Cognition = 3,
        CrawlUnderVehicle = 5,
        Memory = 3,
        Decomp = 1,
        Sight = 2,
        Hearing = 2,
        Smell = 2,
        ThumpNoChasing = false,
        ThumpOnConstruction = true,
        ActiveOnly = 1,
        TriggerHouseAlarm = false,
        ZombiesDragDown = true,
        ZombiesFenceLunge = true,
    }
}
`;
    fs.writeFileSync(sPath, defaultSandbox, 'utf-8');
  }

  listConfigFiles(serverName = null) {
    const name = serverName || configManager.get('serverName');
    const sDir = this.getServerDir();
    this.ensureServerDir();

    const candidates = [
      { name: `${name}.ini`, type: 'ini', path: this.getIniPath(name), label: 'Configuración del Servidor (.ini)' },
      { name: `${name}_SandboxVars.lua`, type: 'lua', path: this.getSandboxPath(name), label: 'Variables de Sandbox (.lua)' },
      { name: `${name}_spawnregions.lua`, type: 'lua', path: this.getSpawnRegionsPath(name), label: 'Regiones de Spawn (.lua)' }
    ];

    return candidates.map(c => ({
      ...c,
      exists: fs.existsSync(c.path),
      sizeBytes: fs.existsSync(c.path) ? fs.statSync(c.path).size : 0,
      modified: fs.existsSync(c.path) ? fs.statSync(c.path).mtime : null
    }));
  }
}

module.exports = new PzConfigService();
