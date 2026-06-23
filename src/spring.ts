import { loop, now, type TaskHandle } from "./ticker.js";
import { Subscribers } from "./subscribers.js";

export type SpringValue = number | Record<string, number>;

export interface SpringOpts {
  stiffness?: number;
  damping?: number;
  precision?: number;
}

export interface SpringSetOpts {
  hard?: boolean;
  soft?: boolean | number;
}

interface TickContext {
  invMass: number;
  stiffness: number;
  damping: number;
  precision: number;
  settled: boolean;
  dt: number;
}

const tickScalar = (ctx: TickContext, lastValue: number, currentValue: number, targetValue: number): number => {
  const delta = targetValue - currentValue;
  const velocity = (currentValue - lastValue) / (ctx.dt || 1 / 60);
  const spring = ctx.stiffness * delta;
  const damper = ctx.damping * velocity;
  const acceleration = (spring - damper) * ctx.invMass;
  const d = (velocity + acceleration) * ctx.dt;
  if (Math.abs(d) < ctx.precision && Math.abs(delta) < ctx.precision) {
    return targetValue;
  }
  ctx.settled = false;
  return currentValue + d;
};

const tick = <T extends SpringValue>(ctx: TickContext, last: T, current: T, target: T): T => {
  if (typeof current === "number") {
    return tickScalar(ctx, last as number, current, target as number) as T;
  }
  const cur = current as Record<string, number>;
  const lst = last as Record<string, number>;
  const tgt = target as Record<string, number>;
  const result: Record<string, number> = {};
  for (const key in cur) {
    const c = cur[key] ?? 0;
    result[key] = tickScalar(ctx, lst[key] ?? c, c, tgt[key] ?? c);
  }
  return result as T;
};

export class Spring<T extends SpringValue> {
  stiffness: number;
  damping: number;
  precision: number;

  private value: T;
  private lastValue: T;
  private targetValue: T;
  private invMass = 1;
  private invMassRecoveryRate = 0;
  private cancelTask = false;
  private task: TaskHandle | null = null;
  private lastTime = 0;
  private currentToken: object | null = null;
  private readonly subscribers = new Subscribers<T>(() => this.value);

  constructor(value: T, opts: SpringOpts = {}) {
    this.value = value;
    this.lastValue = value;
    this.targetValue = value;
    this.stiffness = opts.stiffness ?? 0.15;
    this.damping = opts.damping ?? 0.8;
    this.precision = opts.precision ?? 0.01;
  }

  get current(): T {
    return this.value;
  }

  subscribe(fn: (value: T) => void): () => void {
    return this.subscribers.subscribe(fn);
  }

  private notify(): void {
    this.subscribers.emit(this.value);
  }

  set(newValue: T, opts: SpringSetOpts = {}): Promise<void> {
    this.targetValue = newValue;
    const token = (this.currentToken = {});

    if (opts.hard || (this.stiffness >= 1 && this.damping >= 1)) {
      this.cancelTask = true;
      if (this.task) {
        this.task.abort();
        this.task = null;
      }
      this.lastTime = now();
      this.lastValue = newValue;
      this.value = newValue;
      this.notify();
      return Promise.resolve();
    }

    if (opts.soft) {
      const rate = opts.soft === true ? 0.5 : opts.soft;
      this.invMassRecoveryRate = 1 / (rate * 60);
      this.invMass = 0;
    }

    let handle = this.task;
    if (!handle) {
      this.lastTime = now();
      this.cancelTask = false;
      handle = loop((time) => {
        if (this.cancelTask) {
          this.cancelTask = false;
          this.task = null;
          return false;
        }
        this.invMass = Math.min(this.invMass + this.invMassRecoveryRate, 1);
        const ctx: TickContext = {
          invMass: this.invMass,
          stiffness: this.stiffness,
          damping: this.damping,
          precision: this.precision,
          settled: true,
          dt: ((time - this.lastTime) * 60) / 1000,
        };
        const next = tick(ctx, this.lastValue, this.value, this.targetValue);
        this.lastTime = time;
        this.lastValue = this.value;
        this.value = next;
        this.notify();
        if (ctx.settled) {
          this.task = null;
        }
        return !ctx.settled;
      });
      this.task = handle;
    }

    return new Promise<void>((fulfil) => {
      void handle.promise.then(() => (token === this.currentToken ? fulfil() : undefined));
    });
  }

  destroy(): void {
    this.cancelTask = true;
    this.task?.abort();
    this.task = null;
    this.subscribers.clear();
  }
}
