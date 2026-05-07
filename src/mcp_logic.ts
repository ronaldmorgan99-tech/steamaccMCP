import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'steam-mcp-secret-123';

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
        
        if (appid && name) {
          games.push({
            appid: parseInt(appid),
            name,
            playtime_forever: parseFloat((hoursOnRecord || '0').replace(',', '')) * 60
          });
        }
      }
      return games;
    } catch (e) {
      return [];
    }
  }
}

export const mcpServer = new McpServer({
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
    content: [{ type: "text", text: `Player: ${summary.personaname}\nStatus: ${summary.personastate}` }]
  };
});

mcpServer.tool("get_library", { steam_id: z.string().optional() }, async ({ steam_id }) => {
  const id = steam_id || process.env.STEAM_USER_ID;
  if (!id) return { content: [{ type: "text", text: "No Steam ID provided." }] };
  const client = new SteamClient(id);
  const games = await client.getOwnedGames();
  const list = games.slice(0, 5).map(g => `- ${g.name}`).join('\n');
  return {
    content: [{ type: "text", text: `Games:\n${list}` }]
  };
});

// Helper for SSE
export async function handleMcpSse(req: any, res: any) {
  const transport = new SSEServerTransport("/mcp/messages", res);
  await mcpServer.connect(transport);
}

export async function handleMcpMessage(req: any, res: any, transport: SSEServerTransport | null) {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active transport");
  }
}
