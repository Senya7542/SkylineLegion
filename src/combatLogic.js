const clampLocal = (value, min, max) => Math.max(min, Math.min(max, value));

const SHOOTER_LANE_WIDTH = 0.25;
const SHOOTER_LANE_OFFSET = 4;
const PLAYER_BULLET_LIFE = 3.05;
const PLAYER_HEAVY_BULLET_LIFE = 3.6;
const BOSS_PROJECTILE_SPEED = 11.4;
const ENEMY_CLUSTER_RADIUS = 0.38;

const dampLocal = (current, target, smoothing, delta) =>
  current + (target - current) * (1 - Math.exp(-smoothing * delta));

export function getInitialShotOffset(index) {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 0.2;
}

export function getPlayerBulletLife({ heavy = false } = {}) {
  return heavy ? PLAYER_HEAVY_BULLET_LIFE : PLAYER_BULLET_LIFE;
}

export function getBossProjectileSpeed() {
  return BOSS_PROJECTILE_SPEED;
}

export function isShooterUnblocked(shooter, shooters) {
  const lane = getShooterLane(shooter);
  return shooters.every((other) => {
    if (other === shooter) return true;
    if (other.active === false || other.dying || (other.scale ?? 1) < 0.72) return true;
    return getShooterLane(other) !== lane || other.z >= shooter.z;
  });
}

const getShooterLane = (shooter) =>
  Math.floor(((shooter.x ?? 0) + SHOOTER_LANE_OFFSET) / SHOOTER_LANE_WIDTH);

export function getVolleyShooterPlan(activeShooters, troopCount, rapid, time = 0) {
  if (!activeShooters.length || troopCount <= 0) return [];
  const sorted = [...activeShooters].sort((a, b) => a.x - b.x || a.z - b.z);
  const laneFront = new Map();
  sorted.forEach((shooter) => {
    const lane = getShooterLane(shooter);
    const current = laneFront.get(lane);
    if (!current || shooter.z < current.z) laneFront.set(lane, shooter);
  });

  return sorted.filter((shooter) =>
    laneFront.get(getShooterLane(shooter)) === shooter &&
    (shooter.nextShotAt ?? 0) <= time,
  ).map((shooter) => ({
    shooter,
    power: 1,
  }));
}

export function applyGateBulletHit(gateState, side, bullet) {
  const valueKey = `${side}Value`;
  const chargeKey = `${side}Charge`;
  const increase = bullet.heavy ? 2 : 1;
  gateState[valueKey] = clampLocal(
    gateState[valueKey] + increase,
    -99,
    bullet.maxValue ?? 999,
  );
  gateState[chargeKey] = 0;
  return { increase, value: gateState[valueKey] };
}

export function getGateRouteSummary(gateStates = []) {
  const choices = gateStates
    .map((gateState, index) => {
      if (!gateState?.resolved || !gateState.choice) return null;
      const leftValue = gateState.leftValue ?? 0;
      const rightValue = gateState.rightValue ?? 0;
      const choice = gateState.choice;
      const pickedValue = choice === "left" ? leftValue : rightValue;
      const otherValue = choice === "left" ? rightValue : leftValue;
      const bestSide = leftValue >= rightValue ? "left" : "right";
      const bestValue = Math.max(leftValue, rightValue);
      return {
        gateIndex: index,
        choice,
        pickedValue,
        otherValue,
        bestSide,
        bestValue,
        isBetterChoice: choice === bestSide,
        deltaFromBest: pickedValue - bestValue,
      };
    })
    .filter(Boolean);
  const betterChoices = choices.filter((choice) => choice.isBetterChoice).length;
  const worseChoices = choices.length - betterChoices;
  const quality =
    choices.length === 0
      ? "none"
      : worseChoices === 0
        ? "perfect"
        : betterChoices === 0
          ? "bad"
          : "mixed";
  return {
    choices,
    totalResolved: choices.length,
    betterChoices,
    worseChoices,
    quality,
  };
}

export function stepEnemyCluster({
  enemies,
  waveState,
  delta,
  targetCenterX = 0,
  alerted = false,
}) {
  const centerTarget = alerted ? clampLocal(targetCenterX, -0.72, 0.72) : 0;
  waveState.centerX = dampLocal(waveState.centerX ?? 0, centerTarget, alerted ? 2.8 : 4.4, delta);
  const alive = enemies.filter((enemy) => enemy.alive);
  const aliveHomeCenterX = alive.length
    ? alive.reduce((sum, enemy) => sum + (enemy.homeX ?? enemy.x ?? enemy.currentX ?? 0), 0) / alive.length
    : 0;
  const aliveHomeCenterZ = alive.length
    ? alive.reduce((sum, enemy) => sum + (enemy.homeZOffset ?? enemy.zOffset ?? 0), 0) / alive.length
    : 0;
  const formationScale = clampLocal(
    Math.sqrt(alive.length / Math.max(1, enemies.length)),
    0.42,
    1,
  );

  alive.forEach((enemy) => {
    const homeX = enemy.homeX ?? enemy.x ?? enemy.currentX ?? 0;
    const homeZOffset = enemy.homeZOffset ?? enemy.zOffset ?? 0;
    const targetX = (waveState.centerX ?? 0) + (homeX - aliveHomeCenterX) * formationScale;
    const targetZOffset = (homeZOffset - aliveHomeCenterZ) * formationScale;
    enemy.localVx = (enemy.localVx ?? 0) + (targetX - (enemy.currentX ?? homeX)) * 10.5 * delta;
    enemy.localVz = (enemy.localVz ?? 0) + (targetZOffset - enemy.zOffset) * 9.2 * delta;
    enemy.localVx *= Math.exp(-5.7 * delta);
    enemy.localVz *= Math.exp(-5.4 * delta);
    enemy.currentX = (enemy.currentX ?? homeX) + enemy.localVx * delta;
    enemy.zOffset += enemy.localVz * delta;
  });

  const separationIterations = alive.length > 360 ? 2 : alive.length > 220 ? 3 : 5;
  for (let iteration = 0; iteration < separationIterations; iteration += 1) {
    for (let index = 0; index < alive.length; index += 1) {
      const enemy = alive[index];
      for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
        const other = alive[otherIndex];
        let dx = enemy.currentX - other.currentX;
        let dz = enemy.zOffset - other.zOffset;
        let distanceSq = dx * dx + dz * dz;
        if (distanceSq >= ENEMY_CLUSTER_RADIUS * ENEMY_CLUSTER_RADIUS) continue;
        if (distanceSq < 0.0001) {
          const angle = ((enemy.id ?? index) * 2.399 + iteration * 0.73) % (Math.PI * 2);
          dx = Math.cos(angle) * 0.02;
          dz = Math.sin(angle) * 0.02;
          distanceSq = dx * dx + dz * dz;
        }
        const distance = Math.sqrt(distanceSq);
        const push = (ENEMY_CLUSTER_RADIUS - distance) * 0.52;
        const nx = dx / distance;
        const nz = dz / distance;
        enemy.currentX += nx * push;
        enemy.zOffset += nz * push;
        other.currentX -= nx * push;
        other.zOffset -= nz * push;
      }
    }
  }

}

export function getCombatStageSnapshot({
  distance,
  trackEnd,
  gates,
  gateStates,
  waves,
  waveStates,
  waveEnemies,
}) {
  if (typeof trackEnd === "number" && distance >= trackEnd) {
    return { regionIndex: waves.length, phase: "boss" };
  }

  const nextGateIndex = gates.findIndex(
    (_, index) => !gateStates[index]?.resolved,
  );
  if (nextGateIndex >= 0) {
    const gateDistance = gates[nextGateIndex].z - distance;
    if (gateDistance <= 27 + nextGateIndex * 9) {
      return { regionIndex: nextGateIndex, phase: "gate" };
    }
  }

  for (let index = waves.length - 1; index >= 0; index -= 1) {
    if (!waveStates[index]?.unlocked) continue;
    if (!waveEnemies[index]?.some((enemy) => enemy.alive)) continue;
    const waveDistance = distance - waves[index].z;
    if (waveDistance < -34) continue;
    return { regionIndex: index, phase: "wave" };
  }

  if (nextGateIndex >= 0) {
    return { regionIndex: nextGateIndex, phase: "travel" };
  }
  return { regionIndex: waves.length, phase: "boss" };
}

const isBetweenSweep = (z, oldZ, nextZ, tolerance) =>
  z <= oldZ + tolerance && z >= nextZ - tolerance;

export function findEnemySplashTargets({
  waveEnemies,
  waveStates,
  distance,
  centerX,
  centerZ,
  radius,
}) {
  const victims = [];
  waveEnemies.forEach((enemies, waveIndex) => {
    const waveState = waveStates[waveIndex];
    if (!waveState?.unlocked) return;
    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const z =
        distance -
        enemy.waveZ -
        enemy.zOffset +
        (waveState.advance || 0);
      const dx = (enemy.currentX ?? enemy.x) - centerX;
      const dz = z - centerZ;
      const distanceToImpact = Math.hypot(dx, dz);
      if (distanceToImpact > radius) return;
      victims.push({
        enemy,
        waveIndex,
        z,
        distance: distanceToImpact,
        dx,
        dz,
      });
    });
  });
  return victims.sort((a, b) => a.distance - b.distance);
}

export function findBulletCollisionTarget({
  bullet,
  oldZ,
  nextZ,
  collisionX,
  distance,
  laneX,
  gates,
  gateStates,
  waves,
  waveStates,
  waveEnemies,
  boss,
}) {
  let target = null;
  let targetZ = -Infinity;
  const nextGateIndex = gateStates.findIndex((gateState) => !gateState?.resolved);

  gates.forEach((gate, gateIndex) => {
    if (gateIndex !== nextGateIndex) return;
    const gateState = gateStates[gateIndex];
    if (!gateState || gateState.resolved) return;
    const gateDistance = gate.z - distance;
    if (gateDistance > 27 + gateIndex * 9) return;
    const z = distance - gate.z;
    const side = collisionX < 0 ? "left" : "right";
    const laneCenter = side === "left" ? -laneX : laneX;
    if (
      isBetweenSweep(z, oldZ, nextZ, 0.12) &&
      Math.abs(collisionX - laneCenter) <= 1.18 &&
      z > targetZ
    ) {
      target = { type: "gate", gateIndex, side, z };
      targetZ = z;
    }
  });

  waveEnemies.forEach((enemies, waveIndex) => {
    const waveState = waveStates[waveIndex];
    if (!waveState?.unlocked) return;
    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const z =
        distance -
        (enemy.waveZ ?? waves[waveIndex]?.z ?? 0) -
        enemy.zOffset +
        (waveState.advance || 0);
      const hitRadius = bullet.heavy ? 0.72 : 0.42;
      const zTolerance = bullet.heavy ? 0.38 : 0.24;
      if (
        isBetweenSweep(z, oldZ, nextZ, zTolerance) &&
        Math.abs(collisionX - (enemy.currentX ?? enemy.x)) <= hitRadius &&
        z > targetZ
      ) {
        target = { type: "enemy", waveIndex, enemy, z };
        targetZ = z;
      }
    });
  });

  if (boss?.active && boss.health > 0) {
    const z = boss.z;
    if (
      isBetweenSweep(z, oldZ, nextZ, 0.35) &&
      Math.abs(collisionX) <= 2.15 &&
      z > targetZ
    ) {
      target = { type: "boss", z };
    }
  }

  return target;
}
