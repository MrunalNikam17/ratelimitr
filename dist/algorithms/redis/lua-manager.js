"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LuaScriptManager = exports.LUA_SCRIPTS = void 0;
const node_crypto_1 = require("node:crypto");
const errors_js_1 = require("../../core/errors.js");
// Embedded Lua scripts for robust packaging and zero filesystem dependency at runtime
exports.LUA_SCRIPTS = {
    fixed_window: `
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3]) or 1
local nowMs = tonumber(ARGV[4])
local windowMs = windowSec * 1000

local windowOffset = nowMs % windowMs
local resetMs = windowMs - windowOffset
if resetMs <= 0 then
  resetMs = windowMs
end

local current = redis.call('GET', KEYS[1])

if not current then
  if cost <= limit then
    redis.call('SET', KEYS[1], cost, 'PX', resetMs)
    return {1, limit - cost, resetMs}
  else
    return {0, limit, resetMs}
  end
else
  local count = tonumber(current)
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl <= 0 then
    ttl = resetMs
  end

  if count + cost <= limit then
    redis.call('INCRBY', KEYS[1], cost)
    return {1, limit - (count + cost), ttl}
  else
    return {0, math.max(0, limit - count), ttl}
  end
end
`,
    sliding_window_log: `
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3]) or 1
local nowMs = tonumber(ARGV[4])
local windowMs = windowSec * 1000

local clearBefore = nowMs - windowMs
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', clearBefore)

local currentCount = redis.call('ZCARD', KEYS[1])

if currentCount + cost <= limit then
  for i = 1, cost do
    local seq = redis.call('INCR', KEYS[1] .. ':seq')
    local member = tostring(nowMs) .. ':' .. tostring(i) .. ':' .. tostring(seq)
    redis.call('ZADD', KEYS[1], nowMs, member)
  end
  redis.call('PEXPIRE', KEYS[1], windowMs)
  redis.call('PEXPIRE', KEYS[1] .. ':seq', windowMs)

  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local resetMs = windowMs
  if #oldest > 0 then
    local oldestTime = tonumber(oldest[2])
    resetMs = math.max(0, oldestTime + windowMs - nowMs)
  end

  return {1, limit - (currentCount + cost), resetMs}
else
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local resetMs = windowMs
  if #oldest > 0 then
    local oldestTime = tonumber(oldest[2])
    resetMs = math.max(0, oldestTime + windowMs - nowMs)
  end

  return {0, math.max(0, limit - currentCount), resetMs}
end
`,
    sliding_window_counter: `
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3]) or 1
local nowMs = tonumber(ARGV[4])
local windowMs = windowSec * 1000

local currentWindow = math.floor(nowMs / windowMs)
local windowOffset = nowMs % windowMs
local prevWeight = math.max(0, math.min(1, 1 - (windowOffset / windowMs)))
local resetMs = math.max(0, windowMs - windowOffset)

local data = redis.call('HMGET', KEYS[1], 'window', 'current', 'prev')
local storedWindow = tonumber(data[1])
local currentCount = tonumber(data[2]) or 0
local prevCount = tonumber(data[3]) or 0

if not storedWindow or storedWindow ~= currentWindow then
  if storedWindow and (currentWindow - storedWindow) == 1 then
    prevCount = currentCount
  else
    prevCount = 0
  end
  currentCount = 0
  storedWindow = currentWindow
end

local estimated = (prevCount * prevWeight) + currentCount

if estimated + cost <= limit then
  currentCount = currentCount + cost
  redis.call('HMSET', KEYS[1], 'window', storedWindow, 'current', currentCount, 'prev', prevCount)
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
  local remaining = math.max(0, math.floor(limit - (estimated + cost)))
  return {1, remaining, resetMs}
else
  redis.call('HMSET', KEYS[1], 'window', storedWindow, 'current', currentCount, 'prev', prevCount)
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
  local remaining = math.max(0, math.floor(limit - estimated))
  return {0, remaining, resetMs}
end
`,
    token_bucket: `
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3]) or 1
local nowMs = tonumber(ARGV[4])
local burst = tonumber(ARGV[5])

local capacity = burst
if not capacity or capacity <= 0 then
  capacity = limit
end

local windowMs = windowSec * 1000
local refillRate = limit / windowMs

local data = redis.call('HMGET', KEYS[1], 'tokens', 'last_refill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if not tokens then
  tokens = capacity
  lastRefill = nowMs
else
  local elapsed = math.max(0, nowMs - lastRefill)
  tokens = math.min(capacity, tokens + (elapsed * refillRate))
  lastRefill = nowMs
end

if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', KEYS[1], 'tokens', tostring(tokens), 'last_refill', tostring(lastRefill))
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
  local timeToFull = math.ceil((capacity - tokens) / refillRate)
  return {1, math.floor(tokens), timeToFull}
else
  redis.call('HMSET', KEYS[1], 'tokens', tostring(tokens), 'last_refill', tostring(lastRefill))
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
  local deficit = cost - tokens
  local timeUntilAvailable = math.ceil(deficit / refillRate)
  return {0, math.max(0, math.floor(tokens)), timeUntilAvailable}
end
`,
    leaky_bucket: `
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3]) or 1
local nowMs = tonumber(ARGV[4])
local burst = tonumber(ARGV[5])

local capacity = burst
if not capacity or capacity <= 0 then
  capacity = limit
end

local windowMs = windowSec * 1000
local leakRate = limit / windowMs

local data = redis.call('HMGET', KEYS[1], 'water', 'last_leak')
local water = tonumber(data[1])
local lastLeak = tonumber(data[2])

if not water then
  water = 0
  lastLeak = nowMs
else
  local elapsed = math.max(0, nowMs - lastLeak)
  water = math.max(0, water - (elapsed * leakRate))
  lastLeak = nowMs
end

if water + cost <= capacity then
  water = water + cost
  redis.call('HMSET', KEYS[1], 'water', tostring(water), 'last_leak', tostring(lastLeak))
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
  local timeToDrain = math.ceil(water / leakRate)
  return {1, math.max(0, math.floor(capacity - water)), timeToDrain}
else
  redis.call('HMSET', KEYS[1], 'water', tostring(water), 'last_leak', tostring(lastLeak))
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
  local deficit = (water + cost) - capacity
  local timeUntilSlot = math.ceil(deficit / leakRate)
  return {0, math.max(0, math.floor(capacity - water)), timeUntilSlot}
end
`,
};
class LuaScriptManager {
    shaMap = new Map();
    constructor() {
        for (const [alg, script] of Object.entries(exports.LUA_SCRIPTS)) {
            const sha = (0, node_crypto_1.createHash)('sha1').update(script.trim()).digest('hex');
            this.shaMap.set(alg, sha);
        }
    }
    getSha(algorithm) {
        const sha = this.shaMap.get(algorithm);
        if (!sha) {
            throw new errors_js_1.UnsupportedAlgorithmError(algorithm);
        }
        return sha;
    }
    getScript(algorithm) {
        const script = exports.LUA_SCRIPTS[algorithm];
        if (!script) {
            throw new errors_js_1.UnsupportedAlgorithmError(algorithm);
        }
        return script.trim();
    }
    /**
     * Pre-load all 5 Lua scripts into Redis SCRIPT cache.
     */
    async loadScripts(redis) {
        for (const [alg, script] of Object.entries(exports.LUA_SCRIPTS)) {
            const loadedSha = (await redis.script('LOAD', script.trim()));
            this.shaMap.set(alg, loadedSha);
        }
    }
    /**
     * Execute algorithm script with EVALSHA, falling back to SCRIPT LOAD + EVALSHA if NOSCRIPT is returned.
     */
    async execute(redis, algorithm, keys, args) {
        const sha = this.getSha(algorithm);
        try {
            const res = (await redis.evalsha(sha, keys.length, ...keys, ...args.map(String)));
            return res;
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes('NOSCRIPT')) {
                const script = this.getScript(algorithm);
                const reloadedSha = (await redis.script('LOAD', script));
                this.shaMap.set(algorithm, reloadedSha);
                const retryRes = (await redis.evalsha(reloadedSha, keys.length, ...keys, ...args.map(String)));
                return retryRes;
            }
            throw err;
        }
    }
}
exports.LuaScriptManager = LuaScriptManager;
//# sourceMappingURL=lua-manager.js.map