-- sliding-window-counter.lua
-- KEYS[1]: rate limit key (HASH)
-- ARGV[1]: limit (number)
-- ARGV[2]: windowSec (number)
-- ARGV[3]: cost (number)
-- ARGV[4]: nowMs (number)

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
