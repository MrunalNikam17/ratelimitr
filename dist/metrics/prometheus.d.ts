import { Registry, Counter, Histogram } from 'prom-client';
export declare class MetricsCollector {
    readonly registry: Registry;
    readonly requestsTotal: Counter<string>;
    readonly checkDuration: Histogram<string>;
    readonly storeErrorsTotal: Counter<string>;
    constructor(enableDefaultMetrics?: boolean);
    recordCheck(params: {
        algorithm: string;
        allowed: boolean;
        durationSec: number;
        route?: string;
    }): void;
    recordStoreError(failMode: string): void;
    getMetricsText(): Promise<string>;
    getContentType(): string;
    clear(): void;
}
export declare const metrics: MetricsCollector;
//# sourceMappingURL=prometheus.d.ts.map