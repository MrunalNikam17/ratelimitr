import { Request } from 'express';

export type KeyGenerator = (req: Request) => string;

/**
 * Extracts client IP address, respecting X-Forwarded-For if present.
 */
export const ipKeyGenerator: KeyGenerator = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const firstIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])?.trim();
    if (firstIp) return `ip:${firstIp}`;
  }
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
};

/**
 * Extracts API key from X-API-Key header or Authorization: Bearer token.
 * Falls back to IP if not present.
 */
export const apiKeyOrIpGenerator: KeyGenerator = (req: Request): string => {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    return `key:${apiKey}`;
  }

  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return `bearer:${auth.slice(7).trim()}`;
  }

  return ipKeyGenerator(req);
};
