export interface SpringConfig {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
}

export const CURIO_SPRINGS: Record<string, SpringConfig> = {
  hover: { type: "spring", stiffness: 400, damping: 30 },
  tactile: { type: "spring", stiffness: 300, damping: 25, mass: 0.8 },
  layoutMorph: { type: "spring", stiffness: 280, damping: 28 },
  progressiveMorph: { type: "spring", stiffness: 200, damping: 22 },
};
