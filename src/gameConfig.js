export const TRACK_END = 170;
export const BOSS_Z = 179;
export const PLAYER_LIMIT = 1.34;
export const LANE_X = 1.62;
export const PLAYER_GATE_CONTACT_Z = 2.35;
export const MAX_BULLETS = 128;
export const MAX_IMPACTS = 40;
export const MAX_VISIBLE_TROOPS = 96;

const GATE_TEMPLATES = [
  { z: 28, left: [-10, -5], right: [1, 4], shotsPerPoint: 1 },
  { z: 67, left: [-14, -7], right: [-1, 5], shotsPerPoint: 1 },
  { z: 108, left: [-18, -10], right: [-4, 4], shotsPerPoint: 1 },
  { z: 145, left: [-22, -13], right: [-6, 3], shotsPerPoint: 1 },
];

export const WAVES = [
  { z: 54, count: 44, speed: 2.05, gateIndex: 0 },
  { z: 94, count: 66, speed: 2.32, gateIndex: 1 },
  { z: 135, count: 86, speed: 2.62, gateIndex: 2 },
  { z: 166, count: 108, speed: 2.92, gateIndex: 3 },
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

    return {
      z: template.z,
      shotsPerPoint: template.shotsPerPoint,
      maxValue: 24 + index * 7,
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
