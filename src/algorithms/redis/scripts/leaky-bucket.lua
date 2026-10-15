-- leaky-bucket.lua
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
