import { clamp, MAX_VISIBLE_TROOPS } from "./gameConfig.js";

export function formationSlot(index, count) {
  const visibleCount = Math.min(count, MAX_VISIBLE_TROOPS);
  const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(visibleCount * 1.25))));
  const row = Math.floor(index / columns);
  const col = index % columns;
  const rowCount = Math.min(columns, visibleCount - row * columns);
  const centeredCol = col - (rowCount - 1) / 2;

  return {
    x: centeredCol * 0.285 + (row % 2 ? 0.14 : 0),
    z: 3.02 - row * 0.38,
  };
}

export function createArmyUnit(index) {
  return {
    index,
    active: false,
    x: 0,
    z: 3.1,
    vx: 0,
    vz: 0,
    scale: 0,
    spawnAt: -10,
    glowUntil: -10,
  };
}

export function updateArmyUnits(units, count, time, delta) {
  const visibleCount = Math.min(count, MAX_VISIBLE_TROOPS);
  const stiffness = 25;
  const damping = Math.exp(-9 * delta);

  units.forEach((unit, index) => {
    const shouldBeActive = index < visibleCount;
    if (shouldBeActive && !unit.active) {
      unit.active = true;
      unit.x = (index % 2 ? -1 : 1) * Math.min(0.42, index * 0.018);
      unit.z = 3.2 + Math.min(0.7, Math.floor(index / 8) * 0.04);
      unit.vx = (index % 2 ? -1 : 1) * (0.6 + (index % 5) * 0.08);
      unit.vz = 0.25;
      unit.scale = 0.02;
      unit.spawnAt = time + Math.floor(index / 5) * 0.018;
      unit.glowUntil = unit.spawnAt + 0.72;
    } else if (!shouldBeActive) {
      unit.active = false;
      unit.scale = 0;
      return;
    }

    if (time < unit.spawnAt) {
      unit.scale = 0.02;
      return;
    }

    const target = formationSlot(index, visibleCount);
    unit.vx += (target.x - unit.x) * stiffness * delta;
    unit.vz += (target.z - unit.z) * stiffness * delta;

    // A cheap crowd-separation pass gives the formation a soft, physical squeeze.
    for (let otherIndex = Math.max(0, index - 10); otherIndex < index; otherIndex += 1) {
      const other = units[otherIndex];
      if (!other.active || time < other.spawnAt) continue;
      const dx = unit.x - other.x;
      const dz = unit.z - other.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > 0.0001 && distanceSq < 0.105) {
        const distance = Math.sqrt(distanceSq);
        const force = (0.325 - distance) * 9 * delta;
        unit.vx += (dx / distance) * force;
        unit.vz += (dz / distance) * force;
        other.vx -= (dx / distance) * force * 0.45;
        other.vz -= (dz / distance) * force * 0.45;
      }
    }

    unit.vx *= damping;
    unit.vz *= damping;
    unit.x += unit.vx * delta;
    unit.z += unit.vz * delta;

    const age = time - unit.spawnAt;
    const overshoot =
      age < 0.2
        ? 1.22 * Math.sin((age / 0.2) * Math.PI * 0.5)
        : 1 + Math.sin(Math.min(1, (age - 0.2) / 0.28) * Math.PI) * 0.16;
    unit.scale = clamp(overshoot, 0.02, 1.22);
  });
}

export function chooseEnemyTarget(waves, waveStates, shooterX, distance) {
  let best = null;
  let bestScore = Infinity;

  waves.forEach((enemies, waveIndex) => {
    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const z =
        distance -
        enemy.waveZ -
        enemy.zOffset +
        (waveStates[waveIndex]?.advance || 0);
      if (z > 3.2 || z < -48) return;
      const x = enemy.currentX ?? enemy.x;
      const score = Math.abs(x - shooterX) * 2.2 + Math.abs(z) * 0.035;
      if (score < bestScore) {
        bestScore = score;
        best = { x, z };
      }
    });
  });

  return best;
}

export function createEnemy(wave, waveIndex, index) {
  const columns = 8;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const x = (col - (columns - 1) / 2) * 0.52 + (row % 2 ? 0.25 : 0);
  return {
    id: waveIndex * 100 + index,
    waveZ: wave.z,
    x,
    currentX: x,
    zOffset: row * 0.46,
    hp: waveIndex >= 2 ? 2 : 1,
    alive: true,
    hitAt: -10,
    deathAt: -10,
    vx: 0,
    vy: 0,
    vz: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
  };
}
