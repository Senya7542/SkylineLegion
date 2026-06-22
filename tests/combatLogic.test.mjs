import test from "node:test";
import assert from "node:assert/strict";
import {
  applyGateBulletHit,
  findBulletCollisionTarget,
  findEnemySplashTargets,
  getBossProjectileSpeed,
  getCombatStageSnapshot,
  getGateRouteSummary,
  getPlayerBulletLife,
  getVolleyShooterPlan,
  stepEnemyCluster,
} from "../src/combatLogic.js";
import { createGates, WAVES } from "../src/gameConfig.js";
import { createEnemy } from "../src/gameSystems.js";

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

test("long-lived bullets do not charge a future gate before it is the current gate", () => {
  const target = findBulletCollisionTarget({
    bullet: { heavy: false, phase: "wave", regionIndex: 0 },
    oldZ: -44,
    nextZ: -50,
    collisionX: 1.62,
    distance: 20,
    laneX: 1.62,
    gates: [{ z: 67, shotsPerPoint: 2, maxValue: 999 }],
    gateStates: [makeGateState()],
    waves: [],
    waveStates: [],
    waveEnemies: [],
    boss: { active: false },
  });

  assert.equal(target, null);
});

test("current gate blocks bullets as soon as its region begins", () => {
  const target = findBulletCollisionTarget({
    bullet: { heavy: false, phase: "gate", regionIndex: 0 },
    oldZ: -24,
    nextZ: -28,
    collisionX: 1.62,
    distance: 41,
    laneX: 1.62,
    gates: [{ z: 67, shotsPerPoint: 2, maxValue: 999 }],
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

test("next area gate blocks bullets as soon as that area begins", () => {
  const target = findBulletCollisionTarget({
    bullet: { heavy: false, phase: "gate", regionIndex: 1 },
    oldZ: -33,
    nextZ: -37,
    collisionX: -1.62,
    distance: 32,
    laneX: 1.62,
    gates: [
      { z: 28, shotsPerPoint: 2, maxValue: 999 },
      { z: 67, shotsPerPoint: 2, maxValue: 999 },
    ],
    gateStates: [{ ...makeGateState(), resolved: true }, makeGateState()],
    waves: [],
    waveStates: [],
    waveEnemies: [],
    boss: { active: false },
  });

  assert.equal(target?.type, "gate");
  assert.equal(target?.gateIndex, 1);
  assert.equal(target?.side, "left");
});

test("volley shooter plan selects only unblocked outer/front shooters", () => {
  const shooters = [
    { index: 1, x: 0, z: 2.0, nextShotAt: 0 },
    { index: 2, x: 0.05, z: 2.45, nextShotAt: 0 },
    { index: 3, x: -0.72, z: 2.75, nextShotAt: 0 },
    { index: 4, x: 0.72, z: 2.75, nextShotAt: 0 },
    { index: 5, x: 0.02, z: 3.05, nextShotAt: 0 },
  ];
  const plan = getVolleyShooterPlan(shooters, 5, false, 1);

  assert.deepEqual(
    plan.map((item) => item.shooter.index),
    [3, 1, 4],
  );
  assert.equal(plan.every((item) => item.power === 1), true);
});

test("volley shooter plan fires the visible upper silhouette across adjacent lanes", () => {
  const shooters = [
    { index: 1, x: -1.08, z: 2.92, nextShotAt: 0 },
    { index: 2, x: -0.84, z: 2.55, nextShotAt: 0 },
    { index: 3, x: -0.6, z: 2.48, nextShotAt: 0 },
    { index: 4, x: -0.36, z: 2.42, nextShotAt: 0 },
    { index: 5, x: -0.12, z: 2.38, nextShotAt: 0 },
    { index: 6, x: 0.12, z: 2.38, nextShotAt: 0 },
    { index: 7, x: 0.36, z: 2.42, nextShotAt: 0 },
    { index: 8, x: 0.6, z: 2.48, nextShotAt: 0 },
    { index: 9, x: 0.84, z: 2.55, nextShotAt: 0 },
    { index: 10, x: 1.08, z: 2.92, nextShotAt: 0 },
    { index: 11, x: 0, z: 3.05, nextShotAt: 0 },
  ];
  const plan = getVolleyShooterPlan(shooters, shooters.length, false, 1);

  assert.deepEqual(
    plan.map((item) => item.shooter.index),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

test("volley shooter plan respects initial shot offset timing", () => {
  const shooters = [
    { index: 1, x: -0.5, z: 2.4, nextShotAt: 0.12 },
    { index: 2, x: 0.5, z: 2.4, nextShotAt: 0.18 },
  ];

  assert.deepEqual(
    getVolleyShooterPlan(shooters, 2, false, 0.1).map((item) => item.shooter.index),
    [],
  );
  assert.deepEqual(
    getVolleyShooterPlan(shooters, 2, false, 0.13).map((item) => item.shooter.index),
    [1],
  );
});

test("normal gate bullet increases the hit side by exactly one", () => {
  const gateState = makeGateState({ rightValue: 15, rightCharge: 0.75 });
  const result = applyGateBulletHit(gateState, "right", {
    heavy: false,
    power: 1,
  });

  assert.equal(gateState.rightValue, 16);
  assert.equal(gateState.rightCharge, 0);
  assert.equal(result.increase, 1);
});

test("gate route summary counts better and worse gate choices", () => {
  const summary = getGateRouteSummary([
    { resolved: true, choice: "right", leftValue: -8, rightValue: 14 },
    { resolved: true, choice: "left", leftValue: -7, rightValue: 15 },
    { resolved: true, choice: "right", leftValue: -42, rightValue: -20 },
    { resolved: false, choice: null, leftValue: -58, rightValue: -18 },
  ]);

  assert.equal(summary.totalResolved, 3);
  assert.equal(summary.betterChoices, 2);
  assert.equal(summary.worseChoices, 1);
  assert.equal(summary.quality, "mixed");
  assert.deepEqual(
    summary.choices.map((choice) => ({
      gateIndex: choice.gateIndex,
      choice: choice.choice,
      pickedValue: choice.pickedValue,
      bestSide: choice.bestSide,
      deltaFromBest: choice.deltaFromBest,
    })),
    [
      { gateIndex: 0, choice: "right", pickedValue: 14, bestSide: "right", deltaFromBest: 0 },
      { gateIndex: 1, choice: "left", pickedValue: -7, bestSide: "right", deltaFromBest: -22 },
      { gateIndex: 2, choice: "right", pickedValue: -20, bestSide: "right", deltaFromBest: 0 },
    ],
  );
});

test("player bullets live long enough to leave the screen instead of popping early", () => {
  assert.equal(getPlayerBulletLife({ phase: "gate", rapid: false, heavy: false }) >= 2.8, true);
  assert.equal(getPlayerBulletLife({ phase: "travel", rapid: true, heavy: false }) >= 2.8, true);
  assert.equal(getPlayerBulletLife({ phase: "boss", rapid: false, heavy: true }) >= 3.4, true);
});

test("final gate keeps choice spread after lifting both sides by thirty", () => {
  const gates = createGates(17);
  const thirdValues = [gates[2].left, gates[2].right].sort((a, b) => a - b);
  const fourthValues = [gates[3].left, gates[3].right].sort((a, b) => a - b);

  assert.equal(thirdValues[0] >= -64 && thirdValues[0] <= -54, true);
  assert.equal(thirdValues[1] >= -16 && thirdValues[1] <= -6, true);
  assert.equal(fourthValues[0] >= -58 && fourthValues[0] <= -40, true);
  assert.equal(fourthValues[1] >= -30 && fourthValues[1] <= -18, true);
});

test("enemy wave pressure increases toward the boss and boss shells travel faster", () => {
  assert.deepEqual(
    WAVES.map((wave) => wave.count),
    [180, 200, 220, 240],
  );
  assert.equal(getBossProjectileSpeed() >= 11, true);
});

test("enemy waves use a round cluster instead of square clamps", () => {
  const wave = { z: 166, count: 240 };
  const enemies = Array.from({ length: wave.count }, (_, index) =>
    createEnemy(wave, 3, index),
  );
  const maxRadius = Math.max(
    ...enemies.map((enemy) => Math.hypot(enemy.homeX, enemy.homeZOffset)),
  );
  const maxX = Math.max(...enemies.map((enemy) => enemy.homeX));
  const minZ = Math.min(...enemies.map((enemy) => enemy.homeZOffset));

  assert.equal(maxRadius <= 3.1, true);
  assert.equal(maxX > 2.05, true);
  assert.equal(minZ < -1.65, true);
});

test("enemy cluster physics does not clamp large round formations into a square", () => {
  const enemy = {
    id: 1,
    alive: true,
    currentX: 2.9,
    zOffset: -1.9,
    homeX: 2.9,
    homeZOffset: -1.9,
  };

  stepEnemyCluster({
    enemies: [enemy],
    waveState: { centerX: 0 },
    delta: 1 / 60,
    targetCenterX: 0,
    alerted: true,
  });

  assert.equal(enemy.currentX > 2.28, true);
  assert.equal(enemy.zOffset < -1.35, true);
});

test("enemy cluster closes center gaps after middle enemies die", () => {
  const enemies = [
    {
      id: 1,
      alive: true,
      currentX: -1.6,
      zOffset: 0,
      homeX: -1.6,
      homeZOffset: 0,
    },
    {
      id: 2,
      alive: false,
      currentX: -0.42,
      zOffset: 0,
      homeX: -0.42,
      homeZOffset: 0,
    },
    {
      id: 3,
      alive: false,
      currentX: 0,
      zOffset: 0,
      homeX: 0,
      homeZOffset: 0,
    },
    {
      id: 4,
      alive: false,
      currentX: 0.42,
      zOffset: 0,
      homeX: 0.42,
      homeZOffset: 0,
    },
    {
      id: 5,
      alive: true,
      currentX: 1.6,
      zOffset: 0,
      homeX: 1.6,
      homeZOffset: 0,
    },
  ];
  const waveState = { centerX: 0 };

  for (let frame = 0; frame < 80; frame += 1) {
    stepEnemyCluster({
      enemies,
      waveState,
      delta: 1 / 60,
      targetCenterX: 0,
      alerted: true,
    });
  }

  assert.equal(enemies[0].currentX > -1.2, true);
  assert.equal(enemies[4].currentX < 1.2, true);
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

test("enemy cluster physics separates overlapping alive enemies", () => {
  const enemies = [
    {
      id: 1,
      alive: true,
      currentX: 0,
      zOffset: 0,
      homeX: 0,
      homeZOffset: 0,
    },
    {
      id: 2,
      alive: true,
      currentX: 0.02,
      zOffset: 0.01,
      homeX: 0.02,
      homeZOffset: 0.01,
    },
  ];

  stepEnemyCluster({
    enemies,
    waveState: { centerX: 0 },
    delta: 1 / 60,
    targetCenterX: 0,
    alerted: true,
  });

  const distance = Math.hypot(
    enemies[0].currentX - enemies[1].currentX,
    enemies[0].zOffset - enemies[1].zOffset,
  );
  assert.equal(distance >= 0.38, true);
});
