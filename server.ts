import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import cors from 'cors';
import crypto from 'crypto';
import { getAppUrl, getPort, getSteamUserId, normalizeSteamId } from './src/config';
import { SteamClient } from './src/steam-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authCodes = new Map<string, { redirectUri: string; clientId?: string; scope?: string; expiresAt: number }>();

function resolveSteamId(steamIdOverride?: string): string | null {
  const candidate = steamIdOverride?.trim() || process.env.STEAM_USER_ID?.trim();
  if (!candidate) {
    return null;
  }

  const normalized = normalizeSteamId(candidate);
  if (normalized) {
    return normalized;
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = getPort();
  const APP_URL = getAppUrl();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true, appUrl: APP_URL, port: PORT });
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

  app.get('/oauth/authorize', (req, res) => {
    const { redirect_uri, state, response_type, client_id, scope } = req.query;
    if (!redirect_uri) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing redirect_uri' });
    }
    if (response_type && response_type !== 'code' && response_type !== 'token') {
      return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only response_type=code or token is supported' });
    }

    try {
      const url = new URL(String(redirect_uri));
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
        redirectUri: String(redirect_uri),
        clientId: typeof client_id === 'string' ? client_id : undefined,
        scope: typeof scope === 'string' ? scope : 'read',
        expiresAt: Date.now() + 5 * 60 * 1000
      });
      url.searchParams.append('code', authCode);
      if (state) {
        url.searchParams.append('state', String(state));
      }
      return res.redirect(url.toString());
    } catch (_error) {
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
      try {
        Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      } catch (_error) {
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

    return res.json({
      access_token: `mock_access_${crypto.randomUUID().replace(/-/g, '')}`,
      token_type: 'Bearer',
      expires_in: 31536000,
      refresh_token: `mock_refresh_${crypto.randomUUID().replace(/-/g, '')}`,
      scope: 'read'
    });
  });

  const mcpServer = new McpServer({
    name: 'Steam MCP Server',
    version: '1.0.0'
  });

  mcpServer.tool('get_player_summary', { steam_id: z.string().optional() }, async ({ steam_id }) => {
    const steamId = resolveSteamId(steam_id) ?? (() => {
      try {
        return getSteamUserId();
      } catch (_error) {
        return null;
      }
    })();

    if (!steamId) {
      return { content: [{ type: 'text', text: 'No valid Steam ID provided. Set STEAM_USER_ID to a valid 17-digit Steam64 ID.' }] };
    }

    const client = new SteamClient(steamId);
    const summary = await client.getPlayerSummary();
    if (!summary) {
      return { content: [{ type: 'text', text: 'Profile not found or the Steam profile is unavailable.' }] };
    }

    return {
      content: [{
        type: 'text',
        text: `Player: ${summary.personaname ?? 'unknown'}\nStatus: ${summary.personastate ?? 'unknown'}\nPrivate: ${summary.is_private}`
      }]
    };
  });

  mcpServer.tool('get_library', { steam_id: z.string().optional() }, async ({ steam_id }) => {
    const steamId = resolveSteamId(steam_id) ?? (() => {
      try {
        return getSteamUserId();
      } catch (_error) {
        return null;
      }
    })();

    if (!steamId) {
      return { content: [{ type: 'text', text: 'No valid Steam ID provided. Set STEAM_USER_ID to a valid 17-digit Steam64 ID.' }] };
    }

    const client = new SteamClient(steamId);
    const games = await client.getOwnedGames();
    if (games.length === 0) {
      return { content: [{ type: 'text', text: 'No games found or the profile is private.' }] };
    }

    const list = games.slice(0, 20).map((game) => `- ${game.name} (${Math.round(game.playtime_forever / 60)}h)`).join('\n');
    return {
      content: [{
        type: 'text',
        text: `Top Games:\n${list}${games.length > 20 ? `\n... and ${games.length - 20} more` : ''}`
      }]
    };
  });

  let transport: SSEServerTransport | null = null;

  app.get('/mcp/sse', async (_req, res) => {
    transport = new SSEServerTransport('/mcp/messages', res);
    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('No active transport');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Steam MCP server:', error);
  process.exit(1);
});
