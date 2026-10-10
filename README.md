# Steam MCP Server (TypeScript + React)

A Model Context Protocol (MCP) server with a small web status page. It connects to Steam using public profile data and does not require a Steam Web API key.

## Why the site may not load

If you followed older instructions (like `python main.py`), the app will not start because this repo now runs on Node.js/TypeScript and the entrypoint is `server.ts`.

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
APP_URL=http://localhost:3000
PORT=3000
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

## Grok MCP setup

This project is meant to be connected to Grok as an MCP server over SSE.

### SSE endpoint

```text
http://localhost:3000/mcp/sse
```

When deployed to a public host, use the public HTTPS URL instead:

```text
https://your-domain.example/mcp/sse
```

### Example Grok MCP config

Use a config like this in the Grok MCP client settings or your local MCP launcher:

```json
{
  "mcpServers": {
    "steam": {
      "command": "npx",
      "args": ["tsx", "server.ts"],
      "env": {
        "STEAM_USER_ID": "YOUR_STEAM64_ID",
        "PORT": "3000",
        "APP_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Example prompts to test in Grok

- "What is my Steam profile?"
- "Show me my top 10 games."
- "How many hours have I spent in my library?"
- "Give me my Steam profile summary."

### Required environment values

- `STEAM_USER_ID`: Your 17-digit Steam64 ID
- `APP_URL`: The public base URL for OAuth discovery and self-referential links
- `PORT`: The port the server listens on

## Production build

```bash
npm run build
npm run preview
```

## Troubleshooting

- **Blank/no site**: Confirm you're opening `http://localhost:3000` (not another Vite default port).
- **Command not found / Python errors**: You're using outdated Python instructions; use npm commands above.
- **No Steam data**: Ensure Steam profile and game details are public, and `STEAM_USER_ID` is set.
- **Grok cannot connect**: Confirm the SSE endpoint is reachable and the server is running at the same URL your client is configured to use.
- **OAuth discovery fails**: Set `APP_URL` correctly for the deployment environment.

## License

MIT
