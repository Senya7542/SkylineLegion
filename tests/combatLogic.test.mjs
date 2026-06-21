import test from "node:test";
import assert from "node:assert/strict";
import {
  findBulletCollisionTarget,
  findEnemySplashTargets,
  getCombatStageSnapshot,
  getVolleyShooterPlan,
} from "../src/combatLogic.js";

const makeGateState = (overrides = {}) => ({
  leftValue: 10,
  rightValue: -5,
  leftCharge: 0,
  rightCharge: 0,
  resolved: false,
  ...overrides,
});

test("stale bullet region still hits the physically intersected unlocked enemy", () => {
  const target = findBulletCollisionTarget({
    bullet: { heavy: false, phase: "wave", regionIndex: 0 },
    oldZ: 3.1,
    nextZ: 2.2,
    collisionX: 0.1,
    distance: 100,
    laneX: 1.62,
    gates: [],
    gateStates: [],
    waves: [{ z: 54 }, { z: 94 }, { z: 135 }],
    waveStates: [
      { unlocked: true, advance: 0 },
      { unlocked: true, advance: 0 },
      { unlocked: true, advance: 0 },
    ],
    waveEnemies: [
      [],
      [{ id: 101, alive: true, currentX: 0.12, waveZ: 94, zOffset: 3.2 }],
      [],
    ],
    boss: { active: false },
  });

  assert.equal(target?.type, "enemy");
  assert.equal(target?.waveIndex, 1);
  assert.equal(target?.enemy.id, 101);
});

test("unresolved gate blocks bullets by physical intersection regardless of stale phase", () => {
  const target = findBulletCollisionTarget({
    bullet: { heavy: false, phase: "wave", regionIndex: 0 },
    oldZ: 3.1,
    nextZ: 2.2,
    collisionX: 1.62,
    distance: 110.4,
    laneX: 1.62,
    gates: [{ z: 108, shotsPerPoint: 3, maxValue: 999 }],
    gateStates: [makeGateState()],
    waves: [],
    waveStates: [],
    waveEnemies: [],
    boss: { active: false },
  });

  assert.equal(target?.type, "gate");
  assert.equal(target?.gateIndex, 0);
  assert.equal(target?.side, "right");
});

test("volley shooter plan keeps a visual projectile for every visible shooter", () => {
  const shooters = Array.from({ length: 37 }, (_, index) => ({ index }));
  const plan = getVolleyShooterPlan(shooters, 37, false);

  assert.equal(plan.length, 37);
  assert.equal(plan.filter((item) => item.power >= 1).length, 4);
  assert.equal(plan.filter((item) => item.power > 0 && item.power < 1).length, 33);
});

test("heavy player shells collect all enemies inside an impact radius", () => {
  const victims = findEnemySplashTargets({
    waveEnemies: [
      [
        { id: 1, alive: true, currentX: 0, waveZ: 54, zOffset: 0 },
        { id: 2, alive: true, currentX: 0.42, waveZ: 54, zOffset: 0.2 },
        { id: 3, alive: true, currentX: 1.5, waveZ: 54, zOffset: 0.2 },
      ],
    ],
    waveStates: [{ unlocked: true, advance: 0 }],
    distance: 56.1,
    centerX: 0.05,
    centerZ: 2.1,
    radius: 0.78,
  });

  assert.deepEqual(
    victims.map((entry) => entry.enemy.id),
    [1, 2],
  );
});

test("combat stage follows the highest active current wave instead of old stragglers", () => {
  const stage = getCombatStageSnapshot({
    distance: 151,
    gates: [{ z: 28 }, { z: 67 }, { z: 108 }, { z: 145 }],
    gateStates: [
      { resolved: true },
      { resolved: true },
      { resolved: true },
      { resolved: true },
    ],
    waves: [{ z: 54 }, { z: 94 }, { z: 135 }, { z: 166 }],
    waveStates: [
      { unlocked: true },
      { unlocked: true },
      { unlocked: true },
      { unlocked: true },
    ],
    waveEnemies: [
      [{ alive: true }],
      [],
      [],
      [{ alive: true }],
    ],
  });

  assert.deepEqual(stage, { regionIndex: 3, phase: "wave" });
});

test("combat stage reports boss after track end even when a wave has stragglers", () => {
  const stage = getCombatStageSnapshot({
    distance: 170,
    trackEnd: 170,
    gates: [{ z: 28 }],
    gateStates: [{ resolved: true }],
    waves: [{ z: 54 }],
    waveStates: [{ unlocked: true }],
    waveEnemies: [[{ alive: true }]],
  });

  assert.deepEqual(stage, { regionIndex: 1, phase: "boss" });
});
