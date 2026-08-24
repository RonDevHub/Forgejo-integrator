# Obsidian Forgejo Plugin

Seamlessly integrate and render live data from your **Forgejo** (or Gitea) instance directly inside your **Obsidian** notes using custom Markdown code blocks.

Track single issues, pull requests, repository overviews, and filtered lists in real-time with customizable themes and sortable tables.

---

## 🌟 Key Features

- **Live Data Fetching**: Pulls real-time information directly from your self-hosted Forgejo/Gitea REST API.
- **Interactive & Sortable Tables**: Sort lists dynamically by clicking on column headers (supports numeric, date, and alphabetical sorting).
- **Multiple Markdown Code Blocks**: Embed individual items, repository lists, user-specific pull requests, or complete account overviews.
- **Customizable Themes & Layouts**: Choose between 13 color themes (`dark`, `light`, `blue`, `purple`, `mono`, `sepia`, `nord`, `dracula`, `cyberpunk`, `midnight`, `slate`, `teal`, `amber`) and vertical/horizontal single-item views.
- **Client-side Caching & Polling**: Reduce server load and API limits with built-in caching and configurable auto-refresh intervals.
- **Security First**: Input sanitization against XSS and token obfuscation in plugin settings.

---

## 🚀 Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a folder named `obsidian-forgejo-plugin` inside your vault's plugin folder (`<vault>/.obsidian/plugins/`).
3. Copy the downloaded files into `<vault>/.obsidian/plugins/obsidian-forgejo-plugin/`.
4. Open Obsidian, go to **Settings > Community Plugins**, and enable **Forgejo Integrator**.

---

## ⚙️ Configuration

Navigate to **Settings > Forgejo Integrator** to configure the plugin:

1. **Forgejo Server URL**: Base URL of your Forgejo instance (e.g., `https://forgejo.yourdomain.com`).
2. **API Token**: A Personal Access Token with **Read** access to your repositories and user profile.
3. **Table Theme**: Select a theme (`dark`, `light`, `blue`, `purple`, `mono`, `sepia`, `nord`, `dracula`, `cyberpunk`, `midnight`, `slate`, `teal`, `amber`).
4. **Table Layout**: Toggle between `vertical` and `horizontal` presentation for single-item blocks.
5. **Enable Caching**: Toggle local disk/memory caching to minimize network requests.
6. **Refresh Interval**: Set auto-update frequency (Realtime, 1 min, 5 min, 30 min, 1 hr).
7. **Test Connection**: Click the **Test Connection** button to verify your API credentials.

---

## 📝 Usage & Code Block Examples

Simply paste any of the following code blocks into your Obsidian notes:

### 1. Single Issues & Pull Requests

Render detailed information about a specific issue or pull request.

````markdown
```FIS
https://forgejo.yourdomain.com/owner/repo/issues/42
```
````
