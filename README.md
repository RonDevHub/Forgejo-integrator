# Obsidian Forgejo Integrator

A lightweight Obsidian plugin to embed and visualize Forgejo Issues and Pull Requests as clean, styled tables directly inside your notes.

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/donate/?hosted_button_id=PWY939TPCQ3RA)

## Features

- **Issue Visualizer (`FIS`)**: Embed detailed summaries of Forgejo Issues.
- **Pull Request Visualizer (`FPR`)**: Embed detailed summaries of Forgejo Pull Requests.
- **Flexible Layouts**: Choose between vertical (Key-Value) and horizontal (Column) table layouts.
- **Secure Configuration**: Password-masked API Token input and built-in connection test.
- **Cross-Platform**: Uses Obsidian's native `requestUrl` to prevent CORS issues on Desktop and Mobile.

## Usage

Simply paste the Forgejo Issue or PR URL inside a Markdown codeblock:

### Issue Codeblock (`FIS`)

```FIS
[https://commitcloud.net/RonDevHub/devwebsite/issues/4](https://commitcloud.net/RonDevHub/devwebsite/issues/4)
```

### Pull Request Codeblock (`FPR`)

```FPR
[https://commitcloud.net/RonDevHub/devwebsite/pulls/1](https://commitcloud.net/RonDevHub/devwebsite/pulls/1)
```

## Settings

1. Go to **Obsidian Settings** -> **Forgejo Integrator**.
2. Enter your **Forgejo Server URL** (e.g., `https://commitcloud.net`).
3. Provide your **API Token** (Read-only access to repositories is sufficient).
4. Select your preferred **Table Layout** (Vertical or Horizontal).
5. Click **Test Connection** to verify your setup.

## Build from Source

```bash
npm install
npm run build
```

## License

MIT