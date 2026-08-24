import { App, Plugin, PluginSettingTab, Setting, requestUrl, RequestUrlParam, Notice } from 'obsidian';

interface ForgejoSettings {
  serverUrl: string;
  apiToken: string;
  tableLayout: 'vertical' | 'horizontal';
  refreshInterval: number;
  themeStyle: 'dark' | 'light' | 'blue' | 'purple' | 'mono' | 'sepia' | 'nord' | 'dracula' | 'cyberpunk' | 'midnight' | 'slate' | 'teal' | 'amber';
  enableCache: boolean;
}

const DEFAULT_SETTINGS: ForgejoSettings = {
  serverUrl: 'https://my-forgejo-instance.com',
  apiToken: '',
  tableLayout: 'vertical',
  refreshInterval: 60000,
  themeStyle: 'light',
  enableCache: false
};

interface CacheData {
  [endpoint: string]: {
    timestamp: number;
    data: any;
  };
}

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
  repository?: { full_name: string };
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
}

const SVG_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 560" class="forgejo-icon"><path fill="currentColor" d="M258.8 380c-3.9 3.1-6.7 7.6-6.7 12.6l0 27.4c0 15.5-12.5 28-28 28s-28-12.5-28-28l0-27.4c0-5-2.8-9.5-6.7-12.6-13-10.3-21.3-26.1-21.3-44 0-30.9 25.1-56 56-56s56 25.1 56 56c0 17.8-8.3 33.7-21.3 44zM84.2 140l0 40.9c-16.9 5.9-31.9 14.4-44.3 26.8-17.3 17.3-27 39.5-32.5 65.1-9.8 45.4-9.8 137 0 182.4 5.5 25.6 15.2 47.8 32.5 65.1s39.5 27 65.1 32.5c25.3 5.5 55.7 7.2 91.2 7.2l56 0c35.6 0 65.9-1.7 91.2-7.2 25.6-5.5 47.8-15.2 65.1-32.5s27-39.5 32.5-65.1c9.8-45.4 9.8-137 0-182.4-5.5-25.6-15.2-47.8-32.5-65.1-12.4-12.4-27.4-20.9-44.3-26.8l0-40.9c0-40.3-12.9-75.9-38.5-101.5S264.4 0 224.2 0 148.3 12.9 122.7 38.5 84.2 99.7 84.2 140zm78.1-61.9C175.6 64.8 196 56 224.2 56s48.6 8.8 61.9 22.1 22.1 33.7 22.1 61.9l0 30.1c-17-1.5-35.6-2.1-56-2.1l-56 0c-20.4 0-39 .6-56 2.1l0-30.1c0-28.2 8.8-48.6 22.1-61.9zM62.1 284.6c4.1-19 10.1-30.1 17.4-37.3s18.3-13.3 37.3-17.4c19.3-4.2 45-5.9 79.4-5.9l56 0c34.4 0 60.1 1.8 79.4 5.9 19 4.1 30.1 10.1 37.3 17.4s13.3 18.3 17.4 37.3c4.2 19.3 5.9 45 5.9 79.4s-1.8 60.1-5.9 79.4c-4.1 19-10.1 30.1-17.4 37.3s-18.3 13.3-37.3 17.4c-19.3-4.2-45-5.9-79.4-5.9l-56 0c-34.4 0-60.1-1.8-79.4-5.9-19-4.1-30.1-10.1-37.3-17.4s-13.3-18.3-17.4-37.3c-4.2-19.3-5.9-45-5.9-79.4s1.8-60.1 5.9-79.4z"/></svg>`;
const SVG_GLOBE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560" class="forgejo-icon"><path fill="currentColor" d="M69.6 192.2c21.5-63.1 68.3-108.2 136.1-126.8-37.3 60.9-51.5 136.6-52.2 209.2-25.5-2.4-46.3-5.3-62.9-8.2-17.6-3.1-35.5-6.2-52.3-12.5-14.3-5.6-30.5 1.3-36.2 15.7-5.7 14.4 1.2 30.7 15.6 36.4 20.3 8 42 11.9 63.4 15.6 19.7 3.4 44.5 6.8 74.8 9.5 5.3 57.9 20.4 115.4 49.9 163.6-64.8-17.7-110.4-59.7-133-118.2-5.6-14.4-21.8-21.6-36.2-16s-21.6 21.8-16 36.2C60.5 500.2 155.6 560 280 560s219.6-59.8 259.6-163.5c5.6-14.4-1.6-30.6-16-36.2s-30.6 1.6-36.2 16c-22.6 58.6-68.1 100.5-133 118.2 29.5-48.2 44.6-105.7 49.9-163.6 30.3-2.6 55-6 74.8-9.5 21.4-3.7 43.1-7.5 63.4-15.6 14.4-5.7 21.3-22 15.6-36.4-5.7-14.3-21.9-21.3-36.2-15.7-16.8 6.3-34.7 9.4-52.3 12.5-16.6 2.9-37.4 5.8-62.9 8.2-.7-72.7-14.8-148.3-52.2-209.2 67.8 18.5 114.6 63.6 136.1 126.8 5 14.6 20.9 22.5 35.5 17.5s22.5-20.9 17.5-35.5C506.1 64.2 408.8 0 280 0S53.9 64.2 16.5 174.1c-5 14.6 2.9 30.5 17.5 35.5s30.5-2.9 35.5-17.5zM212.4 334.6c20.7 .9 43.2 1.4 67.6 1.4s47-.5 67.6-1.4c-7.3 65.5-28.7 124.4-67.6 165.1-38.9-40.7-60.4-99.6-67.6-165.1zM280 60.3c49.2 51.5 70.3 131.9 70.6 218.2-21.3 1-44.7 1.5-70.6 1.5s-49.3-.6-70.6-1.5c.2-86.3 21.3-166.7 70.6-218.2z"/></svg>`;

const SVG_SORT_ASC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 616 560" class="forgejo-sort-icon"><path fill="currentColor" d="M309.6 216.7c0-9.5-2.2-19.6-7.6-28.8-12.4-21.5-55.1-89.5-123.4-126-7.7-4.1-15.9-5.9-23.8-5.9s-16.1 1.8-23.8 5.9c-68.3 36.5-111 104.5-123.4 126-5.3 9.3-7.6 19.3-7.6 28.8 0 23.5 14.5 48.1 42.2 54 17.3 3.7 44.4 7.6 84.6 8.8l0 196.4c0 15.5 12.5 28 28 28s28-12.5 28-28l0-196.4c40.3-1.3 67.3-5.1 84.6-8.8 27.7-5.9 42.2-30.6 42.2-54zm-154.8-104c52.3 29.1 87.5 84.2 98.8 103.7-16.9 3.4-47.9 7.6-98.8 7.6S73 219.9 56 216.4c11.3-19.5 46.5-74.6 98.8-103.7zM364 84c-15.5 0-28 12.5-28 28s12.5 28 28 28l224 0c15.5 0 28-12.5 28-28s-12.5-28-28-28L364 84zM336 448c0-15.5 12.5-28 28-28l112 0c15.5 0 28 12.5 28 28s-12.5 28-28 28l-112 0c-15.5 0-28-12.5-28-28zm28-196c-15.5 0-28 12.5-28 28s12.5 28 28 28l168 0c15.5 0 28-12.5 28-28s-12.5-28-28-28l-168 0z"/></svg>`;
const SVG_SORT_DESC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 616 560" class="forgejo-sort-icon"><path fill="currentColor" d="M309.6 343.3c0 9.5-2.2 19.6-7.6 28.8-12.4 21.5-55.1 89.5-123.4 126-7.7 4.1-15.9 5.9-23.8 5.9s-16.1-1.8-23.8-5.9c-68.3-36.5-111-104.5-123.4-126-5.3-9.3-7.6-19.3-7.6-28.8 0-23.5 14.5-48.1 42.2-54 17.3-3.7 44.4-7.6 84.6-8.8l0-196.4c0-15.5 12.5-28 28-28s28 12.5 28 28l0 196.4c40.3 1.3 67.3 5.1 84.6 8.8 27.7 5.9 42.2 30.6 42.2 54zm-154.8 104c52.3-29.1 87.5-84.2 98.8-103.7-16.9-3.4-47.9-7.6-98.8-7.6S73 340.1 56 343.6c11.3 19.5 46.5 74.6 98.8 103.7zM364 84c-15.5 0-28 12.5-28 28s12.5 28 28 28l224 0c15.5 0 28-12.5 28-28s-12.5-28-28-28L364 84zM336 448c0-15.5 12.5-28 28-28l112 0c15.5 0 28 12.5 28 28s-12.5 28-28 28l-112 0c-15.5 0-28-12.5-28-28zm28-196c-15.5 0-28 12.5-28 28s12.5 28 28 28l168 0c15.5 0 28-12.5 28-28s-12.5-28-28-28l-168 0z"/></svg>`;

const SVG_OPEN_LABEL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 672 560" class="forgejo-icon"><path fill="currentColor" d="M370.7 380c-3.9 3.1-6.7 7.6-6.7 12.6l0 27.4c0 15.5-12.5 28-28 28s-28-12.5-28-28l0-27.4c0-5-2.8-9.5-6.7-12.6-13-10.3-21.3-26.1-21.3-44 0-30.9 25.1-56 56-56s56 25.1 56 56c0 17.8-8.3 33.7-21.3 44zM470.1 78.1C456.8 91.4 448 111.8 448 140l0 33.8c26.6 4.8 52.9 14.5 72.3 33.9 17.3 17.3 27 39.5 32.5 65.1 9.8 45.4 9.8 137 0 182.4-5.5 25.6-15.2 47.8-32.5 65.1s-39.5 27-65.1 32.5c-25.3 5.5-55.7 7.2-91.2 7.2l-56 0c-35.6 0-65.9-1.7-91.2-7.2-25.6-5.5-47.8-15.2-65.1-32.5s-27-39.5-32.5-65.1c-9.8-45.4-9.8-137 0-182.4 5.5-25.6 15.2-47.8 32.5-65.1s39.5-27 65.1-32.5c25.3-5.5 55.7-7.2 91.2-7.2l56 0c9.7 0 19.1 .1 28 .4l0-28.4c0-40.3 12.9-75.9 38.5-101.5S491.7 0 532 0 607.9 12.9 633.5 38.5 672 99.7 672 140l0 56c0 15.5-12.5 28-28 28s-28-12.5-28-28l0-56c0-28.2-8.8-48.6-22.1-61.9S560.2 56 532 56 483.4 64.8 470.1 78.1zM173.9 284.6c-4.2 19.3-5.9 45-5.9 79.4s1.8 60.1 5.9 79.4c4.1 19 10.1 30.1 17.4 37.3s18.3 13.3 37.3 17.4c19.3 4.2 45 5.9 79.4 5.9l56 0c34.4 0 60.1-1.8 79.4-5.9 19-4.1 30.1-10.1 37.3-17.4s13.3-18.3 17.4-37.3c4.2-19.3 5.9-45 5.9-79.4s-1.8-60.1-5.9-79.4c-4.1-19-10.1-30.1-17.4-37.3s-18.3-13.3-37.3-17.4c-19.3-4.2-45-5.9-79.4-5.9l-56 0c-34.4 0-60.1 1.8-79.4 5.9-19 4.1-30.1 10.1-37.3 17.4s-13.3 18.3-17.4 37.3z"/></svg>`;
const SVG_CLOSED_LABEL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 560" class="forgejo-icon"><path fill="currentColor" d="M258.8 380c-3.9 3.1-6.7 7.6-6.7 12.6l0 27.4c0 15.5-12.5 28-28 28s-28-12.5-28-28l0-27.4c0-5-2.8-9.5-6.7-12.6-13-10.3-21.3-26.1-21.3-44 0-30.9 25.1-56 56-56s56 25.1 56 56c0 17.8-8.3 33.7-21.3 44zM84.2 140l0 40.9c-16.9 5.9-31.9 14.4-44.3 26.8-17.3 17.3-27 39.5-32.5 65.1-9.8 45.4-9.8 137 0 182.4 5.5 25.6 15.2 47.8 32.5 65.1s39.5 27 65.1 32.5c25.3 5.5 55.7 7.2 91.2 7.2l56 0c35.6 0 65.9-1.7 91.2-7.2 25.6-5.5 47.8-15.2 65.1-32.5s27-39.5 32.5-65.1c9.8-45.4 9.8-137 0-182.4-5.5-25.6-15.2-47.8-32.5-65.1-12.4-12.4-27.4-20.9-44.3-26.8l0-40.9c0-40.3-12.9-75.9-38.5-101.5S264.4 0 224.2 0 148.3 12.9 122.7 38.5 84.2 99.7 84.2 140zm78.1-61.9C175.6 64.8 196 56 224.2 56s48.6 8.8 61.9 22.1 22.1 33.7 22.1 61.9l0 30.1c-17-1.5-35.6-2.1-56-2.1l-56 0c-20.4 0-39 .6-56 2.1l0-30.1c0-28.2 8.8-48.6 22.1-61.9zM62.1 284.6c4.1-19 10.1-30.1 17.4-37.3s18.3-13.3 37.3-17.4c19.3-4.2 45-5.9 79.4-5.9l56 0c34.4 0 60.1 1.8 79.4 5.9 19 4.1 30.1 10.1 37.3 17.4s13.3 18.3 17.4 37.3c4.2 19.3 5.9 45 5.9 79.4s-1.8 60.1-5.9 79.4c-4.1-19-10.1-30.1-17.4-37.3s-18.3 13.3-37.3 17.4c-19.3-4.2-45-5.9-79.4-5.9l-56 0c-34.4 0-60.1-1.8-79.4-5.9-19-4.1-30.1-10.1-37.3-17.4s-13.3-18.3-17.4-37.3c-4.2-19.3-5.9-45-5.9-79.4s1.8-60.1 5.9-79.4z"/></svg>`;

// Helper function against XSS: Sanitize String inputs
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to validate safe URLs (preventing javascript: or arbitrary origins)
function sanitizeUrl(rawUrl: string, expectedHostUrl?: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '#';
    }
    if (expectedHostUrl) {
      const expected = new URL(expectedHostUrl);
      if (url.origin !== expected.origin) return '#';
    }
    return url.toString();
  } catch {
    return '#';
  }
}

export default class ForgejoPlugin extends Plugin {
  settings: ForgejoSettings;
  intervalId: number | null = null;
  cacheMemory: CacheData = {};
  cachePath: string;

  async onload() {
    await this.loadSettings();
    this.cachePath = `${this.manifest.dir}/cache.json`;
    await this.loadCache();
    this.injectStyles();
    this.addSettingTab(new ForgejoSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor('FPR', (source, el) => this.renderForgejoSingleItem(source.trim(), el, 'pr'));
    this.registerMarkdownCodeBlockProcessor('FIS', (source, el) => this.renderForgejoSingleItem(source.trim(), el, 'issue'));

    this.registerMarkdownCodeBlockProcessor('FIS-ALL', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'all'));
    this.registerMarkdownCodeBlockProcessor('FIS-OPEN', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'open'));
    this.registerMarkdownCodeBlockProcessor('FIS-CLOSED', (source, el) => this.renderForgejoList(source.trim(), el, 'issue', 'closed'));

    this.registerMarkdownCodeBlockProcessor('FPR-ALL', (source, el) => this.renderForgejoList(source.trim(), el, 'pr', 'all'));
    this.registerMarkdownCodeBlockProcessor('FPR-OPEN', (source, el) => this.renderForgejoList(source.trim(), el, 'pr', 'open'));
    this.registerMarkdownCodeBlockProcessor('FPR-CLOSED', (source, el) => this.renderForgejoList(source.trim(), el, 'pr', 'closed'));

    this.registerMarkdownCodeBlockProcessor('FPR-LIST', (source, el) => this.renderUserPRList(source.trim(), el, 'all'));
    this.registerMarkdownCodeBlockProcessor('FPR-LIST-OPEN', (source, el) => this.renderUserPRList(source.trim(), el, 'open'));
    this.registerMarkdownCodeBlockProcessor('FPR-LIST-CLOSED', (source, el) => this.renderUserPRList(source.trim(), el, 'closed'));

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

  async loadCache() {
    try {
      if (await this.app.vault.adapter.exists(this.cachePath)) {
        const content = await this.app.vault.adapter.read(this.cachePath);
        this.cacheMemory = JSON.parse(content);
      }
    } catch {
      this.cacheMemory = {};
    }
  }

  async saveCache() {
    try {
      await this.app.vault.adapter.write(this.cachePath, JSON.stringify(this.cacheMemory, null, 2));
    } catch (err) {
      console.error('Failed to save Forgejo cache', err);
    }
  }

  injectStyles() {
    let styleEl = document.getElementById('forgejo-plugin-styles') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'forgejo-plugin-styles';
      document.head.appendChild(styleEl);
    }

    let headerBg = 'var(--background-secondary-alt, var(--background-secondary))';
    let subHeaderBg = 'var(--background-secondary)';
    let textHeader = 'var(--text-normal)';
    let borderCol = 'var(--table-border, var(--border-color, #444))';
    let rowBgPrimary = 'var(--background-primary)';
    let zebraBg = 'var(--background-secondary-alt)';
    let rowTextColor = 'var(--text-normal)';

    switch (this.settings.themeStyle) {
      case "dark":
        headerBg = "#1e1e2e"; subHeaderBg = "#2d2d3d"; textHeader = "#cdd6f4"; borderCol = "#45475a"; rowBgPrimary = "#1e1e2e"; zebraBg = "#181825"; rowTextColor = "#cdd6f4"; break;
      case "light":
        headerBg = "#e6e9ef"; subHeaderBg = "#dce0e8"; textHeader = "#4c4f69"; borderCol = "#bcc0cc"; rowBgPrimary = "#ffffff"; zebraBg = "#f2f4f8"; rowTextColor = "#4c4f69"; break;
      case "blue":
        headerBg = "#1e3a8a"; subHeaderBg = "#1d4ed8"; textHeader = "#ffffff"; borderCol = "#3b82f6"; rowBgPrimary = "#ffffff"; zebraBg = "#eff6ff"; rowTextColor = "#1e293b"; break;
      case "purple":
        headerBg = "#581c87"; subHeaderBg = "#7e22ce"; textHeader = "#ffffff"; borderCol = "#a855f7"; rowBgPrimary = "#ffffff"; zebraBg = "#faf5ff"; rowTextColor = "#2e1065"; break;
      case "mono":
        headerBg = "#18181b"; subHeaderBg = "#27272a"; textHeader = "#ffffff"; borderCol = "#71717a"; rowBgPrimary = "#ffffff"; zebraBg = "#f4f4f5"; rowTextColor = "#18181b"; break;
      case "sepia":
        headerBg = "#78350f"; subHeaderBg = "#92400e"; textHeader = "#fff7ed"; borderCol = "#d97706"; rowBgPrimary = "#fffbeb"; zebraBg = "#fef3c7"; rowTextColor = "#451a03"; break;
      case "nord":
        headerBg = "#2e3440"; subHeaderBg = "#3b4252"; textHeader = "#eceff4"; borderCol = "#4c566a"; rowBgPrimary = "#eceff4"; zebraBg = "#e5e9f0"; rowTextColor = "#2e3440"; break;
      case "dracula":
        headerBg = "#282a36"; subHeaderBg = "#44475a"; textHeader = "#f8f8f2"; borderCol = "#6272a4"; rowBgPrimary = "#282a36"; zebraBg = "#21222c"; rowTextColor = "#f8f8f2"; break;
      case "cyberpunk":
        headerBg = "#18181b"; subHeaderBg = "#27272a"; textHeader = "#f0abfc"; borderCol = "#d946ef"; rowBgPrimary = "#09090b"; zebraBg = "#18181b"; rowTextColor = "#e879f9"; break;
      case "midnight":
        headerBg = "#0f172a"; subHeaderBg = "#1e293b"; textHeader = "#e2e8f0"; borderCol = "#334155"; rowBgPrimary = "#111827"; zebraBg = "#0f172a"; rowTextColor = "#e2e8f0"; break;
      case "slate":
        headerBg = "#1e293b"; subHeaderBg = "#334155"; textHeader = "#f8fafc"; borderCol = "#64748b"; rowBgPrimary = "#ffffff"; zebraBg = "#f8fafc"; rowTextColor = "#1e293b"; break;
      case "teal":
        headerBg = "#134e4a"; subHeaderBg = "#0f766e"; textHeader = "#ffffff"; borderCol = "#14b8a6"; rowBgPrimary = "#ffffff"; zebraBg = "#f0fdfa"; rowTextColor = "#134e4a"; break;
      case "amber":
        headerBg = "#92400e"; subHeaderBg = "#b45309"; textHeader = "#ffffff"; borderCol = "#f59e0b"; rowBgPrimary = "#ffffff"; zebraBg = "#fffbeb"; rowTextColor = "#451a03"; break;
    }

    styleEl.textContent = `
      .forgejo-container { margin: 14px 0; overflow-x: auto; font-family: var(--font-interface); }
      .forgejo-table { width: 100%; border-collapse: collapse; margin: 6px 0; border: 1px solid ${borderCol} !important; background-color: ${rowBgPrimary} !important; font-size: 0.88em; border-radius: 4px; overflow: hidden; }
      .forgejo-table th { border: 1px solid ${borderCol} !important; padding: 8px 12px; text-align: left; vertical-align: middle; color: ${textHeader} !important; }
      .forgejo-table td { border: 1px solid ${borderCol} !important; padding: 8px 12px; text-align: left; vertical-align: middle; color: ${rowTextColor} !important; }
      .forgejo-main-header { background-color: ${headerBg} !important; font-size: 1.05em; font-weight: bold; padding: 10px; text-align: center !important; color: ${textHeader} !important; }
      .forgejo-cols-row th { background-color: ${subHeaderBg} !important; font-weight: 600; color: ${textHeader} !important; text-align: left; }
      .forgejo-table tbody tr { background-color: ${rowBgPrimary} !important; }
      .forgejo-table tbody tr:nth-child(even) { background-color: ${zebraBg} !important; }
      .forgejo-fallback-cell { text-align: center !important; font-style: italic; color: var(--text-muted) !important; padding: 16px !important; }
      .forgejo-user { display: inline-flex; align-items: center; gap: 8px; }
      .forgejo-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
      .forgejo-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8em; text-align: center; }
      .forgejo-badge-open { background-color: #22c55e22; color: #22c55e !important; border: 1px solid #22c55e; }
      .forgejo-badge-closed { background-color: #ef444422; color: #ef4444 !important; border: 1px solid #ef4444; }
      .forgejo-icon { width: 14px; height: 14px; fill: currentColor; display: inline-block; flex-shrink: 0; }
      .forgejo-inline-icon { display: inline-flex; align-items: center; gap: 6px; }
      .forgejo-sortable-th { cursor: pointer; user-select: none; }
      .forgejo-sortable-th:hover { opacity: 0.85; }
      .forgejo-th-content { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
      .forgejo-sort-icon { width: 14px; height: 14px; fill: currentColor; display: inline-block; opacity: 0.6; flex-shrink: 0; }
    `;
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // Unobfuscate stored Token from storage
    if (this.settings.apiToken && this.settings.apiToken.startsWith('enc_b64:')) {
      try {
        this.settings.apiToken = atob(this.settings.apiToken.replace('enc_b64:', ''));
      } catch {
        this.settings.apiToken = '';
      }
    }
  }

  async saveSettings() {
    // Obfuscate token before saving to data.json
    const rawToken = this.settings.apiToken;
    const settingsToSave = Object.assign({}, this.settings);
    if (rawToken) {
      settingsToSave.apiToken = 'enc_b64:' + btoa(rawToken);
    }

    await this.saveData(settingsToSave);
    this.injectStyles();
    this.startAutoRefresh();
    this.refreshViews();
  }

  refreshViews() {
    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf.view && leaf.view.getViewType() === 'markdown') {
        const view = leaf.view as any;
        if (view.previewMode) {
          view.previewMode.rerender(true);
        }
        if (view.editor) {
          view.editor.setValue(view.editor.getValue());
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
      
      // Strict origin validation against configured server URL
      const configuredUrl = new URL(this.settings.serverUrl);
      if (url.origin !== configuredUrl.origin) {
        return null;
      }

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
    const now = Date.now();

    if (this.settings.enableCache && this.cacheMemory[endpoint]) {
      const cached = this.cacheMemory[endpoint];
      if (now - cached.timestamp < this.settings.refreshInterval) {
        return cached.data as T;
      }
    }

    if (!this.settings.serverUrl) throw new Error('Server URL not set');
    const baseUrl = this.settings.serverUrl.replace(/\/$/, '');
    
    // Strict URL construction and protocol enforcement
    const targetUrl = new URL(`${baseUrl}/api/v1/${endpoint.replace(/^\//, '')}`);
    const configuredUrl = new URL(this.settings.serverUrl);
    
    if (targetUrl.origin !== configuredUrl.origin || (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:')) {
      throw new Error('Blocked unauthorized request destination');
    }

    const options: RequestUrlParam = {
      url: targetUrl.toString(),
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `token ${this.settings.apiToken}`
      }
    };

    const res = await requestUrl(options);
    if (res.status >= 400) throw new Error(`Forgejo API error HTTP ${res.status}`);
    
    const data = res.json as T;

    if (this.settings.enableCache) {
      this.cacheMemory[endpoint] = { timestamp: now, data };
      await this.saveCache();
    }

    return data;
  }

  async fetchRawFile(owner: string, repo: string, filepath: string): Promise<string | null> {
    try {
      const baseUrl = this.settings.serverUrl.replace(/\/$/, '');
      const targetUrl = new URL(`${baseUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${filepath.replace(/^\//, '')}`);
      const configuredUrl = new URL(this.settings.serverUrl);

      if (targetUrl.origin !== configuredUrl.origin) return null;

      const options: RequestUrlParam = {
        url: targetUrl.toString(),
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
        return escapeHtml(file.split('.')[0]);
      }
    }
    return "None";
  }

  formatUser(user?: ForgejoUser): string {
    if (!user) return 'N/A';
    const cleanLogin = escapeHtml(user.login);
    const cleanAvatar = user.avatar_url ? sanitizeUrl(user.avatar_url) : '';
    const avatar = cleanAvatar && cleanAvatar !== '#' 
      ? `<img src="${cleanAvatar}" class="forgejo-avatar" alt="${cleanLogin}" />` 
      : '';
    return `<div class="forgejo-user">${avatar}<span>${cleanLogin}</span></div>`;
  }

  formatStatus(status: string): string {
    const state = escapeHtml((status || 'UNKNOWN').toUpperCase());
    const cls = state === 'OPEN' ? 'forgejo-badge-open' : 'forgejo-badge-closed';
    const icon = state === 'OPEN' ? SVG_OPEN_LABEL : SVG_CLOSED_LABEL;

    return `<span class="forgejo-badge ${cls}">${icon} ${state}</span>`;
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : escapeHtml(d.toLocaleDateString());
  }

  extractPushDate(repo: ForgejoRepo): string {
    const rawDate = repo.pushed_at || repo.updated_at || repo.updated;
    return this.formatDate(rawDate);
  }

  renderVisibility(isPrivate: boolean): string {
    const icon = isPrivate ? SVG_LOCK : SVG_GLOBE;
    const text = isPrivate ? 'Private' : 'Public';
    return `<span class="forgejo-inline-icon">${icon} <span>${text}</span></span>`;
  }

  async renderForgejoSingleItem(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue') {
    el.empty();
    const container = el.createDiv({ cls: 'forgejo-container' });
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure Server URL and API Token in settings.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed || !parsed.index) {
      container.createEl('p', { text: `❌ Invalid URL or unauthorized domain: "${escapeHtml(rawUrl)}"`, cls: 'mod-warning' });
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
          ['Title', escapeHtml(data.title || 'N/A')],
          ['Status', this.formatStatus(data.state)],
          ['Author', this.formatUser(data.user)],
          ['Created', this.formatDate(data.created_at)],
          ['Link', `<a href="${sanitizeUrl(data.html_url, this.settings.serverUrl)}" target="_blank" rel="noopener">Open</a>`]
        ]);
      } else {
        const data = await this.fetchApi<ForgejoIssue>(endpoint);
        container.empty();
        const labels = data.labels && data.labels.length > 0 
          ? data.labels.map(l => escapeHtml(l.name)).join(', ') 
          : 'None';
        this.buildSingleTable(container, `Issue #${data.number}`, [
          ['Title', escapeHtml(data.title || 'N/A')],
          ['Status', this.formatStatus(data.state)],
          ['Author', this.formatUser(data.user)],
          ['Labels', labels],
          ['Created', this.formatDate(data.created_at)],
          ['Link', `<a href="${sanitizeUrl(data.html_url, this.settings.serverUrl)}" target="_blank" rel="noopener">Open</a>`]
        ]);
      }
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${escapeHtml(err instanceof Error ? err.message : String(err))}`, cls: 'mod-warning' });
    }
  }

  async renderForgejoList(rawUrl: string, el: HTMLElement, type: 'pr' | 'issue', state: 'all' | 'open' | 'closed') {
    el.empty();
    const container = el.createDiv({ cls: 'forgejo-container' });
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure Server URL and API Token in settings.', cls: 'mod-warning' });
      return;
    }

    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl('p', { text: `❌ Invalid Repository URL or unauthorized domain: "${escapeHtml(rawUrl)}"`, cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: 'Loading list...' });

    try {
      const endpoint = type === 'pr'
        ? `repos/${parsed.owner}/${parsed.repo}/pulls?state=${state}`
        : `repos/${parsed.owner}/${parsed.repo}/issues?state=${state}`;

      const items = await this.fetchApi<any[]>(endpoint);
      container.empty();

      const title = `${type === 'pr' ? 'Pull Requests' : 'Issues'} (${state.toUpperCase()}) - ${escapeHtml(parsed.owner)}/${escapeHtml(parsed.repo)}`;
      const headers = ['ID', 'Title', 'Status', 'Author', 'Created', 'Link'];

      if (!items || items.length === 0) {
        this.buildStructuredTable(container, title, headers, [], `No ${type === 'pr' ? 'pull requests' : 'issues'} found for state "${state}".`);
        return;
      }

      const rows = items.map(item => [
        `#${item.number}`,
        escapeHtml(item.title || 'N/A'),
        this.formatStatus(item.state),
        this.formatUser(item.user),
        this.formatDate(item.created_at),
        `<a href="${sanitizeUrl(item.html_url, this.settings.serverUrl)}" target="_blank" rel="noopener">Open</a>`
      ]);

      this.buildStructuredTable(container, title, headers, rows);
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${escapeHtml(err instanceof Error ? err.message : String(err))}`, cls: 'mod-warning' });
    }
  }

  async renderUserPRList(username: string, el: HTMLElement, state: 'all' | 'open' | 'closed') {
    el.empty();
    const container = el.createDiv({ cls: 'forgejo-container' });
    if (!this.settings.apiToken || !this.settings.serverUrl) {
      container.createEl('p', { text: '⚠️ Please configure Server URL and API Token in settings.', cls: 'mod-warning' });
      return;
    }

    const cleanUser = username.replace(/[\[\]'"]/g, '').trim();
    if (!cleanUser) {
      container.createEl('p', { text: '❌ Invalid Username specified.', cls: 'mod-warning' });
      return;
    }

    container.createEl('span', { text: `Loading PRs for user ${escapeHtml(cleanUser)}...` });

    try {
      const endpoint = `repos/issues/search?state=${state}&type=pulls&created_by=${encodeURIComponent(cleanUser)}`;
      const response = await this.fetchApi<any>(endpoint);
      const items: ForgejoPR[] = Array.isArray(response) ? response : (response.data || []);
      
      container.empty();

      const title = `Pull Requests (${state.toUpperCase()}) - User: ${escapeHtml(cleanUser)}`;
      const headers = ['Repo', 'ID', 'Title', 'Status', 'Created', 'Link'];

      if (!items || items.length === 0) {
        this.buildStructuredTable(container, title, headers, [], `No pull requests found for user "${escapeHtml(cleanUser)}" with state "${state}".`);
        return;
      }

      const rows = items.map(item => [
        escapeHtml(item.repository ? item.repository.full_name : 'N/A'),
        `#${item.number}`,
        escapeHtml(item.title || 'N/A'),
        this.formatStatus(item.state),
        this.formatDate(item.created_at),
        `<a href="${sanitizeUrl(item.html_url, this.settings.serverUrl)}" target="_blank" rel="noopener">Open</a>`
      ]);

      this.buildStructuredTable(container, title, headers, rows);
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${escapeHtml(err instanceof Error ? err.message : String(err))}`, cls: 'mod-warning' });
    }
  }

  async renderRepoDetails(rawUrl: string, el: HTMLElement) {
    el.empty();
    const container = el.createDiv({ cls: 'forgejo-container' });
    const parsed = this.parseUrl(rawUrl);
    if (!parsed) {
      container.createEl('p', { text: `❌ Invalid Repository URL or unauthorized domain: "${escapeHtml(rawUrl)}"`, cls: 'mod-warning' });
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
        if (releases && releases.length > 0) lastReleaseTag = escapeHtml(releases[0].tag_name || releases[0].name);
      } catch { /* Suppress */ }

      container.empty();
      const headers = ['Name', 'Issues (O/C)', 'PRs (O/C)', 'Created', 'Last Push', 'Release', 'License'];
      const rows = [[
        `<a href="${sanitizeUrl(repo.html_url, this.settings.serverUrl)}" target="_blank" rel="noopener">${escapeHtml(parsed.repo)}</a>`,
        `${openIssues.length} / ${closedIssues.length}`,
        `${openPRs.length} / ${closedPRs.length}`,
        this.formatDate(repo.created_at),
        this.extractPushDate(repo),
        lastReleaseTag,
        license
      ]];

      this.buildStructuredTable(container, `Repository: ${escapeHtml(repo.full_name)}`, headers, rows);
    } catch (err) {
      container.empty();
      container.createEl('p', { text: `Fetch error: ${escapeHtml(err instanceof Error ? err.message : String(err))}`, cls: 'mod-warning' });
    }
  }

  async renderAllUserRepos(el: HTMLElement) {
    el.empty();
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

        const lastRelease = releases && releases.length > 0 ? escapeHtml(releases[0].tag_name || releases[0].name) : 'None';

        return [
          `<a href="${sanitizeUrl(repo.html_url, this.settings.serverUrl)}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a>`,
          this.renderVisibility(repo.private),
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
      container.createEl('p', { text: `Fetch error: ${escapeHtml(err instanceof Error ? err.message : String(err))}`, cls: 'mod-warning' });
    }
  }

  private stripHtml(html: string): string {
    const tmp = document.createElement('DIV');
    tmp.textContent = html;
    return tmp.textContent || '';
  }

  buildStructuredTable(parent: HTMLElement, title: string, headers: string[], rows: string[][], fallbackText?: string) {
    let currentRows = [...rows];
    let sortColumnIndex: number | null = null;
    let sortAscending = true;

    const table = parent.createEl('table', { cls: 'forgejo-table' });
    const thead = table.createEl('thead');

    const titleRow = thead.createEl('tr', { cls: 'forgejo-title-row' });
    const titleTh = titleRow.createEl('th', { attr: { colspan: String(headers.length) } });
    titleTh.textContent = title;
    titleTh.addClass('forgejo-main-header');

    const headerRow = thead.createEl('tr', { cls: 'forgejo-cols-row' });
    const tbody = table.createEl('tbody');

    const renderTbody = () => {
      tbody.empty();
      if (currentRows.length === 0) {
        const emptyRow = tbody.createEl('tr');
        const emptyTd = emptyRow.createEl('td', { attr: { colspan: String(headers.length) }, cls: 'forgejo-fallback-cell' });
        emptyTd.textContent = fallbackText || 'No data available.';
        return;
      }

      for (const rowContent of currentRows) {
        const tr = tbody.createEl('tr');
        for (const cell of rowContent) {
          const td = tr.createEl('td');
          if (cell.includes('<a ') || cell.includes('<div ') || cell.includes('<span ') || cell.includes('<img ') || cell.includes('<svg ')) {
            td.innerHTML = cell;
          } else {
            td.textContent = cell;
          }
        }
      }
    };

    const updateHeaders = () => {
      headerRow.empty();
      headers.forEach((h, index) => {
        const th = headerRow.createEl('th');
        
        if (h.toLowerCase() === 'link') {
          th.textContent = h;
          return;
        }

        if (rows.length > 1) {
          th.addClass('forgejo-sortable-th');
          const wrapper = th.createDiv({ cls: 'forgejo-th-content' });
          wrapper.createSpan({ text: h });

          const iconContainer = wrapper.createSpan();
          if (sortColumnIndex === index) {
            iconContainer.innerHTML = sortAscending ? SVG_SORT_ASC : SVG_SORT_DESC;
          } else {
            iconContainer.innerHTML = SVG_SORT_ASC;
            (iconContainer.firstChild as HTMLElement)?.setAttribute('style', 'opacity: 0.2;');
          }

          th.addEventListener('click', () => {
            if (sortColumnIndex === index) {
              sortAscending = !sortAscending;
            } else {
              sortColumnIndex = index;
              sortAscending = true;
            }

            currentRows.sort((a, b) => {
              const valA = this.stripHtml(a[index]).trim();
              const valB = this.stripHtml(b[index]).trim();

              const numA = parseFloat(valA.replace('#', ''));
              const numB = parseFloat(valB.replace('#', ''));

              if (!isNaN(numA) && !isNaN(numB) && !valA.includes('.') && !valA.includes('/')) {
                return sortAscending ? numA - numB : numB - numA;
              }

              const parseCustomDate = (str: string): number => {
                if (!str || str === 'N/A' || str === 'None') return 0;
                
                const deMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
                if (deMatch) {
                  return new Date(parseInt(deMatch[3]), parseInt(deMatch[2]) - 1, parseInt(deMatch[1])).getTime();
                }

                const timestamp = Date.parse(str);
                return isNaN(timestamp) ? -1 : timestamp;
              };

              const dateA = parseCustomDate(valA);
              const dateB = parseCustomDate(valB);

              if (dateA !== -1 && dateB !== -1 && (dateA > 0 || dateB > 0)) {
                return sortAscending ? dateA - dateB : dateB - dateA;
              }

              return sortAscending 
                ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
                : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
            });

            updateHeaders();
            renderTbody();
          });
        } else {
          th.textContent = h;
        }
      });
    };

    updateHeaders();
    renderTbody();
  }

  buildSingleTable(parent: HTMLElement, typeTitle: string, rows: [string, string][]) {
    const table = parent.createEl('table', { cls: 'forgejo-table' });
    const thead = table.createEl('thead');
    
    if (this.settings.tableLayout === 'vertical') {
      const titleRow = thead.createEl('tr', { cls: 'forgejo-title-row' });
      const th = titleRow.createEl('th', { attr: { colspan: '2' } });
      th.textContent = typeTitle;
      th.addClass('forgejo-main-header');

      const tbody = table.createEl('tbody');
      for (const [key, val] of rows) {
        const tr = tbody.createEl('tr');
        tr.createEl('td', { text: key, attr: { style: 'font-weight: bold; width: 30%;' } });
        const tdVal = tr.createEl('td');
        if (val.includes('<a ') || val.includes('<div ') || val.includes('<span ') || val.includes('<img ') || val.includes('<svg ')) tdVal.innerHTML = val;
        else tdVal.textContent = val;
      }
    } else {
      const titleRow = thead.createEl('tr', { cls: 'forgejo-title-row' });
      const th = titleRow.createEl('th', { attr: { colspan: String(rows.length) } });
      th.textContent = typeTitle;
      th.addClass('forgejo-main-header');

      const headerRow = thead.createEl('tr', { cls: 'forgejo-cols-row' });
      for (const [key] of rows) {
        headerRow.createEl('th', { text: key });
      }

      const tbody = table.createEl('tbody');
      const tr = tbody.createEl('tr');
      for (const [, val] of rows) {
        const tdVal = tr.createEl('td');
        if (val.includes('<a ') || val.includes('<div ') || val.includes('<span ') || val.includes('<img ') || val.includes('<svg ')) tdVal.innerHTML = val;
        else tdVal.textContent = val;
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

    containerEl.createEl('h2', { text: 'Forgejo Integrator Settings' });

    const infoBox = containerEl.createDiv({ cls: 'forgejo-info-box', attr: { style: 'margin-bottom: 20px; padding: 12px; background-color: var(--background-secondary); border-radius: 6px;' } });
    infoBox.createEl('h3', { text: 'Available Codeblocks', attr: { style: 'margin-top: 0;' } });
    const list = infoBox.createEl('ul');
    list.createEl('li', { text: 'Single Items: ```FIS or ```FPR + Item URL' });
    list.createEl('li', { text: 'Issue Lists: ```FIS-ALL, ```FIS-OPEN, ```FIS-CLOSED + Repo URL' });
    list.createEl('li', { text: 'PR Lists: ```FPR-ALL, ```FPR-OPEN, ```FPR-CLOSED + Repo URL' });
    list.createEl('li', { text: 'User PRs: ```FPR-LIST, ```FPR-LIST-OPEN, ```FPR-LIST-CLOSED + Username' });
    list.createEl('li', { text: 'Repo Issues: ```FRI, ```FRI-OPEN, ```FRI-CLOSED + Repo URL' });
    list.createEl('li', { text: 'Single Repo Details: ```FR + Repo URL' });
    list.createEl('li', { text: 'All Repositories Overview: ```FR-ALL (No URL needed)' });

    new Setting(containerEl)
      .setName('Forgejo Server URL')
      .setDesc('Base URL of your Forgejo instance (e.g. https://my-forgejo-instance.com)')
      .addText(text => text
        .setPlaceholder('https://my-forgejo-instance.com')
        .setValue(this.plugin.settings.serverUrl)
        .onChange(async (value) => {
          this.plugin.settings.serverUrl = value.trim();
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
            this.plugin.settings.apiToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Enable Caching')
      .setDesc('Cache API responses locally to prevent unnecessary network requests until interval expires.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableCache)
        .onChange(async (value) => {
          this.plugin.settings.enableCache = value;
          await this.plugin.saveSettings();
        }));

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
      .setName('Table Theme')
      .setDesc('Select color theme for rendered tables')
      .addDropdown(dropdown => dropdown
        .addOption('dark', 'Dark Contrast')
        .addOption('light', 'Light Clean')
        .addOption('blue', 'Modern Blue')
        .addOption('purple', 'Purple Accent')
        .addOption('mono', 'Mono')
        .addOption('sepia', 'Sepia')
        .addOption('nord', 'Nord')
        .addOption('dracula', 'Dracula')
        .addOption('cyberpunk', 'Cyberpunk')
        .addOption('midnight', 'Midnight')
        .addOption('slate', 'Slate')
        .addOption('teal', 'Teal')
        .addOption('amber', 'Amber')
        .setValue(this.plugin.settings.themeStyle)
        .onChange(async (value) => {
          this.plugin.settings.themeStyle = value as any;
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