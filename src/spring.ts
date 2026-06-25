import { loop, now, type TaskHandle } from "./ticker.js";
import { Subscribers } from "./subscribers.js";

export type SpringValue = number | Record<string, number>;

export interface SpringDynamics {
  stiffness?: number;
  damping?: number;
  precision?: number;
}

export interface SpringOpts extends SpringDynamics {
  /**
   * Per-key dynamics overrides for object springs. Each key (e.g. `x`, `y`, `o`)
   * may carry its own stiffness/damping/precision, giving asymmetric, independent
   * motion per axis. Keys without an entry fall back to the base dynamics.
   */
  axes?: Record<string, SpringDynamics>;
}

export interface SpringSetOpts {
  hard?: boolean;
  soft?: boolean | number;
}

interface FrameContext {
  invMass: number;
  stiffness: number;
  damping: number;
  precision: number;
  axes: Record<string, SpringDynamics> | undefined;
  settled: boolean;
  dt: number;
}

interface AxisDynamics {
  stiffness: number;
  damping: number;
  precision: number;
}

const tickScalar = (
  ctx: FrameContext,
  axis: AxisDynamics,
  lastValue: number,
  currentValue: number,
  targetValue: number,
): number => {
  const delta = targetValue - currentValue;
  const velocity = (currentValue - lastValue) / (ctx.dt || 1 / 60);
  const spring = axis.stiffness * delta;
  const damper = axis.damping * velocity;
  const acceleration = (spring - damper) * ctx.invMass;
  const d = (velocity + acceleration) * ctx.dt;
  if (Math.abs(d) < axis.precision && Math.abs(delta) < axis.precision) {
    return targetValue;
  }
  ctx.settled = false;
  return currentValue + d;
};

const resolveAxis = (ctx: FrameContext, key: string): AxisDynamics => {
  const override = ctx.axes?.[key];
  if (!override) {
    return ctx;
  }
  return {
    stiffness: override.stiffness ?? ctx.stiffness,
    damping: override.damping ?? ctx.damping,
    precision: override.precision ?? ctx.precision,
  };
};

const tick = <T extends SpringValue>(ctx: FrameContext, last: T, current: T, target: T): T => {
  if (typeof current === "number") {
    return tickScalar(ctx, ctx, last as number, current, target as number) as T;
  }
  const cur = current as Record<string, number>;
  const lst = last as Record<string, number>;
  const tgt = target as Record<string, number>;
  const result: Record<string, number> = {};
  for (const key in cur) {
    const c = cur[key] ?? 0;
    result[key] = tickScalar(ctx, resolveAxis(ctx, key), lst[key] ?? c, c, tgt[key] ?? c);
  }
  return result as T;
};

export class Spring<T extends SpringValue> {
  stiffness: number;
  damping: number;
  precision: number;
  axes: Record<string, SpringDynamics> | undefined;

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
    this.axes = opts.axes;
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
        const ctx: FrameContext = {
          invMass: this.invMass,
          stiffness: this.stiffness,
          damping: this.damping,
          precision: this.precision,
          axes: this.axes,
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
