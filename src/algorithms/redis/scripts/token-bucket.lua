-- token-bucket.lua
-- KEYS[1]: rate limit key (HASH)
-- ARGV[1]: limit (number)
-- ARGV[2]: windowSec (number)
-- ARGV[3]: cost (number)
-- ARGV[4]: nowMs (number)
-- ARGV[5]: burst (capacity, optional)

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
