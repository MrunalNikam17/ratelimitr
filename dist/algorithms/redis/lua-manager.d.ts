import type { Redis } from 'ioredis';
import { AlgorithmType } from '../../core/types.js';
export declare const LUA_SCRIPTS: Record<AlgorithmType, string>;
export declare class LuaScriptManager {
    private readonly shaMap;
    constructor();
    getSha(algorithm: AlgorithmType): string;
    getScript(algorithm: AlgorithmType): string;
    /**
     * Pre-load all 5 Lua scripts into Redis SCRIPT cache.
     */
    loadScripts(redis: Redis): Promise<void>;
    /**
     * Execute algorithm script with EVALSHA, falling back to SCRIPT LOAD + EVALSHA if NOSCRIPT is returned.
     */
    execute(redis: Redis, algorithm: AlgorithmType, keys: string[], args: (string | number)[]): Promise<[number, number, number]>;
}
//# sourceMappingURL=lua-manager.d.ts.map