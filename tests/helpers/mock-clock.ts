import { Clock } from '../../src/algorithms/memory/base.js';

export class MockClock implements Clock {
  private currentMs: number;

  constructor(initialMs = 1_700_000_000_000) {
    this.currentMs = initialMs;
  }

  now(): number {
    return this.currentMs;
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }

  set(ms: number): void {
    this.currentMs = ms;
  }
}
