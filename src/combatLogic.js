const clampLocal = (value, min, max) => Math.max(min, Math.min(max, value));

const SHOOTER_BLOCK_X = 0.34;
const SHOOTER_BLOCK_Z = 0.18;
const ENEMY_CLUSTER_RADIUS = 0.38;
const ENEMY_CLUSTER_LIMIT_X = 2.28;
const ENEMY_CLUSTER_MIN_Z_OFFSET = -1.35;
const ENEMY_CLUSTER_MAX_Z_OFFSET = 4.4;

const dampLocal = (current, target, smoothing, delta) =>
  current + (target - current) * (1 - Math.exp(-smoothing * delta));

export function getInitialShotOffset(index) {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 0.2;
}

export function isShooterUnblocked(shooter, shooters) {
  return !shooters.some((other) => {
    if (other === shooter) return false;
    if (other.active === false || other.dying || (other.scale ?? 1) < 0.72) return false;
    const ahead = other.z < shooter.z - SHOOTER_BLOCK_Z;
    return ahead && Math.abs(other.x - shooter.x) <= SHOOTER_BLOCK_X;
  });
}

export function getVolleyShooterPlan(activeShooters, troopCount, rapid, time = 0) {
  if (!activeShooters.length || troopCount <= 0) return [];
  const sorted = [...activeShooters].sort((a, b) => a.x - b.x || a.z - b.z);
  return sorted.filter((shooter) =>
    isShooterUnblocked(shooter, sorted) &&
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

  alive.forEach((enemy) => {
    const homeX = enemy.homeX ?? enemy.x ?? enemy.currentX ?? 0;
    const homeZOffset = enemy.homeZOffset ?? enemy.zOffset ?? 0;
    const targetX = (waveState.centerX ?? 0) + homeX;
    const targetZOffset = homeZOffset;
    enemy.localVx = (enemy.localVx ?? 0) + (targetX - (enemy.currentX ?? homeX)) * 10.5 * delta;
    enemy.localVz = (enemy.localVz ?? 0) + (targetZOffset - enemy.zOffset) * 9.2 * delta;
    enemy.localVx *= Math.exp(-5.7 * delta);
    enemy.localVz *= Math.exp(-5.4 * delta);
    enemy.currentX = (enemy.currentX ?? homeX) + enemy.localVx * delta;
    enemy.zOffset += enemy.localVz * delta;
  });

  for (let iteration = 0; iteration < 5; iteration += 1) {
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

  alive.forEach((enemy) => {
    enemy.currentX = clampLocal(enemy.currentX, -ENEMY_CLUSTER_LIMIT_X, ENEMY_CLUSTER_LIMIT_X);
    enemy.zOffset = clampLocal(
      enemy.zOffset,
      ENEMY_CLUSTER_MIN_Z_OFFSET,
      ENEMY_CLUSTER_MAX_Z_OFFSET,
    );
  });
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

  gates.forEach((gate, gateIndex) => {
    const gateState = gateStates[gateIndex];
    if (!gateState || gateState.resolved) return;
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
