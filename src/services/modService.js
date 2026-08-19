const configManager = require('../config/configManager');
const pzConfigService = require('./pzConfigService');
const logService = require('./logService');

class ModService {
  // Get active mods from server .ini and settings
  getMods() {
    const iniData = pzConfigService.loadServerIni();
    const workshopRaw = iniData.data.WorkshopItems || '';
    const modsRaw = iniData.data.Mods || '';

    const workshopItems = workshopRaw
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const mods = modsRaw
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      workshopItems,
      mods,
      rawWorkshopString: workshopRaw,
      rawModsString: modsRaw,
      totalWorkshopCount: workshopItems.length,
      totalModsCount: mods.length
    };
  }

  // Save mods to server .ini and settings
  saveMods(workshopItems, mods) {
    const cleanWorkshop = Array.isArray(workshopItems)
      ? workshopItems.map(s => String(s).trim()).filter(s => s.length > 0)
      : String(workshopItems || '').split(';').map(s => s.trim()).filter(s => s.length > 0);

    const cleanMods = Array.isArray(mods)
      ? mods.map(s => String(s).trim()).filter(s => s.length > 0)
      : String(mods || '').split(';').map(s => s.trim()).filter(s => s.length > 0);

    const workshopStr = cleanWorkshop.join(';');
    const modsStr = cleanMods.join(';');

    // Update .ini
    pzConfigService.saveServerIni({
      WorkshopItems: workshopStr,
      Mods: modsStr
    });

    // Update settings.json
    configManager.set({
      workshopItems: cleanWorkshop,
      mods: cleanMods
    });

    logService.log(`Configuración de Mods actualizada: ${cleanWorkshop.length} Workshop IDs, ${cleanMods.length} Mod IDs`, 'success', 'dashboard');

    return {
      workshopItems: cleanWorkshop,
      mods: cleanMods,
      rawWorkshopString: workshopStr,
      rawModsString: modsStr
    };
  }

  // Parser to extract Workshop IDs and Mod IDs from formatted text
  parseModText(rawText) {
    const lines = rawText.split('\n');
    const workshopIds = [];
    const modIds = [];

    for (const line of lines) {
      // Pattern 1: Workshop ID: 123456789
      const wMatch = line.match(/Workshop\s*(?:ID|Item)?\s*[:=]\s*([0-9]+)/i);
      if (wMatch && !workshopIds.includes(wMatch[1])) {
        workshopIds.push(wMatch[1]);
      }

      // Pattern 2: Mod ID: ModName
      const mMatch = line.match(/Mod\s*(?:ID|Name)?\s*[:=]\s*([a-zA-Z0-9_\-.]+)/i);
      if (mMatch && !modIds.includes(mMatch[1])) {
        modIds.push(mMatch[1]);
      }

      // Pattern 3: URL https://steamcommunity.com/sharedfiles/filedetails/?id=123456789
      const urlMatch = line.match(/id=([0-9]{8,12})/);
      if (urlMatch && !workshopIds.includes(urlMatch[1])) {
        workshopIds.push(urlMatch[1]);
      }
    }

    return { workshopIds, modIds };
  }
}

module.exports = new ModService();
