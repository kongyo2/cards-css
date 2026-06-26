import { adjust, clamp, round } from "./math.js";
import { Spring, type SpringSetOpts, type SpringOpts, type SpringDynamics } from "./spring.js";
import { CLASS, applyVars, buildLayerElement, normalizeMask } from "./dom.js";
import { getActiveCard, setActiveCard, subscribeActiveCard } from "./active-registry.js";
import { resetBaseOrientation, subscribeOrientation, type RelativeOrientation } from "./orientation.js";
import { generateTextures, texturesToCssVariables } from "./textures.js";
import type { CssVars, HoloCardOptions, HoloLayerOptions, ShowcaseOptions, VisualOptions } from "./types.js";

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
const DEFAULT_MAX_TILT = 50 / 3.5;
const DEFAULT_PRECISION = 0.01;

interface BaseDynamics {
  stiffness: number;
  damping: number;
  precision?: number;
  axes?: Record<string, SpringDynamics>;
}

interface MutableDynamics {
  stiffness: number;
  damping: number;
  precision: number;
  axes: Record<string, SpringDynamics> | undefined;
}

const mergeAxes = (
  base: Record<string, SpringDynamics> | undefined,
  override: Record<string, SpringDynamics> | undefined,
): Record<string, SpringDynamics> | undefined => {
  if (!base) {
    return override;
  }
  if (!override) {
    return base;
  }
  const out: Record<string, SpringDynamics> = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = { ...base[key], ...override[key] };
  }
  return out;
};

const resolveDynamics = (base: BaseDynamics, override?: SpringOpts): BaseDynamics => {
  const out: BaseDynamics = {
    stiffness: override?.stiffness ?? base.stiffness,
    damping: override?.damping ?? base.damping,
  };
  const precision = override?.precision ?? base.precision;
  if (precision !== undefined) {
    out.precision = precision;
  }
  const axes = mergeAxes(base.axes, override?.axes);
  if (axes !== undefined) {
    out.axes = axes;
  }
  return out;
};

const assignDynamics = (spring: MutableDynamics, dyn: BaseDynamics): void => {
  spring.stiffness = dyn.stiffness;
  spring.damping = dyn.damping;
  spring.precision = dyn.precision ?? DEFAULT_PRECISION;
  spring.axes = dyn.axes;
};

const cssDimension = (value: string | number, unit: string): string =>
  typeof value === "number" ? `${value}${unit}` : value;

interface ResolvedShowcase {
  delay: number;
  duration: number;
  loop: boolean;
  speed: number;
  intensity: number;
  dynamics: BaseDynamics;
}

const resolveShowcase = (showcase: boolean | ShowcaseOptions | undefined): ResolvedShowcase => {
  const opts: ShowcaseOptions = typeof showcase === "object" ? showcase : {};
  return {
    delay: opts.delay ?? 2000,
    duration: opts.duration ?? 4000,
    loop: opts.loop ?? false,
    speed: opts.speed ?? 0.05,
    intensity: opts.intensity ?? 25,
    dynamics: resolveDynamics({ stiffness: 0.02, damping: 0.5 }, opts.spring),
  };
};

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
  private frontElement: HTMLElement | null;
  private layersElement: HTMLElement | null = null;
  private readonly options: Required<
    Pick<HoloCardOptions, "interactive" | "activateOnClick" | "gyroscope" | "showcase">
  >;

  private readonly springRotate: Spring<Vec2>;
  private readonly springGlare: Spring<Glare>;
  private readonly springBackground: Spring<Vec2>;
  private readonly springPointer: Spring<Vec2>;
  private readonly springRotateDelta: Spring<Vec2>;
  private readonly springTranslate: Spring<Vec2>;
  private readonly springScale: Spring<number>;

  private readonly liveRotate: BaseDynamics;
  private readonly liveGlare: BaseDynamics;
  private readonly liveBackground: BaseDynamics;
  private readonly livePointer: BaseDynamics;
  private readonly snapDynamics: BaseDynamics;

  private readonly tiltFactorX: number;
  private readonly tiltFactorY: number;
  private readonly tiltScaleX: number;
  private readonly tiltScaleY: number;
  private readonly parallax: number;
  private readonly glareRange: number;
  private readonly returnDelay: number;
  private readonly showcaseConfig: ResolvedShowcase;

  private isInteracting = false;
  private firstPop = true;
  private isVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
  private destroyed = false;

  private renderScheduled = false;
  private interactRaf: number | null = null;
  private pendingUpdate: { background: Vec2; rotate: Vec2; glare: Glare; pointer: Vec2 } | null = null;

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
    this.frontElement = element.querySelector<HTMLElement>(`.${CLASS.front}`);
    this.layersElement = element.querySelector<HTMLElement>(`.${CLASS.layers}`);

    this.options = {
      interactive: options.interactive ?? true,
      activateOnClick: options.activateOnClick ?? false,
      gyroscope: options.gyroscope ?? true,
      showcase: options.showcase ?? false,
    };
    this.showcaseRunning = Boolean(options.showcase);
    this.showcaseConfig = resolveShowcase(options.showcase);

    const physics = options.physics ?? {};
    this.tiltFactorX = (physics.maxTiltX ?? physics.maxTilt ?? DEFAULT_MAX_TILT) / 50;
    this.tiltFactorY = (physics.maxTiltY ?? physics.maxTilt ?? DEFAULT_MAX_TILT) / 50;
    this.tiltScaleX = (physics.maxTiltX ?? physics.maxTilt ?? DEFAULT_MAX_TILT) / DEFAULT_MAX_TILT;
    this.tiltScaleY = (physics.maxTiltY ?? physics.maxTilt ?? DEFAULT_MAX_TILT) / DEFAULT_MAX_TILT;
    this.parallax = physics.parallax ?? 1;
    this.glareRange = physics.glareRange ?? 1;
    this.returnDelay = physics.returnDelay ?? 500;

    const interactBase = resolveDynamics(SPRING_INTERACT, physics.interactSpring);
    const popoverBase = resolveDynamics(SPRING_POPOVER, physics.popoverSpring);
    this.snapDynamics = resolveDynamics({ stiffness: SNAP_STIFFNESS, damping: SNAP_DAMPING }, physics.snapSpring);

    this.liveRotate = resolveDynamics(interactBase, physics.springs?.rotate);
    this.liveGlare = resolveDynamics(interactBase, physics.springs?.glare);
    this.liveBackground = resolveDynamics(interactBase, physics.springs?.background);
    this.livePointer = interactBase;

    this.springRotate = new Spring<Vec2>({ x: 0, y: 0 }, this.liveRotate);
    this.springGlare = new Spring<Glare>({ x: 50, y: 50, o: 0 }, this.liveGlare);
    this.springBackground = new Spring<Vec2>({ x: 50, y: 50 }, this.liveBackground);
    this.springPointer = new Spring<Vec2>({ x: 50, y: 50 }, this.livePointer);
    this.springRotateDelta = new Spring<Vec2>(
      { x: 0, y: 0 },
      resolveDynamics(popoverBase, physics.springs?.rotateDelta),
    );
    this.springTranslate = new Spring<Vec2>({ x: 0, y: 0 }, resolveDynamics(popoverBase, physics.springs?.translate));
    this.springScale = new Spring<number>(1, resolveDynamics(popoverBase, physics.springs?.scale));

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

    const mask = normalizeMask(options.mask);
    if (mask?.image) {
      element.style.setProperty("--mask", `url(${mask.image})`);
      if (mask.size) {
        element.style.setProperty("--mask-size", mask.size);
      }
      if (mask.position) {
        element.style.setProperty("--mask-position", mask.position);
      }
      if (mask.repeat) {
        element.style.setProperty("--mask-repeat", mask.repeat);
      }
      element.classList.add(CLASS.masked);
      if (mask.mode === "card") {
        element.classList.add(CLASS.maskCard);
      }
    }
    if (options.foil) {
      element.style.setProperty("--foil", `url(${options.foil})`);
    }
    this.applyVisual(options.visual);
    applyVars(element, options.vars);

    if (!this.layersElement && options.layers?.length && this.frontElement) {
      for (const layer of options.layers) {
        this.addLayer(layer);
      }
    }

    this.applyStaticStyles(options.textureSeed);

    for (const spring of [
      this.springRotate,
      this.springGlare,
      this.springBackground,
      this.springPointer,
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

  private applyVisual(visual: VisualOptions | undefined): void {
    if (!visual) {
      return;
    }
    const style = this.element.style;
    const setNumber = (property: string, value: number | undefined): void => {
      if (typeof value === "number") {
        style.setProperty(property, String(value));
      }
    };
    setNumber("--hc-brightness", visual.brightness);
    setNumber("--hc-contrast", visual.contrast);
    setNumber("--hc-saturate", visual.saturate);
    setNumber("--hc-glare-opacity", visual.glareOpacity);
    setNumber("--hc-shine-opacity", visual.shineOpacity);
    if (visual.lineSpace !== undefined) {
      style.setProperty("--space", cssDimension(visual.lineSpace, "%"));
    }
    if (visual.lineAngle !== undefined) {
      style.setProperty("--angle", cssDimension(visual.lineAngle, "deg"));
    }
    if (visual.glitterSize !== undefined) {
      style.setProperty("--glittersize", cssDimension(visual.glitterSize, "%"));
    }
    if (visual.imageFit !== undefined) {
      style.setProperty("--imgsize", visual.imageFit);
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
      const onFocusOut = (event: FocusEvent): void => {
        const next = event.relatedTarget;
        if (next instanceof Node && this.element.contains(next)) {
          return;
        }
        this.deactivate();
      };
      this.rotator.addEventListener("click", onClick);
      this.rotator.addEventListener("focusout", onFocusOut);
      this.rotator.tabIndex = this.rotator.tabIndex >= 0 ? this.rotator.tabIndex : 0;
      this.cleanups.push(() => this.rotator.removeEventListener("click", onClick));
      this.cleanups.push(() => this.rotator.removeEventListener("focusout", onFocusOut));

      const interactiveOverlay = this.element.querySelector<HTMLElement>(`.${CLASS.overlayInteractive}`);
      if (interactiveOverlay) {
        const stopClick = (event: Event): void => event.stopPropagation();
        interactiveOverlay.addEventListener("click", stopClick);
        this.cleanups.push(() => interactiveOverlay.removeEventListener("click", stopClick));
      }

      const onScroll = (): void => this.reposition();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      this.cleanups.push(() => window.removeEventListener("scroll", onScroll));
      this.cleanups.push(() => window.removeEventListener("resize", onScroll));
    }
  }

  private parallaxBackground(x: number, y: number): Vec2 {
    return { x: round(50 + (x - 50) * this.parallax), y: round(50 + (y - 50) * this.parallax) };
  }

  private rangeGlare(x: number, y: number, o: number): Glare {
    return { x: round(50 + (x - 50) * this.glareRange), y: round(50 + (y - 50) * this.glareRange), o };
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
      background: this.parallaxBackground(adjust(percent.x, 0, 100, 37, 63), adjust(percent.y, 0, 100, 33, 67)),
      rotate: { x: round(-(center.x * this.tiltFactorX)), y: round(center.y * this.tiltFactorY) },
      glare: this.rangeGlare(round(percent.x), round(percent.y), 1),
      pointer: { x: round(percent.x), y: round(percent.y) },
    };

    if (this.interactRaf === null) {
      this.interactRaf = requestFrame(() => {
        if (this.pendingUpdate) {
          const update = this.pendingUpdate;
          this.updateSprings(update.background, update.rotate, update.glare, update.pointer);
          this.pendingUpdate = null;
        }
        this.interactRaf = null;
      });
    }
  }

  private interactEnd(delay = this.returnDelay): void {
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
      this.setGroupDynamics(this.snapDynamics);
      void this.springRotate.set({ x: 0, y: 0 }, { soft: 1 });
      void this.springGlare.set({ x: 50, y: 50, o: 0 }, { soft: 1 });
      void this.springBackground.set({ x: 50, y: 50 }, { soft: 1 });
      void this.springPointer.set({ x: 50, y: 50 }, { soft: 1 });
    }, delay);
  }

  private setGroupDynamics(dyn: BaseDynamics): void {
    assignDynamics(this.springRotate, dyn);
    assignDynamics(this.springGlare, dyn);
    assignDynamics(this.springBackground, dyn);
    assignDynamics(this.springPointer, dyn);
  }

  private applyLiveDynamics(): void {
    assignDynamics(this.springRotate, this.liveRotate);
    assignDynamics(this.springGlare, this.liveGlare);
    assignDynamics(this.springBackground, this.liveBackground);
    assignDynamics(this.springPointer, this.livePointer);
  }

  private settle(opts: SpringSetOpts): void {
    void this.springScale.set(1, opts);
    void this.springTranslate.set({ x: 0, y: 0 }, opts);
    void this.springRotateDelta.set({ x: 0, y: 0 }, opts);
  }

  private updateSprings(background: Vec2, rotate: Vec2, glare: Glare, pointer: Vec2): void {
    this.applyLiveDynamics();
    void this.springBackground.set(background);
    void this.springRotate.set(rotate);
    void this.springGlare.set(glare);
    void this.springPointer.set(pointer);
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
    const pointer = this.springPointer.current;
    const translate = this.springTranslate.current;
    const scale = this.springScale.current;

    const fromCenter = clamp(Math.sqrt((glare.y - 50) * (glare.y - 50) + (glare.x - 50) * (glare.x - 50)) / 50, 0, 1);

    const style = this.element.style;
    style.setProperty("--pointer-x", `${glare.x}%`);
    style.setProperty("--pointer-y", `${glare.y}%`);
    style.setProperty("--pointer-from-center", String(fromCenter));
    style.setProperty("--pointer-from-top", String(glare.y / 100));
    style.setProperty("--pointer-from-left", String(glare.x / 100));
    style.setProperty("--pointer-dx", String(round((pointer.x - 50) / 50)));
    style.setProperty("--pointer-dy", String(round((pointer.y - 50) / 50)));
    style.setProperty("--card-opacity", String(glare.o));
    style.setProperty("--rotate-x", `${rotate.x + rotateDelta.x}deg`);
    style.setProperty("--rotate-y", `${rotate.y + rotateDelta.y}deg`);
    style.setProperty("--tilt-x", String(round(rotate.x + rotateDelta.x)));
    style.setProperty("--tilt-y", String(round(rotate.y + rotateDelta.y)));
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
      this.element.style.setProperty("--card-active", "1");
      if (this.options.gyroscope) {
        this.startGyroscope();
      }
    } else {
      this.retreat();
      this.element.classList.remove(CLASS.active);
      this.element.style.setProperty("--card-active", "0");
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
    const gx = adjust(degrees.x, -limit.x, limit.x, 0, 100);
    const gy = adjust(degrees.y, -limit.y, limit.y, 0, 100);
    this.setInteracting(true);
    this.updateSprings(
      this.parallaxBackground(
        adjust(degrees.x, -limit.x, limit.x, 37, 63),
        adjust(degrees.y, -limit.y, limit.y, 33, 67),
      ),
      { x: round(degrees.x * -1 * this.tiltScaleX), y: round(degrees.y * this.tiltScaleY) },
      this.rangeGlare(gx, gy, 1),
      { x: gx, y: gy },
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
    const config = this.showcaseConfig;
    const amp = config.intensity;
    let r = 0;
    this.showcaseStart = setTimeout(() => {
      if (this.endTimer) {
        clearTimeout(this.endTimer);
        this.endTimer = null;
      }
      this.setInteracting(true);
      this.setGroupDynamics(config.dynamics);
      if (!this.isVisible) {
        this.setInteracting(false);
        return;
      }
      this.showcaseInterval = setInterval(() => {
        r += config.speed;
        void this.springRotate.set({ x: Math.sin(r) * amp, y: Math.cos(r) * amp });
        void this.springGlare.set({
          x: 55 + Math.sin(r) * amp * 2.2,
          y: 55 + Math.cos(r) * amp * 2.2,
          o: 0.8,
        });
        void this.springBackground.set({
          x: 20 + Math.sin(r) * amp * 0.8,
          y: 20 + Math.cos(r) * amp * 0.8,
        });
        void this.springPointer.set({ x: 50 + Math.sin(r) * amp * 1.6, y: 50 + Math.cos(r) * amp * 1.6 });
      }, 20);
      if (!config.loop) {
        this.showcaseEnd = setTimeout(() => {
          if (this.showcaseInterval) {
            clearInterval(this.showcaseInterval);
            this.showcaseInterval = null;
          }
          this.interactEnd(0);
        }, config.duration);
      }
    }, config.delay);
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

  /** The `.holo-card__front` element, for appending custom content at runtime. */
  get front(): HTMLElement | null {
    return this.frontElement;
  }

  /** Apply CSS custom properties to the root element (for content linkage). */
  setVars(vars: CssVars): void {
    applyVars(this.element, vars);
  }

  /** Update fine-grained visual controls at runtime. */
  setVisual(visual: VisualOptions): void {
    this.applyVisual(visual);
  }

  /**
   * Insert an extra layer between the artwork and the foil at runtime, returning
   * the created element. Requires the card to have a `.holo-card__front`.
   */
  addLayer(layer: HoloLayerOptions): HTMLElement {
    const front = this.frontElement;
    if (!front) {
      throw new Error("@kongyo2/cards-css: cannot add a layer — the card has no .holo-card__front element.");
    }
    const doc = front.ownerDocument;
    const element = buildLayerElement(doc, layer);
    if (!this.layersElement) {
      const container = doc.createElement("div");
      container.className = CLASS.layers;
      const shine = front.querySelector(`.${CLASS.shine}`);
      front.insertBefore(container, shine);
      this.layersElement = container;
    }
    this.layersElement.appendChild(element);
    return element;
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
      this.springPointer,
      this.springRotateDelta,
      this.springTranslate,
      this.springScale,
    ]) {
      spring.destroy();
    }
    this.element.classList.remove(CLASS.interactive, CLASS.interacting, CLASS.active);
  }
}
