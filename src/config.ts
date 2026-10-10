import * as dotenv from 'dotenv';

dotenv.config();

export function normalizeSteamId(value?: string): string | null {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  return /^\d{17}$/.test(candidate) ? candidate : null;
}

export function getSteamUserId(override?: string): string {
  const value = normalizeSteamId(override ?? process.env.STEAM_USER_ID);

  if (!value) {
    throw new Error('STEAM_USER_ID must be set to a valid 17-digit Steam64 ID.');
  }

  return value;
}

export function getPort(): number {
  const port = Number(process.env.PORT || 3000);
  if (Number.isFinite(port) && port > 0) {
    return port;
  }

  return 3000;
}

export function getAppUrl(): string {
  const appUrl = process.env.APP_URL || `http://localhost:${getPort()}`;
  return appUrl.replace(/\/$/, '');
}
