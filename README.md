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

## Workflow

1. **Providers**: fill in the endpoint and models
2. **Prompt / header presets** (optional): save reusable content
3. **Agent tools**: pick providers and models, write them into the target app

You can refresh models.dev later from Settings or Home.

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
| `npm run build` | Production build |
| `npm run build:win` | Windows installer |

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
