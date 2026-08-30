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
6. **Display Language**: Select the output language for tables
7. **Refresh Interval**: Set auto-update frequency (Realtime, 1 min, 5 min, 30 min, 1 hr).
8. **Test Connection**: Click the **Test Connection** button to verify your API credentials.

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

````markdown
```FPR
https://forgejo.yourdomain.com/owner/repo/pulls/15
```
````

### 2. Repository Issue Lists

Render lists of issues for a specific repository.
- All Issues: `FIS-ALL` or `FRI`
- Open Issues: `FIS-OPEN` or `FRI-OPEN`
- Closed Issues: `FIS-CLOSED` or `FRI-CLOSED`

````markdown
```FIS-OPEN
https://forgejo.yourdomain.com/owner/repo
```
````

### 3. Repository Pull Request Lists

Render pull requests filtered by status for a specific repository.
- All PRs: `FPR-ALL`
- Open PRs: `FPR-OPEN`
- Closed PRs: `FPR-CLOSED`

````markdown
```FPR-OPEN
https://forgejo.yourdomain.com/owner/repo
```
````

### 4. User Pull Requests

Display pull requests created by a specific user across all accessible repositories.
- All User PRs: `FPR-LIST`
- Open User PRs: `FPR-LIST-OPEN`
- Closed User PRs: `FPR-LIST-CLOSED`

````markdown
```FPR-LIST-OPEN
octocat
```
```` 

### 5. Repository Summaries & Overview

- Single Repository Overview: Displays metrics (issues count, open PRs, license, last push date, latest release tag).

````markdown
```FR
https://forgejo.yourdomain.com/owner/repo
```
````

- All User Repositories Overview: Displays a comprehensive overview table of all repositories accessible by the configured API token (no URL required).

````markdown
```FR-ALL
```
```` 

## 🎨 Codeblock Syntax Quick Reference

| **Codeblock**               | **Scope**    | **Argument** | **Description**                                |
| --------------------------- | ------------ | ------------ | ---------------------------------------------- |
| `FIS`                       | Single Issue | Issue URL    | Renders detailed view of a single issue        |
| `FPR`                       | Single PR    | PR URL       | Renders detailed view of a single pull request |
| `FIS-ALL` / `FRI`           | Issues       | Repo URL     | Lists all issues in a repository               |
| `FIS-OPEN` / `FRI-OPEN`     | Issues       | Repo URL     | Lists open issues in a repository              |
| `FIS-CLOSED` / `FRI-CLOSED` | Issues       | Repo URL     | Lists closed issues in a repository            |
| `FPR-ALL`                   | PRs          | Repo URL     | Lists all pull requests in a repository        |
| `FPR-OPEN`                  | PRs          | Repo URL     | Lists open pull requests in a repository       |
| `FPR-CLOSED`                | PRs          | Repo URL     | Lists closed pull requests in a repository     |
| `FPR-LIST`                  | User PRs     | Username     | Lists all PRs authored by user                 |
| `FPR-LIST-OPEN`             | User PRs     | Username     | Lists open PRs authored by user                |
| `FPR-LIST-CLOSED`           | User PRs     | Username     | Lists closed PRs authored by user              |
| `FR`                        | Repository   | Repo URL     | Displays single repo summary & metrics         |
| `FR-ALL`                     | All Repos    | *None*       | Overview table of all authenticated user repos |

## ☕ Support & Donation

If you find this plugin useful, consider supporting its ongoing development!

[![Buy me a coffee](https://mini-badges.rondev.de/icon/cuptogo/Buy_me_a_Coffee-c1d82f-222/for-the-badge "Buy me a coffee")](https://www.buymeacoffee.com/RonDev)
[![Buy me a coffee](https://mini-badges.rondev.de/icon/cuptogo/ko--fi.com-c1d82f-222/for-the-badge "Buy me a coffee")](https://ko-fi.com/U6U31EV2VS)
[![Pizza Power](https://mini-badges.rondev.de/icon/paypal/PayPal/for-the-badge "Pizza Power")](https://www.paypal.com/donate/?hosted_button_id=PWY939TPCQ3RA)