export class Subscribers<T> {
  private readonly fns = new Set<(value: T) => void>();
  private readonly getCurrent: () => T;

  constructor(getCurrent: () => T) {
    this.getCurrent = getCurrent;
  }

  subscribe(fn: (value: T) => void): () => void {
    this.fns.add(fn);
    fn(this.getCurrent());
    return () => {
      this.fns.delete(fn);
    };
  }

  emit(value: T): void {
    for (const fn of this.fns) {
      fn(value);
    }
  }

  get size(): number {
    return this.fns.size;
  }

  clear(): void {
    this.fns.clear();
  }
}
