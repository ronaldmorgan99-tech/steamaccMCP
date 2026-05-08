import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import axios from 'axios';
import cors from 'cors';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const requestBaseUrl = host ? `${proto}://${host}` : APP_URL;
    const issuer = process.env.APP_URL || requestBaseUrl;

    res.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      scopes_supported: ['read'],
      code_challenge_methods_supported: ['S256', 'plain']
    });
  });
  app.get('/.well-known/openid-configuration', (req, res) => {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const requestBaseUrl = host ? `${proto}://${host}` : APP_URL;
    const issuer = process.env.APP_URL || requestBaseUrl;

    res.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      response_types_supported: ['code', 'token'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      scopes_supported: ['read'],
      code_challenge_methods_supported: ['S256', 'plain']
    });
  });


  // --- OAuth Logic (Mocked to bypass Grok/Claude requirements) ---
  app.get('/oauth/authorize', (req, res) => {
    const { redirect_uri, state, response_type, client_id, scope } = req.query;
    if (!redirect_uri) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing redirect_uri' });
    if (response_type && response_type !== 'code' && response_type !== 'token') {
      return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only response_type=code or token is supported' });
    }
    
    try {
      const url = new URL(redirect_uri as string);
      if (response_type === 'token') {
        url.hash = new URLSearchParams({
          access_token: `mock_access_${crypto.randomUUID().replace(/-/g, '')}`,
          token_type: 'Bearer',
          expires_in: '31536000',
          scope: typeof scope === 'string' ? scope : 'read',
          ...(state ? { state: String(state) } : {})
        }).toString();
        return res.redirect(url.toString());
      }

      const authCode = `mock_${crypto.randomUUID().replace(/-/g, '')}`;
      authCodes.set(authCode, {
        redirectUri: redirect_uri as string,
        clientId: typeof client_id === 'string' ? client_id : undefined,
        scope: typeof scope === 'string' ? scope : 'read',
        expiresAt: Date.now() + 5 * 60 * 1000
      });
      url.searchParams.append('code', authCode);
      if (state) {
        url.searchParams.append('state', state as string);
      }
      res.redirect(url.toString());
    } catch (e) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid redirect_uri format' });
    }
  });

  app.all('/oauth/token', (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'invalid_request', error_description: 'Use POST for token exchange' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    const authHeader = req.headers.authorization;
    if (authHeader?.toLowerCase().startsWith('basic ')) {
      // Decode without validating because this is a mocked OAuth bridge for MCP clients.
      try {
        Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      } catch (_e) {
        return res.status(400).json({ error: 'invalid_client', error_description: 'Malformed Authorization header' });
      }
    }

    const grantType = req.body?.grant_type;
    const code = req.body?.code;
    const redirectUri = req.body?.redirect_uri;
    const clientId = req.body?.client_id;
    if (grantType && grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Supported grant types are authorization_code and refresh_token'
      });
    }
    if (!grantType) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing grant_type' });
    }
    if (grantType === 'authorization_code' && !code) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing authorization code' });
    }
    if (grantType === 'authorization_code') {
      const storedCode = authCodes.get(code);
      if (!storedCode || storedCode.expiresAt < Date.now()) {
        authCodes.delete(code);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
      }
      if (redirectUri && redirectUri !== storedCode.redirectUri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri does not match authorization request' });
      }
      if (clientId && storedCode.clientId && clientId !== storedCode.clientId) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id does not match authorization request' });
      }
      authCodes.delete(code);
    }

    res.json({
      access_token: `mock_access_${crypto.randomUUID().replace(/-/g, '')}`,
      token_type: 'Bearer',
      expires_in: 31536000,
      refresh_token: `mock_refresh_${crypto.randomUUID().replace(/-/g, '')}`,
      scope: 'read'
    });
  });

  // --- Steam Logic (Public Profile Mode) ---
  class SteamClient {
    private steamId: string;
    private PUBLIC_BASE_URL = "https://steamcommunity.com/profiles";

    constructor(steamId: string) {
      this.steamId = steamId;
    }

    async getPlayerSummary() {
      const url = `${this.PUBLIC_BASE_URL}/${this.steamId}/?xml=1`;
      try {
        const response = await axios.get(url);
        const xml = response.data;
        const steamID = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || xml.match(/<steamID>(.*?)<\/steamID>/)?.[1];
        const onlineState = xml.match(/<onlineState>(.*?)<\/onlineState>/)?.[1];
        const avatarFull = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || xml.match(/<avatarFull>(.*?)<\/avatarFull>/)?.[1];
        const privacyState = xml.match(/<privacyState>(.*?)<\/privacyState>/)?.[1];
        
        return {
          personaname: steamID,
          personastate: onlineState,
          avatar: avatarFull,
          is_private: privacyState !== 'public'
        };
      } catch (e) {
        return null;
      }
    }

    async getOwnedGames() {
      const url = `${this.PUBLIC_BASE_URL}/${this.steamId}/games/?tab=all&xml=1`;
      try {
        const response = await axios.get(url);
        const xml = response.data;
        const games: any[] = [];
        const gameMatches = xml.matchAll(/<game>([\s\S]*?)<\/game>/g);
        
        for (const match of gameMatches) {
          const content = match[1];
          const appid = content.match(/<appID>(.*?)<\/appID>/)?.[1];
          const name = content.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/)?.[1] || content.match(/<name>(.*?)<\/name>/)?.[1];
          const hoursOnRecord = content.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/)?.[1];
          const hoursLast2Weeks = content.match(/<hoursLast2Weeks>(.*?)<\/hoursLast2Weeks>/)?.[1];
          
          if (appid && name) {
            games.push({
              appid: parseInt(appid),
              name,
              playtime_forever: parseFloat((hoursOnRecord || '0').replace(',', '')) * 60,
              playtime_2weeks: parseFloat((hoursLast2Weeks || '0').replace(',', '')) * 60
            });
          }
        }
        return games;
      } catch (e) {
        return [];
      }
    }
  }

  // --- MCP Server Setup ---
  const mcpServer = new McpServer({
    name: "Steam MCP Server",
    version: "1.0.0",
  });

  mcpServer.tool("get_player_summary", { steam_id: z.string().optional() }, async ({ steam_id }) => {
    const id = steam_id || process.env.STEAM_USER_ID;
    if (!id) return { content: [{ type: "text", text: "No Steam ID provided." }] };
    const client = new SteamClient(id);
    const summary = await client.getPlayerSummary();
    if (!summary) return { content: [{ type: "text", text: "Profile not found." }] };
    return {
      content: [{ type: "text", text: `Player: ${summary.personaname}\nStatus: ${summary.personastate}\nPrivate: ${summary.is_private}` }]
    };
  });

  mcpServer.tool("get_library", { steam_id: z.string().optional() }, async ({ steam_id }) => {
    const id = steam_id || process.env.STEAM_USER_ID;
    if (!id) return { content: [{ type: "text", text: "No Steam ID provided." }] };
    const client = new SteamClient(id);
    const games = await client.getOwnedGames();
    if (games.length === 0) return { content: [{ type: "text", text: "No games found or profile is private." }] };
    const list = games.slice(0, 20).map(g => `- ${g.name} (${Math.round(g.playtime_forever / 60)}h)`).join('\n');
    return {
      content: [{ type: "text", text: `Top Games:\n${list}${games.length > 20 ? '\n... and ' + (games.length - 20) + ' more' : ''}` }]
    };
  });

  let transport: SSEServerTransport | null = null;
  app.get("/mcp/sse", async (req, res) => {
    transport = new SSEServerTransport("/mcp/messages", res);
    await mcpServer.connect(transport);
  });

  app.post("/mcp/messages", async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No active transport");
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
  const authCodes = new Map<string, { redirectUri: string; clientId?: string; scope?: string; expiresAt: number }>();
