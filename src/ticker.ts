export const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

const raf: (cb: (time: number) => void) => void =
  typeof requestAnimationFrame !== "undefined"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(now()), 1000 / 60);

type Task = (time: number) => boolean;

export interface TaskHandle {
  abort: () => void;
}

const tasks = new Set<Task>();

const runTasks = (time: number): void => {
  tasks.forEach((task) => {
    if (!task(time)) {
      tasks.delete(task);
    }
  });
  if (tasks.size !== 0) {
    raf(runTasks);
  }
};

export const loop = (callback: Task): TaskHandle => {
  if (tasks.size === 0) {
    raf(runTasks);
  }
  tasks.add(callback);
  return {
    abort: () => {
      tasks.delete(callback);
    },
  };
};
