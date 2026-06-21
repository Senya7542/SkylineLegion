const clampLocal = (value, min, max) => Math.max(min, Math.min(max, value));

const NORMAL_VISUAL_POWER = 0.012;
const RAPID_VISUAL_POWER = 0.018;

export function getVolleyShooterPlan(activeShooters, troopCount, rapid) {
  if (!activeShooters.length || troopCount <= 0) return [];
  const sorted = [...activeShooters].sort((a, b) => a.x - b.x);
  const damageCount = clampLocal(
    1 + Math.floor((troopCount - 1) / 12),
    1,
    rapid ? 16 : 12,
  );
  const damagingSlots = new Set(
    Array.from(
      { length: Math.min(damageCount, sorted.length) },
      (_, index) =>
        Math.round((index / Math.max(1, damageCount - 1)) * (sorted.length - 1)),
    ),
  );

  return sorted.map((shooter, index) => ({
    shooter,
    power: damagingSlots.has(index)
      ? 1
      : rapid
        ? RAPID_VISUAL_POWER
        : NORMAL_VISUAL_POWER,
  }));
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
