import { App, Plugin, PluginSettingTab, Setting, requestUrl, RequestUrlParam, Notice } from 'obsidian';

interface ForgejoSettings {
  serverUrl: string;
  apiToken: string;
}

const DEFAULT_SETTINGS: ForgejoSettings = {
  serverUrl: 'https://meine-forgejo-instanz.de',
  apiToken: ''
};

interface ForgejoUser {
  login: string;
  full_name: string;
}

interface ForgejoPR {
  title: string;
  state: string;
  user: { login: string };
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface ForgejoIssue {
  title: string;
  state: string;
  user: { login: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
}

export default class ForgejoPlugin extends Plugin {
  settings: ForgejoSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new ForgejoSettingTab(this.app, this));

    // Processor für FPR (Pull Requests)
    this.registerMarkdownCodeBlockProcessor('FPR', (source, el) => {
      this.renderForgejoItem(source.trim(), el, 'pr');
    });

    // Processor für FIS (Issues)
    this.registerMarkdownCodeBlockProcessor('FIS', (source, el) => {
      this.renderForgejoItem(source.trim(), el, 'issue');
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  parseUrl(rawUrl: string): { owner: string; repo: string; index: string } | null {
    try {
      let cleanUrl = rawUrl.trim();
      const mdMatch = cleanUrl.match(/\((https?:\/\/[^\)]+)\)/);
      if (mdMatch) {
        cleanUrl = mdMatch[1];
      }
      cleanUrl = cleanUrl.replace(/[\[\]'"]/g, '').trim();

      const url = new URL(cleanUrl);
      const parts = url.pathname.split('/').filter(p => p.length > 0);
      
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

  async fetchApi<T>(endpoint: string): Promise<T> {
    const baseUrl = this.settings.serverUrl.replace(/\/$/, '');
    const options: RequestUrlParam = {
      url: `${baseUrl}/api/v1/${endpoint}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `token ${this.settings.apiToken}`
      }
    };

    const res = await requestUrl(options);
    if (res.status >= 400) {
      throw new Error(`Forgejo API Fehler HTTP ${res.status}`);
    }
    return res.json as T;
  }

  async renderForgejoItem(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue') {
    const container = el.createDiv({ cls: 'forgejo-container' });
    
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Bitte Forgejo Server-URL und Token in den Einstellungen konfigurieren.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl('p', { text: `❌ Ungültige URL: "${rawUrl}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: 'Lade Forgejo-Daten...' });

    try {
      const endpoint = type === 'pr' 
        ? `repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.index}`
        : `repos/${parsed.owner}/${parsed.repo}/issues/${parsed.index}`;

      if (type === 'pr') {
        const data = await this.fetchApi<ForgejoPR>(endpoint);
        container.empty();
        this.buildTable(container, 'Pull Request', [
          ['Titel', data.title],
          ['Status', data.state.toUpperCase()],
          ['Autor', data.user.login],
          ['Erstellt am', new Date(data.created_at).toLocaleDateString()],
          ['Link', `<a href="${data.html_url}" target="_blank">In Forgejo öffnen</a>`]
        ]);
      } else {
        const data = await this.fetchApi<ForgejoIssue>(endpoint);
        container.empty();
        const labels = data.labels.map(l => l.name).join(', ') || 'Keine';
        this.buildTable(container, 'Issue', [
          ['Titel', data.title],
          ['Status', data.state.toUpperCase()],
          ['Autor', data.user.login],
          ['Labels', labels],
          ['Erstellt am', new Date(data.created_at).toLocaleDateString()],
          ['Link', `<a href="${data.html_url}" target="_blank">In Forgejo öffnen</a>`]
        ]);
      }
    } catch (err) {
      container.empty();
      const errorMessage = err instanceof Error ? err.message : String(err);
      container.createEl('p', { text: `Fehler beim Abrufen: ${errorMessage}`, cls: 'mod-warning' });
    }
  }

  buildTable(parent: HTMLElement, title: string, rows: [string, string][]) {
    const table = parent.createEl('table', { cls: 'forgejo-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    headerRow.createEl('th', { text: title });
    headerRow.createEl('th', { text: 'Details' });

    const tbody = table.createEl('tbody');
    for (const [key, val] of rows) {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: key, attr: { style: 'font-weight: bold;' } });
      const tdVal = tr.createEl('td');
      if (val.startsWith('<a ')) {
        tdVal.innerHTML = val;
      } else {
        tdVal.textContent = val;
      }
    }
  }
}

class ForgejoSettingTab extends PluginSettingTab {
  plugin: ForgejoPlugin;

  constructor(app: App, plugin: ForgejoPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Forgejo Integrator Einstellungen' });

    new Setting(containerEl)
      .setName('Forgejo Server URL')
      .setDesc('Die Basis-URL deiner Forgejo-Instanz (z. B. https://commitcloud.net)')
      .addText(text => text
        .setPlaceholder('https://commitcloud.net')
        .setValue(this.plugin.settings.serverUrl)
        .onChange(async (value) => {
          this.plugin.settings.serverUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('API Token')
      .setDesc('Persönliches Zugriffstoken (Read-Rechte für Repositories reichen aus)')
      .addText(text => text
        .setPlaceholder('Token eingeben')
        .setValue(this.plugin.settings.apiToken)
        .onChange(async (value) => {
          this.plugin.settings.apiToken = value;
          await this.plugin.saveSettings();
        }));

    // Test-Button & Status-Anzeige
    const testSetting = new Setting(containerEl)
      .setName('Verbindung testen')
      .setDesc('Prüft die Erreichbarkeit der URL sowie die Gültigkeit des API-Tokens.');

    const statusContainer = containerEl.createDiv({ cls: 'forgejo-test-status', attr: { style: 'margin-top: 8px;' } });

    testSetting.addButton(button => button
      .setButtonText('Verbindung testen')
      .setCta()
      .onClick(async () => {
        statusContainer.empty();
        statusContainer.createEl('span', { text: '🔄 Teste Verbindung...' });

        try {
          const user = await this.plugin.fetchApi<ForgejoUser>('user');
          statusContainer.empty();
          statusContainer.createEl('div', { 
            text: `✅ Verbindung erfolgreich! Angemeldet als: ${user.login} (${user.full_name || 'Kein Name'})`,
            attr: { style: 'color: var(--text-success); font-weight: bold;' }
          });
          new Notice('Forgejo Verbindung erfolgreich!');
        } catch (err) {
          statusContainer.empty();
          const errorMsg = err instanceof Error ? err.message : String(err);
          statusContainer.createEl('div', { 
            text: `❌ Verbindung fehlgeschlagen: ${errorMsg}`,
            attr: { style: 'color: var(--text-error); font-weight: bold;' }
          });
          new Notice('Forgejo Verbindung fehlgeschlagen.');
        }
      }));
  }
}