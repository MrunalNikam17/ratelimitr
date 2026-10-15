"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.matchRule = matchRule;
const node_fs_1 = __importDefault(require("node:fs"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const schema_js_1 = require("./schema.js");
const errors_js_1 = require("../core/errors.js");
function loadConfig(filePath) {
    let raw = {};
    const targetPath = filePath || process.env['CONFIG_PATH'];
    if (targetPath && node_fs_1.default.existsSync(targetPath)) {
        try {
            const fileContent = node_fs_1.default.readFileSync(targetPath, 'utf8');
            if (targetPath.endsWith('.json')) {
                raw = JSON.parse(fileContent);
            }
            else {
                raw = js_yaml_1.default.load(fileContent) || {};
            }
        }
        catch (err) {
            throw new errors_js_1.ConfigurationError(`Failed to parse configuration file at ${targetPath}: ${String(err)}`);
        }
    }
    // Allow environment variables to override values
    if (process.env['PORT']) {
        raw['server'] = { ...raw['server'], port: Number(process.env['PORT']) };
    }
    if (process.env['LOG_LEVEL']) {
        raw['server'] = { ...raw['server'], logLevel: process.env['LOG_LEVEL'] };
    }
    if (process.env['REDIS_URL']) {
        raw['redis'] = { ...raw['redis'], url: process.env['REDIS_URL'], enabled: true };
    }
    else if (process.env['REDIS_HOST']) {
        raw['redis'] = {
            ...raw['redis'],
            host: process.env['REDIS_HOST'],
            port: Number(process.env['REDIS_PORT'] || 6379),
            enabled: true,
        };
    }
    if (process.env['FAIL_MODE']) {
        raw['failMode'] = process.env['FAIL_MODE'];
    }
    const result = schema_js_1.AppConfigSchema.safeParse(raw);
    if (!result.success) {
        throw new errors_js_1.ConfigurationError(`Invalid configuration: ${result.error.message}`);
    }
    return result.data;
}
/**
 * Finds the most specific matching rule for a given route and client.
 * Priority:
 * 1. Exact match on both route and clientId
 * 2. Exact match on clientId
 * 3. Exact match on route
 * 4. Default rule
 */
function matchRule(config, params) {
    const { route, clientId } = params;
    if (route && clientId) {
        const both = config.rules.find((r) => r.route === route && r.clientId === clientId);
        if (both)
            return both;
    }
    if (clientId) {
        const clientRule = config.rules.find((r) => r.clientId === clientId && !r.route);
        if (clientRule)
            return clientRule;
    }
    if (route) {
        const routeRule = config.rules.find((r) => r.route === route && !r.clientId);
        if (routeRule)
            return routeRule;
    }
    return config.defaultRule;
}
//# sourceMappingURL=index.js.map