export const TRACK_END = 170;
export const BOSS_Z = 179;
export const PLAYER_LIMIT = 1.34;
export const LANE_X = 1.62;
export const PLAYER_GATE_CONTACT_Z = 2.35;
export const MAX_BULLETS = 128;
export const MAX_IMPACTS = 40;
export const MAX_VISIBLE_TROOPS = 128;
export const STARTING_TROOPS = 1;
export const GATE_VALUE_CAP = 999;

const GATE_TEMPLATES = [
  { z: 28, penalty: [-8, -4], reward: [8, 12], shotsPerPoint: 2 },
  { z: 67, penalty: [-9, -5], reward: [12, 18], shotsPerPoint: 2 },
  { z: 108, penalty: [-24, -14], reward: [24, 34], shotsPerPoint: 3 },
  { z: 145, penalty: [-48, -30], reward: [-20, -8], shotsPerPoint: 4 },
];

export const WAVES = [
  { z: 54, count: 40, speed: 2.05, gateIndex: 0 },
  { z: 94, count: 60, speed: 2.32, gateIndex: 1 },
  { z: 135, count: 86, speed: 2.62, gateIndex: 2 },
  { z: 166, count: 96, speed: 2.88, gateIndex: 3 },
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
    const penalty = pickRange(random, template.penalty);
    const reward = pickRange(random, template.reward);
    const rewardOnLeft = random() > 0.5;
    const left = rewardOnLeft ? reward : penalty;
    const right = rewardOnLeft ? penalty : reward;

    return {
      z: template.z,
      shotsPerPoint: template.shotsPerPoint,
      maxValue: GATE_VALUE_CAP,
      left,
      right,
      rewardOnLeft,
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
