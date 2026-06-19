import { clamp, MAX_VISIBLE_TROOPS } from "./gameConfig.js";

export function formationSlot(index, count) {
  const visibleCount = Math.min(count, MAX_VISIBLE_TROOPS);
  const normalized = (index + 0.5) / Math.max(1, visibleCount);
  const angle = index * 2.399963229728653;
  const radius = Math.sqrt(normalized) * Math.min(1.46, 0.48 + visibleCount * 0.014);

  return {
    x: Math.cos(angle) * radius,
    z: 3.0 + Math.sin(angle) * radius * 0.62,
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
    hitUntil: -10,
    deathAt: -10,
    dying: false,
    deathVx: 0,
    deathVz: 0,
  };
}

export function updateArmyUnits(units, count, time, delta) {
  const visibleCount = Math.min(count, MAX_VISIBLE_TROOPS);
  const stiffness = 18;
  const damping = Math.exp(-7.2 * delta);

  units.forEach((unit, index) => {
    if (unit.dying) {
      const age = time - unit.deathAt;
      if (age > 0.72) {
        unit.dying = false;
        unit.active = false;
        unit.scale = 0;
        return;
      }
      unit.x = clamp(unit.x + unit.deathVx * delta, -1.52, 1.52);
      unit.z = clamp(unit.z + unit.deathVz * delta, 1.55, 4.02);
      unit.scale = Math.max(0.04, 1 - age / 0.72);
      return;
    }

    const shouldBeActive = index < visibleCount;
    if (shouldBeActive && !unit.active) {
      unit.active = true;
      unit.dying = false;
      unit.x = 0;
      unit.z = 3.0;
      unit.vx = 0;
      unit.vz = 0;
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

    // The center-spawned crowd separates into a bounded, springy cluster.
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = units[otherIndex];
      if (!other.active || other.dying || time < other.spawnAt) continue;
      const dx = unit.x - other.x;
      const dz = unit.z - other.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < 0.118) {
        const distance = Math.max(0.025, Math.sqrt(distanceSq));
        const nx = distanceSq < 0.0006 ? Math.cos(index * 2.17) : dx / distance;
        const nz = distanceSq < 0.0006 ? Math.sin(index * 2.17) : dz / distance;
        const force = (0.345 - distance) * 12 * delta;
        unit.vx += nx * force;
        unit.vz += nz * force;
        other.vx -= nx * force * 0.72;
        other.vz -= nz * force * 0.72;
      }
    }

    unit.vx *= damping;
    unit.vz *= damping;
    unit.x = clamp(unit.x + unit.vx * delta, -1.5, 1.5);
    unit.z = clamp(unit.z + unit.vz * delta, 1.58, 3.98);

    const age = time - unit.spawnAt;
    const overshoot =
      age < 0.2
        ? 1.22 * Math.sin((age / 0.2) * Math.PI * 0.5)
        : 1 + Math.sin(Math.min(1, (age - 0.2) / 0.28) * Math.PI) * 0.16;
    unit.scale = clamp(overshoot, 0.02, 1.22);
  });
}

export function killArmyUnits(units, losses, time) {
  const victims = units
    .filter((unit) => unit.active && !unit.dying)
    .sort((a, b) => b.index - a.index)
    .slice(0, losses);

  victims.forEach((unit, victimIndex) => {
    unit.dying = true;
    unit.deathAt = time + victimIndex * 0.018;
    unit.hitUntil = unit.deathAt + 0.16;
    unit.deathVx = (unit.x >= 0 ? 1 : -1) * (0.8 + (victimIndex % 3) * 0.2);
    unit.deathVz = 0.45 + (victimIndex % 4) * 0.09;
  });
}

export function chooseEnemyTarget(waves, waveStates, shooterX, distance) {
  let best = null;
  let bestScore = Infinity;

  waves.forEach((enemies, waveIndex) => {
    if (!waveStates[waveIndex]?.unlocked) return;
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
  const columns = 10;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const x = (col - (columns - 1) / 2) * 0.43 + (row % 2 ? 0.21 : 0);
  return {
    id: waveIndex * 100 + index,
    waveZ: wave.z,
    x,
    currentX: x,
    zOffset: row * 0.46,
    hp: 2 + Math.floor(waveIndex / 2),
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
