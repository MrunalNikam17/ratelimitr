import { Request } from 'express';
export type KeyGenerator = (req: Request) => string;
/**
 * Extracts client IP address, respecting X-Forwarded-For if present.
 */
export declare const ipKeyGenerator: KeyGenerator;
/**
 * Extracts API key from X-API-Key header or Authorization: Bearer token.
 * Falls back to IP if not present.
 */
export declare const apiKeyOrIpGenerator: KeyGenerator;
//# sourceMappingURL=key-generators.d.ts.map