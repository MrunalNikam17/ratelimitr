import { z } from 'zod';
export declare const AlgorithmTypeSchema: z.ZodEnum<["fixed_window", "sliding_window_log", "sliding_window_counter", "token_bucket", "leaky_bucket"]>;
export declare const RateLimitRuleSchema: z.ZodObject<{
    algorithm: z.ZodEnum<["fixed_window", "sliding_window_log", "sliding_window_counter", "token_bucket", "leaky_bucket"]>;
    limit: z.ZodNumber;
    windowSec: z.ZodNumber;
    burst: z.ZodOptional<z.ZodNumber>;
    route: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
    windowSec: number;
    burst?: number | undefined;
    route?: string | undefined;
    clientId?: string | undefined;
}, {
    limit: number;
    algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
    windowSec: number;
    burst?: number | undefined;
    route?: string | undefined;
    clientId?: string | undefined;
}>;
export declare const ServerConfigSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    host: z.ZodDefault<z.ZodString>;
    logLevel: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
}, "strip", z.ZodTypeAny, {
    port: number;
    host: string;
    logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}, {
    port?: number | undefined;
    host?: string | undefined;
    logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
}>;
export declare const RedisConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    host: z.ZodDefault<z.ZodString>;
    port: z.ZodDefault<z.ZodNumber>;
    password: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    keyPrefix: z.ZodDefault<z.ZodString>;
    connectTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    port: number;
    host: string;
    enabled: boolean;
    keyPrefix: string;
    connectTimeoutMs: number;
    password?: string | undefined;
    url?: string | undefined;
}, {
    port?: number | undefined;
    host?: string | undefined;
    enabled?: boolean | undefined;
    password?: string | undefined;
    url?: string | undefined;
    keyPrefix?: string | undefined;
    connectTimeoutMs?: number | undefined;
}>;
export declare const AppConfigSchema: z.ZodObject<{
    server: z.ZodDefault<z.ZodObject<{
        port: z.ZodDefault<z.ZodNumber>;
        host: z.ZodDefault<z.ZodString>;
        logLevel: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        host: string;
        logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    }, {
        port?: number | undefined;
        host?: string | undefined;
        logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
    }>>;
    redis: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        host: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        password: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        keyPrefix: z.ZodDefault<z.ZodString>;
        connectTimeoutMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        host: string;
        enabled: boolean;
        keyPrefix: string;
        connectTimeoutMs: number;
        password?: string | undefined;
        url?: string | undefined;
    }, {
        port?: number | undefined;
        host?: string | undefined;
        enabled?: boolean | undefined;
        password?: string | undefined;
        url?: string | undefined;
        keyPrefix?: string | undefined;
        connectTimeoutMs?: number | undefined;
    }>>;
    failMode: z.ZodDefault<z.ZodEnum<["fail_open", "fail_closed"]>>;
    defaultRule: z.ZodDefault<z.ZodObject<{
        algorithm: z.ZodEnum<["fixed_window", "sliding_window_log", "sliding_window_counter", "token_bucket", "leaky_bucket"]>;
        limit: z.ZodNumber;
        windowSec: z.ZodNumber;
        burst: z.ZodOptional<z.ZodNumber>;
        route: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    }, {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    }>>;
    rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        algorithm: z.ZodEnum<["fixed_window", "sliding_window_log", "sliding_window_counter", "token_bucket", "leaky_bucket"]>;
        limit: z.ZodNumber;
        windowSec: z.ZodNumber;
        burst: z.ZodOptional<z.ZodNumber>;
        route: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    }, {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    server: {
        port: number;
        host: string;
        logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    };
    redis: {
        port: number;
        host: string;
        enabled: boolean;
        keyPrefix: string;
        connectTimeoutMs: number;
        password?: string | undefined;
        url?: string | undefined;
    };
    failMode: "fail_open" | "fail_closed";
    defaultRule: {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    };
    rules: {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    }[];
}, {
    server?: {
        port?: number | undefined;
        host?: string | undefined;
        logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
    } | undefined;
    redis?: {
        port?: number | undefined;
        host?: string | undefined;
        enabled?: boolean | undefined;
        password?: string | undefined;
        url?: string | undefined;
        keyPrefix?: string | undefined;
        connectTimeoutMs?: number | undefined;
    } | undefined;
    failMode?: "fail_open" | "fail_closed" | undefined;
    defaultRule?: {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    } | undefined;
    rules?: {
        limit: number;
        algorithm: "fixed_window" | "sliding_window_log" | "sliding_window_counter" | "token_bucket" | "leaky_bucket";
        windowSec: number;
        burst?: number | undefined;
        route?: string | undefined;
        clientId?: string | undefined;
    }[] | undefined;
}>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
//# sourceMappingURL=schema.d.ts.map