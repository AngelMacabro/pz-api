/**
 * Mod Manager View Controller
 */
class ModViewController {
  constructor() {
    this.workshopItems = [];
    this.mods = [];

    this.containerWorkshop = document.getElementById('workshop-tags-list');
    this.containerMods = document.getElementById('mod-tags-list');
    this.badgeWorkshop = document.getElementById('badge-workshop-count');
    this.badgeMods = document.getElementById('badge-mods-count');
    this.navModsCount = document.getElementById('nav-mods-count');
    this.cardModsCount = document.getElementById('card-mods-count');
    this.cardWorkshopCount = document.getElementById('card-workshop-count');

    this.inputWorkshop = document.getElementById('input-new-workshop');
    this.btnAddWorkshop = document.getElementById('btn-add-workshop');

    this.inputMod = document.getElementById('input-new-mod');
    this.btnAddMod = document.getElementById('btn-add-mod');

    this.txtImporter = document.getElementById('txt-mod-importer');
    this.btnParse = document.getElementById('btn-parse-mod-text');
    this.btnSave = document.getElementById('btn-save-mods');
    this.btnDownloadAll = document.getElementById('btn-download-all-mods');

    this.init();
  }

  init() {
    if (this.btnAddWorkshop && this.inputWorkshop) {
      this.btnAddWorkshop.addEventListener('click', () => this.addWorkshopItem());
      this.inputWorkshop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.addWorkshopItem();
      });
    }

    if (this.btnAddMod && this.inputMod) {
      this.btnAddMod.addEventListener('click', () => this.addMod());
      this.inputMod.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.addMod();
      });
    }

    if (this.btnParse && this.txtImporter) {
      this.btnParse.addEventListener('click', () => this.parseImportText());
    }

    if (this.btnSave) {
      this.btnSave.addEventListener('click', () => this.saveMods());
    }

    if (this.btnDownloadAll) {
      this.btnDownloadAll.addEventListener('click', async () => {
        try {
          if (window.App && window.App.showToast) {
            window.App.showToast('Iniciando descarga de todos los mods con SteamCMD...', 'info');
          }
          await API.downloadAllMods();
        } catch (err) {
          if (window.App && window.App.showToast) {
            window.App.showToast(`Error al descargar mods: ${err.message}`, 'error');
          }
        }
      });
    }

    this.loadMods();
  }

  async loadMods() {
    try {
      const res = await API.getMods();
      if (!res.success) return;

      this.workshopItems = res.workshopItems || [];
      this.mods = res.mods || [];

      this.render();
    } catch (err) {
      console.error('[ModView] Error loading mods:', err);
    }
  }

  render() {
    // Render Workshop Tags
    if (this.containerWorkshop) {
      this.containerWorkshop.innerHTML = '';
      if (this.workshopItems.length === 0) {
        this.containerWorkshop.innerHTML = '<span class="text-muted text-sm">No hay Workshop Items configurados.</span>';
      } else {
        this.workshopItems.forEach((id, index) => {
          const pill = document.createElement('div');
          pill.className = 'tag-pill tag-pill-workshop';
          pill.innerHTML = `
            <span>${id}</span>
            <button class="tag-remove-btn" title="Eliminar">&times;</button>
          `;
          pill.querySelector('.tag-remove-btn').addEventListener('click', () => {
            this.workshopItems.splice(index, 1);
            this.render();
          });
          this.containerWorkshop.appendChild(pill);
        });
      }
    }

    // Render Mod ID Tags
    if (this.containerMods) {
      this.containerMods.innerHTML = '';
      if (this.mods.length === 0) {
        this.containerMods.innerHTML = '<span class="text-muted text-sm">No hay Mod IDs configurados.</span>';
      } else {
        this.mods.forEach((name, index) => {
          const pill = document.createElement('div');
          pill.className = 'tag-pill tag-pill-mod';
          pill.innerHTML = `
            <span>${name}</span>
            <button class="tag-remove-btn" title="Eliminar">&times;</button>
          `;
          pill.querySelector('.tag-remove-btn').addEventListener('click', () => {
            this.mods.splice(index, 1);
            this.render();
          });
          this.containerMods.appendChild(pill);
        });
      }
    }

    // Update Counter Badges
    if (this.badgeWorkshop) this.badgeWorkshop.textContent = `${this.workshopItems.length} items`;
    if (this.badgeMods) this.badgeMods.textContent = `${this.mods.length} mods`;
    if (this.navModsCount) this.navModsCount.textContent = this.mods.length;
    if (this.cardModsCount) this.cardModsCount.textContent = `${this.mods.length} Mods`;
    if (this.cardWorkshopCount) this.cardWorkshopCount.textContent = `${this.workshopItems.length} Workshop Items`;
  }

  addWorkshopItem() {
    if (!this.inputWorkshop) return;
    const val = this.inputWorkshop.value.trim().replace(/[^0-9]/g, '');
    if (!val) return;

    if (!this.workshopItems.includes(val)) {
      this.workshopItems.push(val);
      this.render();
    }
    this.inputWorkshop.value = '';
  }

  addMod() {
    if (!this.inputMod) return;
    const val = this.inputMod.value.trim();
    if (!val) return;

    if (!this.mods.includes(val)) {
      this.mods.push(val);
      this.render();
    }
    this.inputMod.value = '';
  }

  async parseImportText() {
    if (!this.txtImporter) return;
    const text = this.txtImporter.value.trim();
    if (!text) return;

    try {
      const res = await API.parseModText(text);
      if (res.success) {
        let addedW = 0;
        let addedM = 0;

        for (const w of res.workshopIds) {
          if (!this.workshopItems.includes(w)) {
            this.workshopItems.push(w);
            addedW++;
          }
        }

        for (const m of res.modIds) {
          if (!this.mods.includes(m)) {
            this.mods.push(m);
            addedM++;
          }
        }

        this.render();
        this.txtImporter.value = '';

        if (window.App && window.App.showToast) {
          window.App.showToast(`Importación completada: +${addedW} Workshop IDs, +${addedM} Mod IDs.`, 'success');
        }
      }
    } catch (err) {
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error al procesar texto: ${err.message}`, 'error');
      }
    }
  }

  async saveMods() {
    try {
      const res = await API.saveMods(this.workshopItems, this.mods);
      if (res.success) {
        if (window.App && window.App.showToast) {
          window.App.showToast('Mods y Workshop guardados y sincronizados con el servidor', 'success');
        }
      }
    } catch (err) {
      if (window.App && window.App.showToast) {
        window.App.showToast(`Error al guardar mods: ${err.message}`, 'error');
      }
    }
  }
}
