export const round = (value: number, precision = 3): number => parseFloat(value.toFixed(precision));

export const clamp = (value: number, min = 0, max = 100): number => Math.min(Math.max(value, min), max);

export const adjust = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number =>
  round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin));
