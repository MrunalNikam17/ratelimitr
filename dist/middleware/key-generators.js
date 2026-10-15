"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyOrIpGenerator = exports.ipKeyGenerator = void 0;
/**
 * Extracts client IP address, respecting X-Forwarded-For if present.
 */
const ipKeyGenerator = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const firstIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])?.trim();
        if (firstIp)
            return `ip:${firstIp}`;
    }
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
};
exports.ipKeyGenerator = ipKeyGenerator;
/**
 * Extracts API key from X-API-Key header or Authorization: Bearer token.
 * Falls back to IP if not present.
 */
const apiKeyOrIpGenerator = (req) => {
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey.length > 0) {
        return `key:${apiKey}`;
    }
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
        return `bearer:${auth.slice(7).trim()}`;
    }
    return (0, exports.ipKeyGenerator)(req);
};
exports.apiKeyOrIpGenerator = apiKeyOrIpGenerator;
//# sourceMappingURL=key-generators.js.map