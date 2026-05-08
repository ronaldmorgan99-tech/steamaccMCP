# Steam MCP Server (TypeScript + React)

A Model Context Protocol (MCP) server with a small web status page. It connects to Steam using public profile data and does **not** require a Steam Web API key.

## Why the site may not load

If you followed older instructions (like `python main.py`), the app will not start because this repo now runs on **Node.js/TypeScript** and the entrypoint is `server.ts`.

Use the commands in this README instead.

## Features

- `get_player_summary`: Public profile status and basic profile details.
- `get_library`: Owned games and playtime summary (public data).
- OAuth mock endpoints for tools that require an OAuth flow:
  - `/oauth/authorize`
  - `/oauth/token`
- SSE endpoint for MCP clients:
  - `/mcp/sse`

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

1. Create a `.env` file in the repo root:

```env
STEAM_USER_ID=your_17_digit_steam_id
```

2. Install dependencies:

```bash
npm install
```

3. Run in development:

```bash
npm run dev
```

The app listens on `http://localhost:3000`.

## Production build

```bash
npm run build
npm run preview
```

## Troubleshooting

- **Blank/no site**: Confirm you're opening `http://localhost:3000` (not another Vite default port).
- **Command not found / Python errors**: You're using outdated Python instructions; use npm commands above.
- **No Steam data**: Ensure Steam profile and game details are public, and `STEAM_USER_ID` is set.

## License

MIT
