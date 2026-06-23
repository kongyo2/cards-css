type ActiveToken = object | null;

let activeCard: ActiveToken = null;
const subscribers = new Set<(active: ActiveToken) => void>();

export const getActiveCard = (): ActiveToken => activeCard;

export const setActiveCard = (card: ActiveToken): void => {
  activeCard = card;
  for (const fn of subscribers) {
    fn(activeCard);
  }
};

export const subscribeActiveCard = (fn: (active: ActiveToken) => void): (() => void) => {
  subscribers.add(fn);
  fn(activeCard);
  return () => {
    subscribers.delete(fn);
  };
};
