import { App, Plugin, PluginSettingTab, Setting, requestUrl, RequestUrlParam, Notice } from 'obsidian';

interface ForgejoSettings {
  serverUrl: string;
  apiToken: string;
  tableLayout: 'vertical' | 'horizontal';
  refreshInterval: number;
}

const DEFAULT_SETTINGS: ForgejoSettings = {
  serverUrl: 'https://my-forgejo-instance.com',
  apiToken: '',
  tableLayout: 'vertical',
  refreshInterval: 60000
};

interface ForgejoUser {
  login: string;
  full_name: string;
  avatar_url: string;
}

interface ForgejoPR {
  number: number;
  title: string;
  state: string;
  user: ForgejoUser;
  html_url: string;
  created_at: string;
}

interface ForgejoIssue {
  number: number;
  title: string;
  state: string;
  user: ForgejoUser;
  html_url: string;
  created_at: string;
  labels: Array<{ name: string; color: string }>;
}

interface ForgejoRelease {
  tag_name: string;
  name: string;
  published_at: string;
}

interface ForgejoRepo {
  name: string;
  full_name: string;
  owner: ForgejoUser;
  private: boolean;
  html_url: string;
  created_at: string;
  updated_at?: string;
  pushed_at?: string;
  updated?: string;
  open_issues_count: number;
  license?: string | { name?: string; spdx_id?: string; key?: string };
}

export default class ForgejoPlugin extends Plugin {
  settings: ForgejoSettings;
  intervalId: number | null = null;

  async onload() {
    await this.loadSettings();
    this.injectStyles();
    this.addSettingTab(new ForgejoSettingTab(this.app, this));

    // Processors
    this.registerMarkdownCodeBlockProcessor('FPR', (source, el) => this.renderForgejoSingleItem(source.trim(), el, 'pr'));
    this.registerMarkdownCodeBlockProcessor('FIS', (source, el) => this.renderForgejoSingleItem(source.trim(), el, 'issue'));

    this.registerMarkdownCodeBlockProcessor('FIS-ALL', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'all'));
    this.registerMarkdownCodeBlockProcessor('FIS-OPEN', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'open'));
    this.registerMarkdownCodeBlockProcessor('FIS-CLOSED', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'closed'));

    this.registerMarkdownCodeBlockProcessor('FPR-ALL', (source, el) => this.renderForgejoList(source.trim(), el, 'pr', 'all'));
    this.registerMarkdownCodeBlockProcessor('FPR-OPEN', (source, el) => this.renderForgejoList(source.trim(), el, 'pr', 'open'));
    this.registerMarkdownCodeBlockProcessor('FPR-CLOSED', (source, el) => this.renderForgejoList(source.trim(), el, 'pr', 'closed'));

    this.registerMarkdownCodeBlockProcessor('FRI', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'all'));
    this.registerMarkdownCodeBlockProcessor('FRI-OPEN', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'open'));
    this.registerMarkdownCodeBlockProcessor('FRI-CLOSED', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'closed'));

    this.registerMarkdownCodeBlockProcessor('FR', (source, el) => this.renderRepoDetails(source.trim(), el));
    this.registerMarkdownCodeBlockProcessor('FR-ALL', (source, el) => this.renderAllUserRepos(el));

    this.startAutoRefresh();
  }

  onunload() {
    this.stopAutoRefresh();
    const styleEl = document.getElementById('forgejo-plugin-styles');
    if (styleEl) styleEl.remove();
  }

  // Inject fallback styles directly to guarantee rendering
  injectStyles() {
    let styleEl = document.getElementById('forgejo-plugin-styles') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'forgejo-plugin-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .forgejo-container { margin: 12px 0; overflow-x: auto; }
      .forgejo-table { width: 100%; border-collapse: collapse; margin: 8px 0; border: 1px solid var(--table-border, var(--border-color, #333)); background-color: var(--background-primary); font-size: 0.9em; }
      .forgejo-table th, .forgejo-table td { border: 1px solid var(--table-border, var(--border-color, #333)); padding: 8px 12px; text-align: center; vertical-align: middle; }
      .forgejo-main-header { background-color: var(--background-secondary-alt, var(--background-secondary)); font-size: 1.05em; font-weight: bold; padding: 10px; text-align: center !important; color: var(--text-normal); }
      .forgejo-cols-row th { background-color: var(--background-secondary); font-weight: 600; color: var(--text-muted); }
      .forgejo-table tbody tr:nth-child(even) { background-color: var(--background-secondary-alt); }
      .forgejo-fallback-cell { text-align: center !important; font-style: italic; color: var(--text-muted); padding: 16px !important; }
      .forgejo-user { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
      .forgejo-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
    `;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.startAutoRefresh();
    this.refreshViews();
  }

  // Forces active markdown views to re-render codeblocks immediately
  refreshViews() {
    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf.view && leaf.view.getViewType() === 'markdown') {
        const view = leaf.view as any;
        if (view.previewMode && view.previewMode.rerender) {
          view.previewMode.rerender(true);
        }
      }
    });
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    if (this.settings.refreshInterval > 0) {
      this.intervalId = window.setInterval(() => this.refreshViews(), this.settings.refreshInterval);
    }
  }

  stopAutoRefresh() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  parseUrl(rawUrl: string): { owner: string; repo: string; index?: string } | null {
    try {
      let cleanUrl = rawUrl.trim();
      const mdMatch = cleanUrl.match(/\((https?:\/\/[^\)]+)\)/);
      if (mdMatch) cleanUrl = mdMatch[1];
      cleanUrl = cleanUrl.replace(/[\[\]'"]/g, '').trim();

      const url = new URL(cleanUrl);
      const parts = url.pathname.split('/').filter(p => p.length > 0);
      
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1], index: parts[3] || undefined };
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
    if (res.status >= 400) throw new Error(`Forgejo API error HTTP ${res.status}`);
    return res.json as T;
  }

  async fetchRawFile(owner: string, repo: string, filepath: string): Promise<string | null> {
    const baseUrl = this.settings.serverUrl.replace(/\/$/, '');
    try {
      const options: RequestUrlParam = {
        url: `${baseUrl}/api/v1/repos/${owner}/${repo}/raw/${filepath}`,
        method: 'GET',
        headers: { 'Authorization': `token ${this.settings.apiToken}` }
      };
      const res = await requestUrl(options);
      if (res.status === 200) return res.text;
    } catch {
      return null;
    }
    return null;
  }

  // Detect license name from repository license files
  async detectLicense(owner: string, repo: string): Promise<string> {
    const files = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md", "COPYING.txt"];
    for (const file of files) {
      const content = await this.fetchRawFile(owner, repo, file);
      if (content) {
        const text = content.toUpperCase();
        if (text.includes("MIT LICENSE") || text.includes("PERMISSION IS HEREBY GRANTED")) return "MIT";
        if (text.includes("APACHE LICENSE")) return "Apache-2.0";
        if (text.includes("GNU GENERAL PUBLIC LICENSE") || text.includes("GPL")) {
          if (text.includes("VERSION 3")) return "GPL-3.0";
          if (text.includes("VERSION 2")) return "GPL-2.0";
          return "GPL";
        }
        if (text.includes("GNU AFFERO GENERAL PUBLIC LICENSE") || text.includes("AGPL")) return "AGPL-3.0";
        if (text.includes("BSD 3-CLAUSE")) return "BSD-3-Clause";
        if (text.includes("BSD 2-CLAUSE")) return "BSD-2-Clause";
        if (text.includes("MOZILLA PUBLIC LICENSE")) return "MPL-2.0";
        if (text.includes("UNLICENSE")) return "Unlicense";
        return file.split('.')[0];
      }
    }
    return "None";
  }

  formatUser(user?: ForgejoUser): string {
    if (!user) return 'N/A';
    const avatar = user.avatar_url ? `<img src="${user.avatar_url}" class="forgejo-avatar" alt="${user.login}" />` : '';
    return `<div class="forgejo-user">${avatar}<span>${user.login}</span></div>`;
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  }

  extractPushDate(repo: ForgejoRepo): string {
    const rawDate = repo.pushed_at || repo.updated_at || repo.updated;
    return this.formatDate(rawDate);
  }

  // Single Items (FIS / FPR)
  async renderForgejoSingleItem(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue') {
    const container = el.createDiv({ cls: 'forgejo-container' });
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure Server URL and API Token in settings.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed || !parsed.index) {
      container.createEl('p', { text: `❌ Invalid URL: "${rawUrl}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: 'Loading...' });

    try {
      const endpoint = type === 'pr' 
        ? `repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.index}`
        : `repos/${parsed.owner}/${parsed.repo}/issues/${parsed.index}`;

      if (type === 'pr') {
        const data = await this.fetchApi<ForgejoPR>(endpoint);
        container.empty();
        this.buildSingleTable(container, `Pull Request #${data.number}`, [
          ['Title', data.title || 'N/A'],
          ['Status', (data.state || 'UNKNOWN').toUpperCase()],
          ['Author', this.formatUser(data.user)],
          ['Created', this.formatDate(data.created_at)],
          ['Link', `<a href="${data.html_url}" target="_blank">Open in Forgejo</a>`]
        ]);
      } else {
        const data = await this.fetchApi<ForgejoIssue>(endpoint);
        container.empty();
        const labels = data.labels && data.labels.length > 0 ? data.labels.map(l => l.name).join(', ') : 'None';
        this.buildSingleTable(container, `Issue #${data.number}`, [
          ['Title', data.title || 'N/A'],
          ['Status', (data.state || 'UNKNOWN').toUpperCase()],
          ['Author', this.formatUser(data.user)],
          ['Labels', labels],
          ['Created', this.formatDate(data.created_at)],
          ['Link', `<a href="${data.html_url}" target="_blank">Open in Forgejo</a>`]
        ]);
      }
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${err instanceof Error ? err.message : String(err)}`, cls: 'mod-warning' });
    }
  }

  // Lists (FIS-*, FPR-*, FRI-*)
  async renderForgejoList(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue', state: 'all' | 'open' | 'closed') {
    const container = el.createDiv({ cls: 'forgejo-container' });
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure Server URL and API Token in settings.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl('p', { text: `❌ Invalid Repository URL: "${rawUrl}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: 'Loading list...' });

    try {
      const endpoint = type === 'pr'
        ? `repos/${parsed.owner}/${parsed.repo}/pulls?state=${state}`
        : `repos/${parsed.owner}/${parsed.repo}/issues?state=${state}`;

      const items = await this.fetchApi<any[]>(endpoint);
      container.empty();

      const title = `${type === 'pr' ? 'Pull Requests' : 'Issues'} (${state.toUpperCase()}) - ${parsed.owner}/${parsed.repo}`;
      const headers = ['ID', 'Title', 'Status', 'Author', 'Created', 'Link'];

      if (!items || items.length === 0) {
        this.buildStructuredTable(container, title, headers, [], `No ${type === 'pr' ? 'pull requests' : 'issues'} found for state "${state}".`);
        return;
      }

      const rows = items.map(item => [
        `#${item.number}`,
        item.title || 'N/A',
        (item.state || 'UNKNOWN').toUpperCase(),
        this.formatUser(item.user),
        this.formatDate(item.created_at),
        `<a href="${item.html_url}" target="_blank">Open</a>`
      ]);

      this.buildStructuredTable(container, title, headers, rows);
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${err instanceof Error ? err.message : String(err)}`, cls: 'mod-warning' });
    }
  }

  // Single Repo Details (FR)
  async renderRepoDetails(rawUrl: string, el: HTMLElement) {
    const container = el.createDiv({ cls: 'forgejo-container' });
    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl('p', { text: `❌ Invalid Repository URL: "${rawUrl}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: 'Loading Repository Details...' });

    try {
      const repo = await this.fetchApi<ForgejoRepo>(`repos/${parsed.owner}/${parsed.repo}`);
      const [openIssues, closedIssues, openPRs, closedPRs, license] = await Promise.all([
        this.fetchApi<any[]>(`repos/${parsed.owner}/${parsed.repo}/issues?state=open`).catch(() => []),
        this.fetchApi<any[]>(`repos/${parsed.owner}/${parsed.repo}/issues?state=closed`).catch(() => []),
        this.fetchApi<any[]>(`repos/${parsed.owner}/${parsed.repo}/pulls?state=open`).catch(() => []),
        this.fetchApi<any[]>(`repos/${parsed.owner}/${parsed.repo}/pulls?state=closed`).catch(() => []),
        this.detectLicense(parsed.owner, parsed.repo)
      ]);
      
      let lastReleaseTag = 'None';
      try {
        const releases = await this.fetchApi<ForgejoRelease[]>(`repos/${parsed.owner}/${parsed.repo}/releases`);
        if (releases && releases.length > 0) lastReleaseTag = releases[0].tag_name || releases[0].name;
      } catch { /* Suppress */ }

      container.empty();
      const headers = ['Name', 'Issues (O/C)', 'PRs (O/C)', 'Created', 'Last Push', 'Release', 'License'];
      const rows = [[
        `<a href="${repo.html_url}" target="_blank">${parsed.repo}</a>`,
        `${openIssues.length} / ${closedIssues.length}`,
        `${openPRs.length} / ${closedPRs.length}`,
        this.formatDate(repo.created_at),
        this.extractPushDate(repo),
        lastReleaseTag,
        license
      ]];

      this.buildStructuredTable(container, `Repository: ${repo.full_name}`, headers, rows);
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${err instanceof Error ? err.message : String(err)}`, cls: 'mod-warning' });
    }
  }

  // All User Repositories (FR-ALL)
  async renderAllUserRepos(el: HTMLElement) {
    const container = el.createDiv({ cls: 'forgejo-container' });
    container.createEl('span', { text: 'Loading All Repositories...' });

    try {
      const repos = await this.fetchApi<ForgejoRepo[]>('user/repos');
      container.empty();

      const headers = ['Name', 'Visibility', 'Issues (O/C)', 'PRs (O/C)', 'Created', 'Last Push', 'Release', 'License'];

      if (!repos || repos.length === 0) {
        this.buildStructuredTable(container, 'User Repositories Overview', headers, [], 'No repositories found for this account.');
        return;
      }

      const rowsData = await Promise.all(repos.map(async repo => {
        const [openI, closedI, openP, closedP, releases, license] = await Promise.all([
          this.fetchApi<any[]>(`repos/${repo.owner.login}/${repo.name}/issues?state=open`).catch(() => []),
          this.fetchApi<any[]>(`repos/${repo.owner.login}/${repo.name}/issues?state=closed`).catch(() => []),
          this.fetchApi<any[]>(`repos/${repo.owner.login}/${repo.name}/pulls?state=open`).catch(() => []),
          this.fetchApi<any[]>(`repos/${repo.owner.login}/${repo.name}/pulls?state=closed`).catch(() => []),
          this.fetchApi<ForgejoRelease[]>(`repos/${repo.owner.login}/${repo.name}/releases`).catch(() => []),
          this.detectLicense(repo.owner.login, repo.name)
        ]);

        const lastRelease = releases && releases.length > 0 ? (releases[0].tag_name || releases[0].name) : 'None';

        return [
          `<a href="${repo.html_url}" target="_blank">${repo.name}</a>`,
          repo.private ? '🔒 Private' : '🌐 Public',
          `${openI.length} / ${closedI.length}`,
          `${openP.length} / ${closedP.length}`,
          this.formatDate(repo.created_at),
          this.extractPushDate(repo),
          lastRelease,
          license
        ];
      }));

      this.buildStructuredTable(container, 'User Repositories Overview', headers, rowsData);
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${err instanceof Error ? err.message : String(err)}`, cls: 'mod-warning' });
    }
  }

  buildStructuredTable(parent: HTMLElement, title: string, headers: string[], rows: string[][], fallbackText?: string) {
    const table = parent.createEl('table', { cls: 'forgejo-table' });
    const thead = table.createEl('thead');

    const titleRow = thead.createEl('tr', { cls: 'forgejo-title-row' });
    const titleTh = titleRow.createEl('th', { text: title, attr: { colspan: String(headers.length) } });
    titleTh.addClass('forgejo-main-header');

    const headerRow = thead.createEl('tr', { cls: 'forgejo-cols-row' });
    for (const h of headers) {
      headerRow.createEl('th', { text: h });
    }

    const tbody = table.createEl('tbody');

    if (rows.length === 0) {
      const emptyRow = tbody.createEl('tr');
      const emptyTd = emptyRow.createEl('td', { attr: { colspan: String(headers.length) }, cls: 'forgejo-fallback-cell' });
      emptyTd.textContent = fallbackText || 'No data available.';
      return;
    }

    for (const rowContent of rows) {
      const tr = tbody.createEl('tr');
      for (const cell of rowContent) {
        const td = tr.createEl('td');
        if (cell.includes('<a ') || cell.includes('<div ') || cell.includes('<img ')) {
          td.innerHTML = cell;
        } else {
          td.textContent = cell;
        }
      }
    }
  }

  buildSingleTable(parent: HTMLElement, typeTitle: string, rows: [string, string][]) {
    const table = parent.createEl('table', { cls: 'forgejo-table' });
    const thead = table.createEl('thead');
    
    if (this.settings.tableLayout === 'vertical') {
      const titleRow = thead.createEl('tr', { cls: 'forgejo-title-row' });
      const th = titleRow.createEl('th', { text: typeTitle, attr: { colspan: '2' } });
      th.addClass('forgejo-main-header');

      const tbody = table.createEl('tbody');
      for (const [key, val] of rows) {
        const tr = tbody.createEl('tr');
        tr.createEl('td', { text: key, attr: { style: 'font-weight: bold; width: 30%;' } });
        const tdVal = tr.createEl('td');
        if (val.includes('<a ') || val.includes('<div ') || val.includes('<img ')) tdVal.innerHTML = val;
        else tdVal.textContent = val;
      }
    } else {
      const titleRow = thead.createEl('tr', { cls: 'forgejo-title-row' });
      const th = titleRow.createEl('th', { text: typeTitle, attr: { colspan: String(rows.length) } });
      th.addClass('forgejo-main-header');

      const headerRow = thead.createEl('tr', { cls: 'forgejo-cols-row' });
      for (const [key] of rows) {
        headerRow.createEl('th', { text: key });
      }

      const tbody = table.createEl('tbody');
      const tr = tbody.createEl('tr');
      for (const [, val] of rows) {
        const tdVal = tr.createEl('td');
        if (val.includes('<a ') || val.includes('<div ') || val.includes('<img ')) tdVal.innerHTML = val;
        else tdVal.textContent = val;
      }
    }
  }
}

// English Settings Tab
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

    const infoBox = containerEl.createDiv({ cls: 'forgejo-info-box', attr: { style: 'margin-bottom: 20px; padding: 12px; background-color: var(--background-secondary); border-radius: 6px;' } });
    infoBox.createEl('h3', { text: 'Available Codeblocks', attr: { style: 'margin-top: 0;' } });
    const list = infoBox.createEl('ul');
    list.createEl('li', { text: 'Single Items: ```FIS or ```FPR + Item URL' });
    list.createEl('li', { text: 'Issue Lists: ```FIS-ALL, ```FIS-OPEN, ```FIS-CLOSED + Repo URL' });
    list.createEl('li', { text: 'PR Lists: ```FPR-ALL, ```FPR-OPEN, ```FPR-CLOSED + Repo URL' });
    list.createEl('li', { text: 'Repo Issues: ```FRI, ```FRI-OPEN, ```FRI-CLOSED + Repo URL' });
    list.createEl('li', { text: 'Single Repo Details: ```FR + Repo URL' });
    list.createEl('li', { text: 'All Repositories Overview: ```FR-ALL (No URL needed)' });

    new Setting(containerEl)
      .setName('Forgejo Server URL')
      .setDesc('Base URL of your Forgejo instance (e.g. [https://commitcloud.net](https://commitcloud.net))')
      .addText(text => text
        .setPlaceholder('[https://commitcloud.net](https://commitcloud.net)')
        .setValue(this.plugin.settings.serverUrl)
        .onChange(async (value) => {
          this.plugin.settings.serverUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('API Token')
      .setDesc('Personal Access Token (Read permissions required)')
      .addText(text => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Enter your API token')
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Table Layout')
      .setDesc('Choose layout style for single item views (FIS / FPR)')
      .addDropdown(dropdown => dropdown
        .addOption('vertical', 'Vertical (Key / Value rows)')
        .addOption('horizontal', 'Horizontal (Columns side-by-side)')
        .setValue(this.plugin.settings.tableLayout)
        .onChange(async (value) => {
          this.plugin.settings.tableLayout = value as 'vertical' | 'horizontal';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Refresh Interval')
      .setDesc('Select how often data tables automatically update in the background.')
      .addDropdown(dropdown => dropdown
        .addOption('0', 'Realtime (On view / render)')
        .addOption('60000', '1 Minute (Default)')
        .addOption('300000', '5 Minutes')
        .addOption('1800000', '30 Minutes')
        .addOption('3600000', '1 Hour')
        .setValue(String(this.plugin.settings.refreshInterval))
        .onChange(async (value) => {
          this.plugin.settings.refreshInterval = Number(value);
          await this.plugin.saveSettings();
        }));

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
            text: `✅ Connection successful! Authenticated as: ${user.login} (${user.full_name || 'No full name'})`,
            attr: { style: 'color: var(--text-success); font-weight: bold;' }
          });
          new Notice('Forgejo connection successful!');
        } catch (err) {
          statusContainer.empty();
          statusContainer.createEl('div', { 
            text: `❌ Connection failed: ${err instanceof Error ? err.message : String(err)}`,
            attr: { style: 'color: var(--text-error); font-weight: bold;' }
          });
          new Notice('Forgejo connection failed.');
        }
      }));

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