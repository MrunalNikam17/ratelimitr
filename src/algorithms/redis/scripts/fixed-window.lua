-- fixed-window.lua
-- KEYS[1]: rate limit key
-- ARGV[1]: limit (number)
-- ARGV[2]: windowSec (number)
-- ARGV[3]: cost (number)
-- ARGV[4]: nowMs (number)

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
