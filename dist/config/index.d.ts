import { AppConfig } from './schema.js';
import { RateLimitRule } from '../core/types.js';
export declare function loadConfig(filePath?: string): AppConfig;
/**
 * Finds the most specific matching rule for a given route and client.
 * Priority:
 * 1. Exact match on both route and clientId
 * 2. Exact match on clientId
 * 3. Exact match on route
 * 4. Default rule
 */
export declare function matchRule(config: AppConfig, params: {
    route?: string;
    clientId?: string;
}): RateLimitRule;
//# sourceMappingURL=index.d.ts.map