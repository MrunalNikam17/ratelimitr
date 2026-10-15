import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { LuaScriptManager } from '../../../src/algorithms/redis/lua-manager.js';
import { AlgorithmType } from '../../../src/core/types.js';
import { UnsupportedAlgorithmError } from '../../../src/core/errors.js';

describe('LuaScriptManager', () => {
  const algorithms: AlgorithmType[] = [
    'fixed_window',
    'sliding_window_log',
    'sliding_window_counter',
    'token_bucket',
    'leaky_bucket',
  ];

  it('should compute valid 40-character SHA1 hashes for all algorithms', () => {
    const manager = new LuaScriptManager();
    for (const alg of algorithms) {
      const sha = manager.getSha(alg);
      expect(sha).toBeDefined();
      expect(sha).toHaveLength(40);
      expect(manager.getScript(alg)).toBeTruthy();
    }
  });

  it('should throw for unsupported algorithm', () => {
    const manager = new LuaScriptManager();
    expect(() => manager.getSha('unknown_algorithm' as AlgorithmType)).toThrow(
      UnsupportedAlgorithmError,
    );
    expect(() => manager.getScript('unknown_algorithm' as AlgorithmType)).toThrow(
      UnsupportedAlgorithmError,
    );
  });

  it('should preload all scripts with SCRIPT LOAD', async () => {
    const manager = new LuaScriptManager();
    const mockRedis = {
      script: vi.fn().mockResolvedValue('dummy_sha_string'),
    } as unknown as Redis;

    await manager.loadScripts(mockRedis);
    expect(mockRedis.script).toHaveBeenCalledTimes(5);
    expect(mockRedis.script).toHaveBeenCalledWith('LOAD', expect.any(String));
  });

  it('should execute EVALSHA and handle NOSCRIPT recovery', async () => {
    const manager = new LuaScriptManager();
    const mockRedis = {
      evalsha: vi
        .fn()
        .mockRejectedValueOnce(new Error('NOSCRIPT No matching script. Please use EVAL.'))
        .mockResolvedValueOnce([1, 4, 9500]),
      script: vi.fn().mockResolvedValue('reloaded_sha'),
    } as unknown as Redis;

    const res = await manager.execute(
      mockRedis,
      'token_bucket',
      ['ratelimit:token_bucket:user-1'],
      [5, 10, 1, 100000, 5],
    );

    expect(res).toEqual([1, 4, 9500]);
    expect(mockRedis.script).toHaveBeenCalledWith('LOAD', expect.any(String));
    expect(mockRedis.evalsha).toHaveBeenCalledTimes(2);
  });

  it('should rethrow non-NOSCRIPT errors', async () => {
    const manager = new LuaScriptManager();
    const mockRedis = {
      evalsha: vi.fn().mockRejectedValue(new Error('CLUSTERDOWN The cluster is down')),
    } as unknown as Redis;

    await expect(
      manager.execute(mockRedis, 'fixed_window', ['key'], [5, 10, 1, 100000, 5]),
    ).rejects.toThrow('CLUSTERDOWN');
  });
});
