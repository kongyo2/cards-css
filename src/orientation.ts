export interface Orientation {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface RelativeOrientation {
  absolute: Orientation;
  relative: Orientation;
}

const rawOrientation = (event?: DeviceOrientationEvent): Orientation => {
  if (!event) {
    return { alpha: 0, beta: 0, gamma: 0 };
  }
  return { alpha: event.alpha ?? 0, beta: event.beta ?? 0, gamma: event.gamma ?? 0 };
};

let firstReading = true;
let baseOrientation = rawOrientation();

export const resetBaseOrientation = (): void => {
  firstReading = true;
  baseOrientation = rawOrientation();
};

const toRelative = (event?: DeviceOrientationEvent): RelativeOrientation => {
  const o = rawOrientation(event);
  return {
    absolute: o,
    relative: {
      alpha: o.alpha - baseOrientation.alpha,
      beta: o.beta - baseOrientation.beta,
      gamma: o.gamma - baseOrientation.gamma,
    },
  };
};

const subscribers = new Set<(orientation: RelativeOrientation) => void>();
let listening = false;

const handleOrientation = (event: DeviceOrientationEvent): void => {
  if (firstReading) {
    firstReading = false;
    baseOrientation = rawOrientation(event);
  }
  const relative = toRelative(event);
  for (const fn of subscribers) {
    fn(relative);
  }
};

export const subscribeOrientation = (fn: (orientation: RelativeOrientation) => void): (() => void) => {
  subscribers.add(fn);
  fn(toRelative());
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && listening && typeof window !== "undefined") {
      listening = false;
      window.removeEventListener("deviceorientation", handleOrientation, true);
    }
  };
};

type PermissionRequester = { requestPermission?: () => Promise<"granted" | "denied"> };

export const requestOrientationPermission = async (): Promise<boolean> => {
  if (typeof DeviceOrientationEvent === "undefined") {
    return false;
  }
  const requester = DeviceOrientationEvent as unknown as PermissionRequester;
  if (typeof requester.requestPermission !== "function") {
    return true;
  }
  try {
    const result = await requester.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
};
