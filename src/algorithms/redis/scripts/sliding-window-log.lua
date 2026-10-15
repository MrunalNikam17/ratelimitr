-- sliding-window-log.lua
-- KEYS[1]: rate limit key (ZSET)
-- ARGV[1]: limit (number)
-- ARGV[2]: windowSec (number)
-- ARGV[3]: cost (number)
-- ARGV[4]: nowMs (number)

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
    local member = tostring(nowMs) .. ':' .. tostring(i) .. ':' .. tostring(redis.call('INCR', KEYS[1] .. ':seq'))
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
