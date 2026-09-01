<p align="center">
  <img src="src/renderer/src/icons/hyperswitch.svg" width="88" height="88" alt="HyperSwitch">
</p>

<h1 align="center">HyperSwitch</h1>

<p align="center">Write providers, models, and prompts into each agent’s local config.</p>

<p align="center">
  <b>English</b> · <a href="./README.zh-CN.md">简体中文</a>
</p>

---

A desktop configuration manager. Keep API providers and models in one place, then write them into each tool’s own config files—so you are not editing Claude Code, Codex, OpenCode, Grok, and the rest by hand.

## Features

- **Providers**: custom Base URL, API key, API format, and models; IDs can be fetched from OpenAI-compatible `/models`
- **Model catalog**: refresh context window, max output, thinking levels, and modalities from [models.dev](https://models.dev) for prefilling when you add a model
- **Prompt / header presets**: reusable entries you can apply on the Agent page
- **Agent tools**: detect local config directories, edit them, and write back
- **First-run guide**: if `~/.hyperswitch/onboarded` is missing, you are asked to update models.dev and shown how to use the app (the catalog update can be skipped)
- **Language**: English by default; switch in Settings (8 locales)

The provider primary key is **slug** (starts with a lowercase letter; lowercase letters, digits, and hyphens only). Agents are matched and written by slug, not by display name or Base URL.

Fetching `/models` only helps fill model IDs. Capabilities are not inferred from that list; they come from models.dev prefills or manual input.

## Supported agents

| Tool | Config directory |
| --- | --- |
| Claude Code | `~/.claude` |
| Codex | `~/.codex` |
| OpenCode | `~/.opencode`, `~/.config/opencode` |
| Grok Build | `~/.grok` |
| Pi Agent | `~/.pi` |
| DeepSeek Harness | `~/.dsh` |
| ZCode | `~/.zcode` |
| oh-my-pi | `~/.omp` |

API formats: OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Google Generative AI. Each tool only receives options it actually supports.

<p align="center">
  <img src="docs/screenshots/agent-tools.png" alt="Agent tools with local configs detected" width="900">
</p>

<p align="center"><sub>Agent tools lists every supported app. <b>Config found</b> means the local directory exists and HyperSwitch can write through a plugin. Use <b>Detect again</b> after installing a new tool.</sub></p>

## Workflow

1. **Providers**: fill in the endpoint and models
2. **Prompt / header presets** (optional): save reusable content
3. **Agent tools**: pick providers and models, write them into the target app

You can refresh models.dev later from Settings or Home.

## Screenshots

### Map models on an agent

Each agent exposes its own roles (Claude Code example: Sonnet / Opus / Fable / Haiku / Subagent). Menu labels only change what the tool shows in `/model`. The request model id is what actually gets sent. **1M** is a Claude Code context-window claim, not something HyperSwitch infers from `/models`.

<p align="center">
  <img src="docs/screenshots/agent-model-mapping.png" alt="Claude Code model mapping" width="900">
</p>

<p align="center"><sub>Fill from the model catalog or type ids by hand. Custom headers and system prompt are optional; only options the target tool supports are written.</sub></p>

### Prompt presets

Save reusable system prompts here, then on the Agent page choose whether to apply one. Presets prefill; they do not lock the field.

<p align="center">
  <img src="docs/screenshots/prompt-presets.png" alt="Prompt presets editor" width="900">
</p>

### Header presets

Save reusable HTTP header sets (for example a `User-Agent`). On the Agent page, **Fill from preset** copies them in so you can still edit before save.

<p align="center">
  <img src="docs/screenshots/header-presets.png" alt="Header presets editor" width="900">
</p>

## Data directory

Files live under `.hyperswitch/` in your home directory:

| File | Contents |
| --- | --- |
| `providers.json` | Providers and models |
| `agent-bindings.json` | Agent bindings |
| `prompt-presets.json` | Prompt presets |
| `header-presets.json` | Header presets |
| `models-dev.json` | Cached models.dev catalog |
| `prefs.json` | App preferences (language) |
| `onboarded` | First-run guide completed |

Settings can open this folder. API keys are stored in local config in plaintext—treat the data directory as sensitive.

A legacy combined `config.json` is split into these files on startup.

## Development

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

| Command | Description |
| --- | --- |
| `npm run dev` | Electron + Vue with hot reload |
| `npm run typecheck` | Typecheck main and renderer |
| `npm run build` | Production build (no installer) |
| `npm run build:win` | Windows NSIS installer |
| `npm run build:mac` | macOS DMG / ZIP (must run on macOS) |
| `npm run build:linux` | Linux AppImage / deb |

Installers land in `dist/`. Each platform should be packaged on that OS: Windows → `build:win`, macOS → `build:mac`, Linux → `build:linux`. macOS packages cannot be built on Windows.

Push a tag starting with `Release` (for example `Release-0.1.0`) to have GitHub Actions build Windows, macOS, and Linux installers (x64 and arm64) and publish a GitHub Release. macOS packages are unsigned.

```bash
git tag Release-0.1.0
git push origin Release-0.1.0
```

The workflow file must be on the tagged commit. Re-running the same tag overwrites that Release.

Restart Electron after main-process IPC changes; renderer hot reload is not enough.

## Layout

```
src/
  main/        Electron main (persistence, catalog, agent plugins)
  preload/     Preload and IPC bridge
  renderer/    Vue 3 UI
  shared/      Provider, preset, and agent types
```

To add an agent: register it in `src/shared/agentPlugin.ts`, implement `src/main/agentPlugins/<id>.ts`, and register the renderer editor.
