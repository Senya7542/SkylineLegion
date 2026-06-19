export const TRACK_END = 146;
export const BOSS_Z = 155;
export const PLAYER_LIMIT = 1.34;
export const LANE_X = 1.62;
export const PLAYER_GATE_CONTACT_Z = 2.35;
export const MAX_BULLETS = 128;
export const MAX_IMPACTS = 40;
export const MAX_VISIBLE_TROOPS = 96;

const GATE_TEMPLATES = [
  { z: 28, left: [-14, -7], right: [2, 7] },
  { z: 64, left: [-8, 0], right: [4, 11] },
  { z: 98, left: [-18, -9], right: [-5, 3] },
  { z: 128, left: [-12, -3], right: [1, 8] },
];

export const WAVES = [
  { z: 46, count: 18, speed: 1.75 },
  { z: 81, count: 28, speed: 2.05 },
  { z: 113, count: 40, speed: 2.35 },
  { z: 140, count: 52, speed: 2.65 },
];

const seeded = (seed) => {
  let value = seed || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

const pickRange = (random, [min, max]) =>
  Math.round(min + random() * (max - min));

export function createGates(runSeed = 1) {
  const random = seeded(runSeed * 7919 + 17);
  return GATE_TEMPLATES.map((template, index) => {
    let left = pickRange(random, template.left);
    let right = pickRange(random, template.right);

    // Every pair keeps at least one recoverable route while still varying per run.
    if (Math.max(left, right) < 1) {
      if (random() > 0.5) left = 1 + index * 2;
      else right = 1 + index * 2;
    }

    return {
      z: template.z,
      hitStep: index >= 2 ? 2 : 1,
      maxValue: 55 + index * 10,
      left,
      right,
    };
  });
}

export const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

export const formatGateValue = (value) =>
  value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;

export const gateColor = (value) => {
  if (value < 0) return "#ff4b3e";
  if (value === 0) return "#ffd36b";
  return "#35dffc";
};
