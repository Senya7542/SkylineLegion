export const TRACK_END = 170;
export const BOSS_Z = 179;
export const PLAYER_LIMIT = 1.34;
export const LANE_X = 1.62;
export const PLAYER_GATE_CONTACT_Z = 2.35;
export const MAX_BULLETS = 128;
export const MAX_IMPACTS = 40;
export const MAX_VISIBLE_TROOPS = 96;

const GATE_TEMPLATES = [
  { z: 28, left: [-9, -4], right: [1, 5], shotsPerPoint: 1.5 },
  { z: 67, left: [-16, -9], right: [-2, 4], shotsPerPoint: 2.5 },
  { z: 108, left: [-25, -16], right: [-9, 0], shotsPerPoint: 3.5 },
  { z: 145, left: [-36, -25], right: [-16, -5], shotsPerPoint: 4.5 },
];

export const WAVES = [
  { z: 54, count: 40, speed: 1.9, gateIndex: 0 },
  { z: 94, count: 58, speed: 2.2, gateIndex: 1 },
  { z: 135, count: 78, speed: 2.5, gateIndex: 2 },
  { z: 166, count: 104, speed: 2.8, gateIndex: 3 },
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
      maxValue: 32 + index * 10,
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
