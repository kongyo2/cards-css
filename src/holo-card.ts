import { adjust, clamp, round } from "./math.js";
import { Spring, type SpringSetOpts } from "./spring.js";
import { CLASS } from "./dom.js";
import { getActiveCard, setActiveCard, subscribeActiveCard } from "./active-registry.js";
import { resetBaseOrientation, subscribeOrientation, type RelativeOrientation } from "./orientation.js";
import { generateTextures, texturesToCssVariables } from "./textures.js";
import type { HoloCardOptions } from "./types.js";

const requestFrame = (cb: () => void): number =>
  typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(cb) : setTimeout(cb, 16);

const cancelFrame = (id: number): void => {
  if (typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
};

const SPRING_INTERACT = { stiffness: 0.066, damping: 0.25 };
const SPRING_POPOVER = { stiffness: 0.033, damping: 0.45 };
const SNAP_STIFFNESS = 0.01;
const SNAP_DAMPING = 0.06;

interface Vec2 {
  x: number;
  y: number;
  [key: string]: number;
}

interface Glare extends Vec2 {
  o: number;
}

export class HoloCard {
  readonly element: HTMLElement;

  private readonly rotator: HTMLElement;
  private readonly options: Required<
    Pick<HoloCardOptions, "interactive" | "activateOnClick" | "gyroscope" | "showcase">
  >;

  private readonly springRotate = new Spring<Vec2>({ x: 0, y: 0 }, SPRING_INTERACT);
  private readonly springGlare = new Spring<Glare>({ x: 50, y: 50, o: 0 }, SPRING_INTERACT);
  private readonly springBackground = new Spring<Vec2>({ x: 50, y: 50 }, SPRING_INTERACT);
  private readonly springRotateDelta = new Spring<Vec2>({ x: 0, y: 0 }, SPRING_POPOVER);
  private readonly springTranslate = new Spring<Vec2>({ x: 0, y: 0 }, SPRING_POPOVER);
  private readonly springScale = new Spring<number>(1, SPRING_POPOVER);

  private isInteracting = false;
  private firstPop = true;
  private isVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
  private destroyed = false;

  private renderScheduled = false;
  private interactRaf: number | null = null;
  private pendingUpdate: { background: Vec2; rotate: Vec2; glare: Glare } | null = null;

  private repositionTimer: ReturnType<typeof setTimeout> | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private showcaseStart: ReturnType<typeof setTimeout> | null = null;
  private showcaseEnd: ReturnType<typeof setTimeout> | null = null;
  private showcaseInterval: ReturnType<typeof setInterval> | null = null;
  private showcaseRunning: boolean;

  private readonly cleanups: Array<() => void> = [];
  private unsubscribeOrientation: (() => void) | null = null;

  constructor(element: HTMLElement, options: HoloCardOptions = {}) {
    this.element = element;
    const rotator = element.querySelector<HTMLElement>(`.${CLASS.rotator}`);
    if (!rotator) {
      throw new Error("@kongyo2/cards-css: holo card element is missing its .holo-card__rotator child.");
    }
    this.rotator = rotator;

    this.options = {
      interactive: options.interactive ?? true,
      activateOnClick: options.activateOnClick ?? false,
      gyroscope: options.gyroscope ?? true,
      showcase: options.showcase ?? false,
    };
    this.showcaseRunning = this.options.showcase;

    if (options.effect) {
      element.dataset.effect = options.effect;
    } else if (!element.dataset.effect) {
      element.dataset.effect = "none";
    }
    if (options.glow) {
      element.style.setProperty("--card-glow", options.glow);
    }
    if (typeof options.aspectRatio === "number") {
      element.style.setProperty("--card-aspect", String(options.aspectRatio));
    }
    if (options.mask) {
      element.style.setProperty("--mask", `url(${options.mask})`);
      element.classList.add(CLASS.masked);
    }
    if (options.foil) {
      element.style.setProperty("--foil", `url(${options.foil})`);
    }

    this.applyStaticStyles(options.textureSeed);

    for (const spring of [
      this.springRotate,
      this.springGlare,
      this.springBackground,
      this.springRotateDelta,
      this.springTranslate,
      this.springScale,
    ]) {
      this.cleanups.push(spring.subscribe(() => this.scheduleRender()));
    }

    this.applyStyles();

    if (this.options.interactive) {
      this.enableInteractive();
    }

    this.cleanups.push(subscribeActiveCard(() => this.onActiveChange()));

    if (typeof document !== "undefined") {
      const onVisibility = (): void => this.onVisibilityChange();
      document.addEventListener("visibilitychange", onVisibility);
      this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    }

    if (this.options.showcase) {
      this.startShowcase();
    }
  }

  private applyStaticStyles(seed: number | undefined): void {
    const seedX = Math.random();
    const seedY = Math.random();
    const cosmosX = Math.floor(seedX * 734);
    const cosmosY = Math.floor(seedY * 1280);
    this.element.style.setProperty("--seedx", String(seedX));
    this.element.style.setProperty("--seedy", String(seedY));
    this.element.style.setProperty("--cosmosbg", `${cosmosX}px ${cosmosY}px`);

    if (typeof seed === "number") {
      const vars = texturesToCssVariables(generateTextures({ seed }));
      for (const [name, value] of Object.entries(vars)) {
        this.element.style.setProperty(name, value);
      }
    }
  }

  private enableInteractive(): void {
    this.element.classList.add(CLASS.interactive);

    const onPointerMove = (event: PointerEvent): void => this.interact(event);
    const onPointerLeave = (): void => this.interactEnd();
    this.rotator.addEventListener("pointermove", onPointerMove);
    this.rotator.addEventListener("pointerleave", onPointerLeave);
    this.cleanups.push(() => this.rotator.removeEventListener("pointermove", onPointerMove));
    this.cleanups.push(() => this.rotator.removeEventListener("pointerleave", onPointerLeave));

    if (this.options.activateOnClick) {
      const onClick = (): void => this.toggleActive();
      const onBlur = (): void => this.deactivate();
      this.rotator.addEventListener("click", onClick);
      this.rotator.addEventListener("blur", onBlur);
      this.rotator.tabIndex = this.rotator.tabIndex >= 0 ? this.rotator.tabIndex : 0;
      this.cleanups.push(() => this.rotator.removeEventListener("click", onClick));
      this.cleanups.push(() => this.rotator.removeEventListener("blur", onBlur));

      const onScroll = (): void => this.reposition();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      this.cleanups.push(() => window.removeEventListener("scroll", onScroll));
      this.cleanups.push(() => window.removeEventListener("resize", onScroll));
    }
  }

  private interact(event: PointerEvent): void {
    this.endShowcase();

    if (!this.isVisible) {
      this.setInteracting(false);
      return;
    }

    const active = getActiveCard();
    if (active && active !== this) {
      this.setInteracting(false);
      return;
    }

    this.setInteracting(true);
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }

    const rect = this.rotator.getBoundingClientRect();
    const absolute = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const percent = {
      x: clamp(round((100 / rect.width) * absolute.x)),
      y: clamp(round((100 / rect.height) * absolute.y)),
    };
    const center = { x: percent.x - 50, y: percent.y - 50 };

    this.pendingUpdate = {
      background: { x: adjust(percent.x, 0, 100, 37, 63), y: adjust(percent.y, 0, 100, 33, 67) },
      rotate: { x: round(-(center.x / 3.5)), y: round(center.y / 3.5) },
      glare: { x: round(percent.x), y: round(percent.y), o: 1 },
    };

    if (this.interactRaf === null) {
      this.interactRaf = requestFrame(() => {
        if (this.pendingUpdate) {
          this.updateSprings(this.pendingUpdate.background, this.pendingUpdate.rotate, this.pendingUpdate.glare);
          this.pendingUpdate = null;
        }
        this.interactRaf = null;
      });
    }
  }

  private interactEnd(delay = 500): void {
    if (this.interactRaf !== null) {
      cancelFrame(this.interactRaf);
      this.interactRaf = null;
    }
    this.pendingUpdate = null;

    if (this.endTimer) {
      clearTimeout(this.endTimer);
    }
    this.endTimer = setTimeout(() => {
      this.setInteracting(false);
      this.setSpringDynamics(SNAP_STIFFNESS, SNAP_DAMPING);
      void this.springRotate.set({ x: 0, y: 0 }, { soft: 1 });
      void this.springGlare.set({ x: 50, y: 50, o: 0 }, { soft: 1 });
      void this.springBackground.set({ x: 50, y: 50 }, { soft: 1 });
    }, delay);
  }

  private setSpringDynamics(stiffness: number, damping: number): void {
    for (const spring of [this.springRotate, this.springGlare, this.springBackground]) {
      spring.stiffness = stiffness;
      spring.damping = damping;
    }
  }

  private settle(opts: SpringSetOpts): void {
    void this.springScale.set(1, opts);
    void this.springTranslate.set({ x: 0, y: 0 }, opts);
    void this.springRotateDelta.set({ x: 0, y: 0 }, opts);
  }

  private updateSprings(background: Vec2, rotate: Vec2, glare: Glare): void {
    this.setSpringDynamics(SPRING_INTERACT.stiffness, SPRING_INTERACT.damping);
    void this.springBackground.set(background);
    void this.springRotate.set(rotate);
    void this.springGlare.set(glare);
  }

  private setInteracting(value: boolean): void {
    this.isInteracting = value;
    this.element.classList.toggle(CLASS.interacting, value);
  }

  get interacting(): boolean {
    return this.isInteracting;
  }

  private scheduleRender(): void {
    if (this.renderScheduled) {
      return;
    }
    this.renderScheduled = true;
    requestFrame(() => {
      this.renderScheduled = false;
      this.applyStyles();
    });
  }

  private applyStyles(): void {
    const glare = this.springGlare.current;
    const rotate = this.springRotate.current;
    const rotateDelta = this.springRotateDelta.current;
    const background = this.springBackground.current;
    const translate = this.springTranslate.current;
    const scale = this.springScale.current;

    const fromCenter = clamp(Math.sqrt((glare.y - 50) * (glare.y - 50) + (glare.x - 50) * (glare.x - 50)) / 50, 0, 1);

    const style = this.element.style;
    style.setProperty("--pointer-x", `${glare.x}%`);
    style.setProperty("--pointer-y", `${glare.y}%`);
    style.setProperty("--pointer-from-center", String(fromCenter));
    style.setProperty("--pointer-from-top", String(glare.y / 100));
    style.setProperty("--pointer-from-left", String(glare.x / 100));
    style.setProperty("--card-opacity", String(glare.o));
    style.setProperty("--rotate-x", `${rotate.x + rotateDelta.x}deg`);
    style.setProperty("--rotate-y", `${rotate.y + rotateDelta.y}deg`);
    style.setProperty("--background-x", `${background.x}%`);
    style.setProperty("--background-y", `${background.y}%`);
    style.setProperty("--card-scale", String(scale));
    style.setProperty("--translate-x", `${translate.x}px`);
    style.setProperty("--translate-y", `${translate.y}px`);
  }

  private onActiveChange(): void {
    if (getActiveCard() === this) {
      this.popover();
      this.element.classList.add(CLASS.active);
      if (this.options.gyroscope) {
        this.startGyroscope();
      }
    } else {
      this.retreat();
      this.element.classList.remove(CLASS.active);
      this.stopGyroscope();
    }
  }

  private popover(): void {
    const rect = this.element.getBoundingClientRect();
    let delay = 100;
    const scaleW = (window.innerWidth / rect.width) * 0.9;
    const scaleH = (window.innerHeight / rect.height) * 0.9;
    const scaleF = 1.75;
    this.setCenter();
    if (this.firstPop) {
      delay = 1000;
      void this.springRotateDelta.set({ x: 360, y: 0 });
    }
    this.firstPop = false;
    void this.springScale.set(Math.min(scaleW, scaleH, scaleF));
    this.interactEnd(delay);
  }

  private retreat(): void {
    this.settle({ soft: true });
    this.interactEnd(100);
  }

  private reset(): void {
    this.interactEnd(0);
    this.settle({ hard: true });
    void this.springRotate.set({ x: 0, y: 0 }, { hard: true });
  }

  private setCenter(): void {
    const rect = this.element.getBoundingClientRect();
    const view = document.documentElement;
    void this.springTranslate.set({
      x: round(view.clientWidth / 2 - rect.x - rect.width / 2),
      y: round(view.clientHeight / 2 - rect.y - rect.height / 2),
    });
  }

  private reposition(): void {
    if (this.repositionTimer) {
      clearTimeout(this.repositionTimer);
    }
    this.repositionTimer = setTimeout(() => {
      if (getActiveCard() === this) {
        this.setCenter();
      }
    }, 300);
  }

  private startGyroscope(): void {
    if (this.unsubscribeOrientation) {
      return;
    }
    this.unsubscribeOrientation = subscribeOrientation((orientation) => this.orientate(orientation));
  }

  private stopGyroscope(): void {
    if (this.unsubscribeOrientation) {
      this.unsubscribeOrientation();
      this.unsubscribeOrientation = null;
    }
  }

  private orientate(orientation: RelativeOrientation): void {
    if (getActiveCard() !== this) {
      return;
    }
    const limit = { x: 16, y: 18 };
    const degrees = {
      x: clamp(orientation.relative.gamma, -limit.x, limit.x),
      y: clamp(orientation.relative.beta, -limit.y, limit.y),
    };
    this.setInteracting(true);
    this.updateSprings(
      { x: adjust(degrees.x, -limit.x, limit.x, 37, 63), y: adjust(degrees.y, -limit.y, limit.y, 33, 67) },
      { x: round(degrees.x * -1), y: round(degrees.y) },
      { x: adjust(degrees.x, -limit.x, limit.x, 0, 100), y: adjust(degrees.y, -limit.y, limit.y, 0, 100), o: 1 },
    );
  }

  private onVisibilityChange(): void {
    this.isVisible = document.visibilityState === "visible";
    this.endShowcase();
    this.reset();
  }

  private startShowcase(): void {
    if (!this.isVisible) {
      return;
    }
    const s = 0.02;
    const d = 0.5;
    let r = 0;
    this.showcaseStart = setTimeout(() => {
      this.setInteracting(true);
      this.setSpringDynamics(s, d);
      if (!this.isVisible) {
        this.setInteracting(false);
        return;
      }
      this.showcaseInterval = setInterval(() => {
        r += 0.05;
        void this.springRotate.set({ x: Math.sin(r) * 25, y: Math.cos(r) * 25 });
        void this.springGlare.set({ x: 55 + Math.sin(r) * 55, y: 55 + Math.cos(r) * 55, o: 0.8 });
        void this.springBackground.set({ x: 20 + Math.sin(r) * 20, y: 20 + Math.cos(r) * 20 });
      }, 20);
      this.showcaseEnd = setTimeout(() => {
        if (this.showcaseInterval) {
          clearInterval(this.showcaseInterval);
          this.showcaseInterval = null;
        }
        this.interactEnd(0);
      }, 4000);
    }, 2000);
  }

  private endShowcase(): void {
    if (!this.showcaseRunning) {
      return;
    }
    if (this.showcaseEnd) {
      clearTimeout(this.showcaseEnd);
      this.showcaseEnd = null;
    }
    if (this.showcaseStart) {
      clearTimeout(this.showcaseStart);
      this.showcaseStart = null;
    }
    if (this.showcaseInterval) {
      clearInterval(this.showcaseInterval);
      this.showcaseInterval = null;
    }
    this.showcaseRunning = false;
  }

  private toggleActive(): void {
    if (getActiveCard() === this) {
      setActiveCard(null);
    } else {
      this.endShowcase();
      resetBaseOrientation();
      setActiveCard(this);
    }
  }

  activate(): void {
    if (getActiveCard() !== this) {
      this.endShowcase();
      resetBaseOrientation();
      setActiveCard(this);
    }
  }

  deactivate(): void {
    this.interactEnd();
    if (getActiveCard() === this) {
      setActiveCard(null);
    }
  }

  setEffect(effect: HoloCardOptions["effect"]): void {
    this.element.dataset.effect = effect ?? "none";
  }

  get active(): boolean {
    return getActiveCard() === this;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.endShowcase();
    this.stopGyroscope();
    if (getActiveCard() === this) {
      setActiveCard(null);
    }
    for (const timer of [this.repositionTimer, this.endTimer]) {
      if (timer) {
        clearTimeout(timer);
      }
    }
    if (this.interactRaf !== null) {
      cancelFrame(this.interactRaf);
      this.interactRaf = null;
    }
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups.length = 0;
    for (const spring of [
      this.springRotate,
      this.springGlare,
      this.springBackground,
      this.springRotateDelta,
      this.springTranslate,
      this.springScale,
    ]) {
      spring.destroy();
    }
    this.element.classList.remove(CLASS.interactive, CLASS.interacting, CLASS.active);
  }
}
