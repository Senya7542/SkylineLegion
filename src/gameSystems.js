import { clamp, MAX_VISIBLE_TROOPS } from "./gameConfig.js";
import { getInitialShotOffset } from "./combatLogic.js";

const PLAYER_CENTER_Z = 3.05;
const PLAYER_RADIUS = 0.205;
const AIRCRAFT_X_RADIUS = 0.56;
const AIRCRAFT_Z_MIN = 3.18;
const AIRCRAFT_Z_MAX = 4.28;

const easeOutBack = (value) => {
  const t = clamp(value, 0, 1) - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
};

export function createArmyUnit(index) {
  return {
    index,
    active: false,
    x: 0,
    y: 0,
    z: PLAYER_CENTER_Z,
    vx: 0,
    vy: 0,
    vz: 0,
    scale: 0,
    spawnAt: -10,
    glowAt: -10,
    hitAt: -10,
    deathAt: -10,
    dying: false,
    rotation: 0,
    spin: 0,
    shotOffset: getInitialShotOffset(index),
    nextShotAt: 0,
  };
}

function pushOutOfAircraft(unit) {
  if (unit.z < AIRCRAFT_Z_MIN || unit.z > AIRCRAFT_Z_MAX) return;
  const normalizedZ =
    (unit.z - AIRCRAFT_Z_MIN) / (AIRCRAFT_Z_MAX - AIRCRAFT_Z_MIN);
  const halfWidth = AIRCRAFT_X_RADIUS * (0.72 + Math.sin(normalizedZ * Math.PI) * 0.45);
  if (Math.abs(unit.x) >= halfWidth) return;
  const side = unit.x === 0 ? (unit.index % 2 ? -1 : 1) : Math.sign(unit.x);
  const correction = halfWidth - Math.abs(unit.x) + 0.035;
  unit.x += side * correction;
  unit.vx += side * correction * 12;
}

function solvePairCollisions(units, time) {
  for (let iteration = 0; iteration < 5; iteration += 1) {
    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index];
      if (!unit.active || unit.dying || time < unit.spawnAt) continue;
      const radius = PLAYER_RADIUS * clamp(unit.scale, 0.28, 1);

      for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
        const other = units[otherIndex];
        if (!other.active || other.dying || time < other.spawnAt) continue;
        const otherRadius = PLAYER_RADIUS * clamp(other.scale, 0.28, 1);
        let dx = unit.x - other.x;
        let dz = unit.z - other.z;
        let distanceSq = dx * dx + dz * dz;
        const minimum = radius + otherRadius;
        if (distanceSq >= minimum * minimum) continue;

        if (distanceSq < 0.00001) {
          const angle = (unit.index * 2.399 + iteration * 0.71) % (Math.PI * 2);
          dx = Math.cos(angle) * 0.01;
          dz = Math.sin(angle) * 0.01;
          distanceSq = dx * dx + dz * dz;
        }

        const distance = Math.sqrt(distanceSq);
        const overlap = minimum - distance;
        const nx = dx / distance;
        const nz = dz / distance;
        const correction = overlap * 0.51;
        unit.x += nx * correction;
        unit.z += nz * correction;
        other.x -= nx * correction;
        other.z -= nz * correction;

        const relativeVelocity = (unit.vx - other.vx) * nx + (unit.vz - other.vz) * nz;
        if (relativeVelocity < 0) {
          const impulse = -relativeVelocity * 0.62;
          unit.vx += nx * impulse;
          unit.vz += nz * impulse;
          other.vx -= nx * impulse;
          other.vz -= nz * impulse;
        }
      }

      pushOutOfAircraft(unit);
    }
  }
  units.forEach((unit) => {
    if (!unit.active || unit.dying) return;
    pushOutOfAircraft(unit);
    unit.y = 0;
  });
}

export function updateArmyUnits(units, count, time, delta) {
  const visibleCount = Math.min(count, MAX_VISIBLE_TROOPS);
  const livingUnits = units.filter((unit) => unit.active && !unit.dying);
  const missing = Math.max(0, visibleCount - livingUnits.length);
  if (missing > 0) {
    units
      .filter((unit) => !unit.active)
      .slice(0, missing)
      .forEach((unit) => {
        const angle = unit.index * 2.3999632297;
        unit.active = true;
        unit.dying = false;
        unit.x = Math.cos(angle) * 0.025;
        unit.y = 0;
        unit.z = PLAYER_CENTER_Z + Math.sin(angle) * 0.025;
        unit.vx = Math.cos(angle) * 0.42;
        unit.vy = 0;
        unit.vz = Math.sin(angle) * 0.32;
        unit.scale = 0.05;
        unit.spawnAt = time;
        unit.glowAt = time;
        unit.hitAt = -10;
        unit.rotation = 0;
        unit.spin = 0;
        unit.shotOffset = getInitialShotOffset(unit.index);
        unit.nextShotAt = time + unit.shotOffset;
      });
  }
  const activeUnits = units.filter((unit) => unit.active && !unit.dying);

  units.forEach((unit) => {
    if (unit.dying) {
      const age = time - unit.deathAt;
      if (age > 1.8) {
        unit.dying = false;
        unit.active = false;
        unit.scale = 0;
        return;
      }
      unit.vy -= 5.8 * delta;
      unit.x += unit.vx * delta;
      unit.y += unit.vy * delta;
      unit.z += unit.vz * delta;
      unit.rotation += unit.spin * delta;
      unit.scale =
        age < 1.02 ? 1 : Math.max(0.04, 1 - (age - 1.02) / 0.78);
      return;
    }

    if (!unit.active) return;

    const spawnAge = time - unit.spawnAt;
    unit.scale = clamp(easeOutBack(spawnAge / 0.34), 0.05, 1.18);

    const crowdScale = clamp(Math.sqrt(Math.max(1, visibleCount)) / 9, 0.58, 1.14);
    const centerX = 0;
    const centerZ = PLAYER_CENTER_Z - crowdScale * 0.08;
    const dx = centerX - unit.x;
    const dz = centerZ - unit.z;
    unit.vx += dx * 3.7 * delta;
    unit.vz += dz * 3.3 * delta;
    unit.vx *= Math.exp(-3.8 * delta);
    unit.vz *= Math.exp(-3.8 * delta);
    unit.x += unit.vx * delta;
    unit.z += unit.vz * delta;
    unit.y = 0;
  });

  solvePairCollisions(activeUnits, time);
  if (activeUnits.length > 0) {
    const centerX =
      activeUnits.reduce((sum, unit) => sum + unit.x, 0) / activeUnits.length;
    activeUnits.forEach((unit) => {
      unit.vx -= centerX * 0.42;
      unit.x -= centerX * 0.016;
    });
  }
}

export function killArmyUnit(unit, time, impulseX = 0, impulseZ = 0.8) {
  if (!unit || !unit.active || unit.dying) return false;
  unit.dying = true;
  unit.deathAt = time;
  unit.hitAt = time;
  unit.vx = (impulseX || (unit.x >= 0 ? 1 : -1) * 1.1) * 1.45;
  unit.vy = 3.4 + Math.min(1.6, Math.abs(impulseZ) * 0.4);
  unit.vz = impulseZ * 2.15;
  unit.spin = (unit.x >= 0 ? -1 : 1) * (8 + Math.abs(impulseX) * 2.6);
  return true;
}

export function killArmyUnits(units, losses, time, originX = 0) {
  const victims = units
    .filter((unit) => unit.active && !unit.dying)
    .sort(
      (a, b) =>
        Math.abs(a.x - originX) + a.z * 0.08 -
        (Math.abs(b.x - originX) + b.z * 0.08),
    )
    .slice(0, losses);

  victims.forEach((unit, index) => {
    killArmyUnit(
      unit,
      time + index * 0.015,
      (unit.x - originX) * 2.2,
      0.9 + (index % 3) * 0.18,
    );
  });
  return victims;
}

export function findNearestArmyUnit(units, worldX, localZ, playerX) {
  let nearest = null;
  let nearestDistanceSq = Infinity;
  units.forEach((unit) => {
    if (!unit.active || unit.dying || unit.scale < 0.45) return;
    const dx = playerX + unit.x - worldX;
    const dz = unit.z - localZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = unit;
    }
  });
  return nearestDistanceSq <= 0.34 * 0.34 ? nearest : null;
}

export function chooseEnemyTarget(waves, waveStates, shooterX, distance, regionIndex) {
  let best = null;
  let bestScore = Infinity;

  waves.forEach((enemies, waveIndex) => {
    if (waveIndex !== regionIndex || !waveStates[waveIndex]?.unlocked) return;
    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const z =
        distance -
        enemy.waveZ -
        enemy.zOffset +
        (waveStates[waveIndex]?.advance || 0);
      if (z > 4.4 || z < -48) return;
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
  const angle = index * 2.3999632297;
  const count = Math.max(1, wave.count ?? index + 1);
  const radius = (0.18 + Math.sqrt((index + 0.5) / count) * 2.72) *
    (0.92 + (waveIndex % 2) * 0.04);
  const x = Math.cos(angle) * radius;
  const zOffset = Math.sin(angle) * radius;
  return {
    id: waveIndex * 100 + index,
    waveZ: wave.z,
    x,
    homeX: x,
    currentX: x,
    zOffset,
    homeZOffset: zOffset,
    localVx: 0,
    localVz: 0,
    hp: 1 + Math.floor(waveIndex / 2),
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
