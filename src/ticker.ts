export const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

const raf: (cb: (time: number) => void) => void =
  typeof requestAnimationFrame !== "undefined"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(now()), 1000 / 60);

interface Task {
  c: (time: number) => boolean;
  f: () => void;
}

export interface TaskHandle {
  promise: Promise<void>;
  abort: () => void;
}

const tasks = new Set<Task>();

const runTasks = (time: number): void => {
  tasks.forEach((task) => {
    if (!task.c(time)) {
      tasks.delete(task);
      task.f();
    }
  });
  if (tasks.size !== 0) {
    raf(runTasks);
  }
};

export const loop = (callback: (time: number) => boolean): TaskHandle => {
  let task: Task;
  if (tasks.size === 0) {
    raf(runTasks);
  }
  return {
    promise: new Promise<void>((fulfil) => {
      task = { c: callback, f: fulfil };
      tasks.add(task);
    }),
    abort: () => {
      tasks.delete(task);
    },
  };
};
