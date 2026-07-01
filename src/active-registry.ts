import { Subscribers } from "./subscribers.js";

type ActiveToken = object | null;

let activeCard: ActiveToken = null;
const subscribers = new Subscribers<ActiveToken>(() => activeCard);

export const getActiveCard = (): ActiveToken => activeCard;

export const setActiveCard = (card: ActiveToken): void => {
  if (card === activeCard) {
    return;
  }
  activeCard = card;
  subscribers.emit(activeCard);
};

export const subscribeActiveCard = (fn: (active: ActiveToken) => void): (() => void) => subscribers.subscribe(fn);
