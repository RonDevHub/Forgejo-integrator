"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ForgejoPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  serverUrl: "https://meine-forgejo-instanz.de",
  apiToken: ""
};
var ForgejoPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ForgejoSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor("FPR", (source, el) => {
      this.renderForgejoItem(source.trim(), el, "pr");
    });
    this.registerMarkdownCodeBlockProcessor("FIS", (source, el) => {
      this.renderForgejoItem(source.trim(), el, "issue");
    });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  parseUrl(rawUrl) {
    try {
      let cleanUrl = rawUrl.trim();
      const mdMatch = cleanUrl.match(/\((https?:\/\/[^\)]+)\)/);
      if (mdMatch) {
        cleanUrl = mdMatch[1];
      }
      cleanUrl = cleanUrl.replace(/[\[\]'"]/g, "").trim();
      const url = new URL(cleanUrl);
      const parts = url.pathname.split("/").filter((p) => p.length > 0);
      if (parts.length >= 4) {
        return {
          owner: parts[0],
          repo: parts[1],
          index: parts[3]
        };
      }
    } catch {
      return null;
    }
    return null;
  }
  async fetchApi(endpoint) {
    const baseUrl = this.settings.serverUrl.replace(/\/$/, "");
    const options = {
      url: `${baseUrl}/api/v1/${endpoint}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `token ${this.settings.apiToken}`
      }
    };
    const res = await (0, import_obsidian.requestUrl)(options);
    if (res.status >= 400) {
      throw new Error(`Forgejo API Fehler HTTP ${res.status}`);
    }
    return res.json;
  }
  async renderForgejoItem(rawUrl, el, type) {
    const container = el.createDiv({ cls: "forgejo-container" });
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl("p", {
        text: "\u26A0\uFE0F Bitte Forgejo Server-URL und Token in den Einstellungen konfigurieren.",
        cls: "mod-warning"
      });
      return;
    }
    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl("p", {
        text: `\u274C Ung\xFCltige URL: "${rawUrl}"`,
        cls: "mod-warning"
      });
      return;
    }
    container.createEl("span", { text: "Lade Forgejo-Daten..." });
    try {
      const endpoint = type === "pr" ? `repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.index}` : `repos/${parsed.owner}/${parsed.repo}/issues/${parsed.index}`;
      if (type === "pr") {
        const data = await this.fetchApi(endpoint);
        container.empty();
        this.buildTable(container, "Pull Request", [
          ["Titel", data.title],
          ["Status", data.state.toUpperCase()],
          ["Autor", data.user.login],
          ["Erstellt am", new Date(data.created_at).toLocaleDateString()],
          [
            "Link",
            `<a href="${data.html_url}" target="_blank">In Forgejo \xF6ffnen</a>`
          ]
        ]);
      } else {
        const data = await this.fetchApi(endpoint);
        container.empty();
        const labels = data.labels.map((l) => l.name).join(", ") || "Keine";
        this.buildTable(container, "Issue", [
          ["Titel", data.title],
          ["Status", data.state.toUpperCase()],
          ["Autor", data.user.login],
          ["Labels", labels],
          ["Erstellt am", new Date(data.created_at).toLocaleDateString()],
          [
            "Link",
            `<a href="${data.html_url}" target="_blank">In Forgejo \xF6ffnen</a>`
          ]
        ]);
      }
    } catch (err) {
      container.empty();
      const errorMessage = err instanceof Error ? err.message : String(err);
      container.createEl("p", {
        text: `Fehler beim Abrufen: ${errorMessage}`,
        cls: "mod-warning"
      });
    }
  }
  buildTable(parent, title, rows) {
    const table = parent.createEl("table", { cls: "forgejo-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: title });
    headerRow.createEl("th", { text: "Details" });
    const tbody = table.createEl("tbody");
    for (const [key, val] of rows) {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: key, attr: { style: "font-weight: bold;" } });
      const tdVal = tr.createEl("td");
      if (val.startsWith("<a ")) {
        tdVal.innerHTML = val;
      } else {
        tdVal.textContent = val;
      }
    }
  }
};
var ForgejoSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Forgejo Integrator Einstellungen" });
    new import_obsidian.Setting(containerEl).setName("Forgejo Server URL").setDesc(
      "Die Basis-URL deiner Forgejo-Instanz (z. B. https://forgejo.de domain)"
    ).addText(
      (text) => text.setPlaceholder("https://forgejo.de").setValue(this.plugin.settings.serverUrl).onChange(async (value) => {
        this.plugin.settings.serverUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("API Token").setDesc(
      "Pers\xF6nliches Zugriffstoken (Read-Rechte f\xFCr Repositories reichen aus)"
    ).addText(
      (text) => text.setPlaceholder("Token eingeben").setValue(this.plugin.settings.apiToken).onChange(async (value) => {
        this.plugin.settings.apiToken = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
