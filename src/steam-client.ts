import axios from 'axios';

export interface SteamSummary {
  personaname: string | null;
  personastate: string | null;
  avatar: string | null;
  is_private: boolean;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks: number;
}

export class SteamClient {
  private readonly steamId: string;
  private readonly PUBLIC_BASE_URL = 'https://steamcommunity.com/profiles';

  constructor(steamId: string) {
    const cleanedId = steamId.trim();
    if (!/^\d{17}$/.test(cleanedId)) {
      throw new Error('Steam IDs must be 17-digit Steam64 values.');
    }
    this.steamId = cleanedId;
  }

  async getPlayerSummary(): Promise<SteamSummary | null> {
    const url = `${this.PUBLIC_BASE_URL}/${this.steamId}/?xml=1`;

    try {
      const response = await axios.get(url, { timeout: 10000 });
      const xml = String(response.data ?? '');

      const steamID =
        xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] ||
        xml.match(/<steamID>(.*?)<\/steamID>/)?.[1] ||
        null;
      const onlineState = xml.match(/<onlineState>(.*?)<\/onlineState>/)?.[1] || null;
      const avatarFull =
        xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] ||
        xml.match(/<avatarFull>(.*?)<\/avatarFull>/)?.[1] ||
        null;
      const privacyState = xml.match(/<privacyState>(.*?)<\/privacyState>/)?.[1] || 'private';

      return {
        personaname: steamID,
        personastate: onlineState,
        avatar: avatarFull,
        is_private: privacyState !== 'public'
      };
    } catch (_error) {
      return null;
    }
  }

  async getOwnedGames(): Promise<SteamGame[]> {
    const url = `${this.PUBLIC_BASE_URL}/${this.steamId}/games/?tab=all&xml=1`;

    try {
      const response = await axios.get(url, { timeout: 10000 });
      const xml = String(response.data ?? '');
      const games: SteamGame[] = [];
      const gameMatches = xml.matchAll(/<game>([\s\S]*?)<\/game>/g);

      for (const match of gameMatches) {
        const content = match[1];
        const appid = content.match(/<appID>(.*?)<\/appID>/)?.[1];
        const name =
          content.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/)?.[1] ||
          content.match(/<name>(.*?)<\/name>/)?.[1];
        const hoursOnRecord = content.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/)?.[1];
        const hoursLast2Weeks = content.match(/<hoursLast2Weeks>(.*?)<\/hoursLast2Weeks>/)?.[1];

        if (appid && name) {
          games.push({
            appid: Number.parseInt(appid, 10),
            name,
            playtime_forever: Number.parseFloat((hoursOnRecord || '0').replace(/,/g, '')) * 60,
            playtime_2weeks: Number.parseFloat((hoursLast2Weeks || '0').replace(/,/g, '')) * 60
          });
        }
      }

      return games;
    } catch (_error) {
      return [];
    }
  }
}
