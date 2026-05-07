# Steam MCP Server (No-API-Key)

A Model Context Protocol (MCP) server that connects to Steam using public profile data. This version **does not require a Steam Web API Key**, prioritizing privacy and ease of setup.

## Features

- **get_my_steam_library**: List all owned games and playtime (Public data).
- **get_recently_played**: See what you've been playing lately.
- **get_game_details**: Detailed info for any Steam game.
- **get_player_summary**: Public profile status, bio, and avatar.
- **search_my_library**: Find games you own by name.
- **get_playtime_stats**: Overall library statistics (total hours, top games).

## Important: Privacy Settings

For this server to fetch your data, you **MUST** set your Steam profile to public:
1. Go to your Steam Profile -> **Edit Profile**.
2. Go to **Privacy Settings**.
3. Set **My profile** to **Public**.
4. Set **Game details** to **Public**.
5. (Optional) Uncheck "Always keep my total playtime private" if you want playtime stats.

## Setup

### 1. Get your Steam User ID

- **Steam User ID**: You need your **Steam64 ID**. You can find it by putting your profile link into [https://steamid.io](https://steamid.io). It is a 17-digit number starting with `765`.

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
STEAM_USER_ID=your_17_digit_steam_id
```

### 3. Installation

```bash
pip install -r requirements.txt
```

### 4. Running the Server

To run the server with a remote SSE transport (useful for remote connectors):

```bash
python main.py
```

The server will start on `http://localhost:3000`.

### 5. Connecting to Grok/Claude/Cursor

Use the SSE transport URL: `http://localhost:3000/mcp/sse`

#### Example (Claude Desktop Config)

```json
{
  "mcpServers": {
    "steam": {
      "command": "python",
      "args": ["main.py"],
      "env": {
        "STEAM_USER_ID": "your_id"
      }
    }
  }
}
```

## License
MIT
