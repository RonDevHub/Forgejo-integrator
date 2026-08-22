import { App, Plugin, PluginSettingTab, Setting, requestUrl, RequestUrlParam, Notice } from 'obsidian';

interface ForgejoSettings {
  serverUrl: string;
  apiToken: string;
  tableLayout: 'vertical' | 'horizontal';
}

const DEFAULT_SETTINGS: ForgejoSettings = {
  serverUrl: 'https://my-forgejo-instance.com',
  apiToken: '',
  tableLayout: 'vertical'
};

interface ForgejoUser {
  login: string;
  full_name: string;
}

interface ForgejoPR {
  number: number;
  title: string;
  state: string;
  user: { login: string };
  html_url: string;
  created_at: string;
}

interface ForgejoIssue {
  number: number;
  title: string;
  state: string;
  user: { login: string };
  html_url: string;
  created_at: string;
  labels: Array<{ name: string; color: string }>;
}

export default class ForgejoPlugin extends Plugin {
  settings: ForgejoSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new ForgejoSettingTab(this.app, this));

    // Single item processors
    this.registerMarkdownCodeBlockProcessor('FPR', (source, el) => {
      this.renderForgejoSingleItem(source.trim(), el, 'pr');
    });

    this.registerMarkdownCodeBlockProcessor('FIS', (source, el) => {
      this.renderForgejoSingleItem(source.trim(), el, 'issue');
    });

    // List processors (Issues)
    this.registerMarkdownCodeBlockProcessor('FIS-ALL', (source, el) => {
      this.renderForgejoList(source.trim(), el, 'issue', 'all');
    });
    this.registerMarkdownCodeBlockProcessor('FIS-OPEN', (source, el) => {
      this.renderForgejoList(source.trim(), el, 'issue', 'open');
    });
    this.registerMarkdownCodeBlockProcessor('FIS-CLOSED', (source, el) => {
      this.renderForgejoList(source.trim(), el, 'issue', 'closed');
    });

    // List processors (Pull Requests)
    this.registerMarkdownCodeBlockProcessor('FPR-ALL', (source, el) => {
      this.renderForgejoList(source.trim(), el, 'pr', 'all');
    });
    this.registerMarkdownCodeBlockProcessor('FPR-OPEN', (source, el) => {
      this.renderForgejoList(source.trim(), el, 'pr', 'open');
    });
    this.registerMarkdownCodeBlockProcessor('FPR-CLOSED', (source, el) => {
      this.renderForgejoList(source.trim(), el, 'pr', 'closed');
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Force view refresh to apply layout changes instantly
    this.app.workspace.trigger('layout-change');
  }

  parseUrl(rawUrl: string): { owner: string; repo: string; index?: string } | null {
    try {
      let cleanUrl = rawUrl.trim();
      const mdMatch = cleanUrl.match(/\((https?:\/\/[^\)]+)\)/);
      if (mdMatch) {
        cleanUrl = mdMatch[1];
      }
      cleanUrl = cleanUrl.replace(/[\[\]'"]/g, '').trim();

      const url = new URL(cleanUrl);
      const parts = url.pathname.split('/').filter(p => p.length > 0);
      
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1],
          index: parts[3] || undefined
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
      throw new Error(`Forgejo API error HTTP ${res.status}`);
    }
    return res.json as T;
  }

  async renderForgejoSingleItem(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue') {
    const container = el.createDiv({ cls: 'forgejo-container' });
    
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure your Forgejo server URL and API token in settings.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed || !parsed.index) {
      container.createEl('p', { text: `❌ Invalid URL: "${rawUrl}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: 'Loading Forgejo data...' });

    try {
      const endpoint = type === 'pr' 
        ? `repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.index}`
        : `repos/${parsed.owner}/${parsed.repo}/issues/${parsed.index}`;

      if (type === 'pr') {
        const data = await this.fetchApi<ForgejoPR>(endpoint);
        container.empty();
        this.buildSingleTable(container, 'Pull Request', [
          ['Title', data.title],
          ['Status', data.state.toUpperCase()],
          ['Author', data.user.login],
          ['Created', new Date(data.created_at).toLocaleDateString()],
          ['Link', `<a href="${data.html_url}" target="_blank">Open in Forgejo</a>`]
        ]);
      } else {
        const data = await this.fetchApi<ForgejoIssue>(endpoint);
        container.empty();
        const labels = data.labels.map(l => l.name).join(', ') || 'None';
        this.buildSingleTable(container, 'Issue', [
          ['Title', data.title],
          ['Status', data.state.toUpperCase()],
          ['Author', data.user.login],
          ['Labels', labels],
          ['Created', new Date(data.created_at).toLocaleDateString()],
          ['Link', `<a href="${data.html_url}" target="_blank">Open in Forgejo</a>`]
        ]);
      }
    } catch (err) {
      container.empty();
      const errorMessage = err instanceof Error ? err.message : String(err);
      container.createEl('p', { text: `Fetch error: ${errorMessage}`, cls: 'mod-warning' });
    }
  }

  async renderForgejoList(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue', state: 'all' | 'open' | 'closed') {
    const container = el.createDiv({ cls: 'forgejo-container' });

    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure your Forgejo server URL and API token in settings.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl('p', { text: `❌ Invalid Repository URL: "${rawUrl}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: `Loading Forgejo ${type === 'pr' ? 'Pull Requests' : 'Issues'}...` });

    try {
      const endpoint = type === 'pr'
        ? `repos/${parsed.owner}/${parsed.repo}/pulls?state=${state}`
        : `repos/${parsed.owner}/${parsed.repo}/issues?state=${state}`;

      if (type === 'pr') {
        const items = await this.fetchApi<ForgejoPR[]>(endpoint);
        container.empty();
        if (items.length === 0) {
          container.createEl('p', { text: `No ${state} pull requests found.` });
          return;
        }
        this.buildListTable(container, items.map(item => ({
          id: `#${item.number}`,
          title: item.title,
          status: item.state.toUpperCase(),
          author: item.user.login,
          created: new Date(item.created_at).toLocaleDateString(),
          link: `<a href="${item.html_url}" target="_blank">Open</a>`
        })));
      } else {
        const items = await this.fetchApi<ForgejoIssue[]>(endpoint);
        container.empty();
        if (items.length === 0) {
          container.createEl('p', { text: `No ${state} issues found.` });
          return;
        }
        this.buildListTable(container, items.map(item => ({
          id: `#${item.number}`,
          title: item.title,
          status: item.state.toUpperCase(),
          author: item.user.login,
          created: new Date(item.created_at).toLocaleDateString(),
          link: `<a href="${item.html_url}" target="_blank">Open</a>`
        })));
      }
    } catch (err) {
      container.empty();
      const errorMessage = err instanceof Error ? err.message : String(err);
      container.createEl('p', { text: `Fetch error: ${errorMessage}`, cls: 'mod-warning' });
    }
  }

  buildSingleTable(parent: HTMLElement, typeTitle: string, rows: [string, string][]) {
    const table = parent.createEl('table', { cls: 'forgejo-table' });
    
    if (this.settings.tableLayout === 'vertical') {
      const thead = table.createEl('thead');
      const headerRow = thead.createEl('tr');
      headerRow.createEl('th', { text: typeTitle });
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
    } else {
      const thead = table.createEl('thead');
      const headerRow = thead.createEl('tr');
      for (const [key] of rows) {
        headerRow.createEl('th', { text: key });
      }

      const tbody = table.createEl('tbody');
      const tr = tbody.createEl('tr');
      for (const [, val] of rows) {
        const tdVal = tr.createEl('td');
        if (val.startsWith('<a ')) {
          tdVal.innerHTML = val;
        } else {
          tdVal.textContent = val;
        }
      }
    }
  }

  buildListTable(parent: HTMLElement, items: Array<{ id: string; title: string; status: string; author: string; created: string; link: string }>) {
    const table = parent.createEl('table', { cls: 'forgejo-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    
    headerRow.createEl('th', { text: 'ID' });
    headerRow.createEl('th', { text: 'Title' });
    headerRow.createEl('th', { text: 'Status' });
    headerRow.createEl('th', { text: 'Author' });
    headerRow.createEl('th', { text: 'Created' });
    headerRow.createEl('th', { text: 'Link' });

    const tbody = table.createEl('tbody');
    for (const item of items) {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: item.id, attr: { style: 'font-weight: bold;' } });
      tr.createEl('td', { text: item.title });
      tr.createEl('td', { text: item.status });
      tr.createEl('td', { text: item.author });
      tr.createEl('td', { text: item.created });
      const tdLink = tr.createEl('td');
      tdLink.innerHTML = item.link;
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

    containerEl.createEl('h2', { text: 'Forgejo Integrator Settings' });

    // Instructional Text
    const infoBox = containerEl.createDiv({ cls: 'forgejo-info-box', attr: { style: 'margin-bottom: 20px; padding: 12px; background-color: var(--background-secondary); border-radius: 6px;' } });
    infoBox.createEl('h3', { text: 'How it works', attr: { style: 'margin-top: 0;' } });
    const list = infoBox.createEl('ul');
    list.createEl('li', { text: 'Single items: ```FIS or ```FPR + full item URL.' });
    list.createEl('li', { text: 'Issue lists: ```FIS-ALL, ```FIS-OPEN, ```FIS-CLOSED + repo URL (e.g. [https://commitcloud.net/owner/repo](https://commitcloud.net/owner/repo)).' });
    list.createEl('li', { text: 'PR lists: ```FPR-ALL, ```FPR-OPEN, ```FPR-CLOSED + repo URL.' });

    // Server URL
    new Setting(containerEl)
      .setName('Forgejo Server URL')
      .setDesc('The base URL of your Forgejo instance (e.g. https://commitcloud.net)')
      .addText(text => text
        .setPlaceholder('https://commitcloud.net')
        .setValue(this.plugin.settings.serverUrl)
        .onChange(async (value) => {
          this.plugin.settings.serverUrl = value;
          await this.plugin.saveSettings();
        }));

    // API Token (masked input)
    new Setting(containerEl)
      .setName('API Token')
      .setDesc('Personal Access Token (Read access to repositories is sufficient)')
      .addText(text => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Enter your token')
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value;
            await this.plugin.saveSettings();
          });
      });

    // Table Layout Selector
    new Setting(containerEl)
      .setName('Table Layout')
      .setDesc('Choose whether single items display line by line (vertical) or side-by-side (horizontal).')
      .addDropdown(dropdown => dropdown
        .addOption('vertical', 'Vertical (Key / Value rows)')
        .addOption('horizontal', 'Horizontal (Columns side-by-side)')
        .setValue(this.plugin.settings.tableLayout)
        .onChange(async (value) => {
          this.plugin.settings.tableLayout = value as 'vertical' | 'horizontal';
          await this.plugin.saveSettings();
        }));

    // Connection Test Button
    const testSetting = new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify instance URL reachability and API Token validity.');

    const statusContainer = containerEl.createDiv({ cls: 'forgejo-test-status', attr: { style: 'margin-top: 8px;' } });

    testSetting.addButton(button => button
      .setButtonText('Test Connection')
      .setCta()
      .onClick(async () => {
        statusContainer.empty();
        statusContainer.createEl('span', { text: '🔄 Testing connection...' });

        try {
          const user = await this.plugin.fetchApi<ForgejoUser>('user');
          statusContainer.empty();
          statusContainer.createEl('div', { 
            text: `✅ Connection successful! Authenticated as: ${user.login} (${user.full_name || 'No name set'})`,
            attr: { style: 'color: var(--text-success); font-weight: bold;' }
          });
          new Notice('Forgejo connection successful!');
        } catch (err) {
          statusContainer.empty();
          const errorMsg = err instanceof Error ? err.message : String(err);
          statusContainer.createEl('div', { 
            text: `❌ Connection failed: ${errorMsg}`,
            attr: { style: 'color: var(--text-error); font-weight: bold;' }
          });
          new Notice('Forgejo connection failed.');
        }
      }));

    // Support Section with Shields.io PayPal Badge
    containerEl.createEl('hr', { attr: { style: 'margin: 20px 0;' } });
    const supportContainer = containerEl.createDiv({ attr: { style: 'text-align: center;' } });
    supportContainer.createEl('p', { text: 'If you like this plugin, consider supporting its development:' });
    
    const paypalLink = supportContainer.createEl('a', { 
      href: 'https://www.paypal.com/donate/?hosted_button_id=PWY939TPCQ3RA', 
      attr: { target: '_blank', rel: 'noopener' } 
    });
    
    paypalLink.createEl('img', {
      attr: {
        src: 'https://img.shields.io/badge/Donate-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white',
        alt: 'Donate via PayPal'
      }
    });
  }
}