import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles, Text } from "@react-three/drei";
import {
  ArrowsOutSimple,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import * as THREE from "three";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BOSS_Z,
  clamp,
  createGates,
  formatGateValue,
  gateColor,
  LANE_X,
  MAX_BULLETS,
  MAX_IMPACTS,
  MAX_VISIBLE_TROOPS,
  PLAYER_GATE_CONTACT_Z,
  PLAYER_LIMIT,
  TRACK_END,
  WAVES,
} from "./gameConfig.js";
import {
  chooseEnemyTarget,
  createArmyUnit,
  createEnemy,
  updateArmyUnits,
} from "./gameSystems.js";

const DEBUG_FLAGS =
  !import.meta.env.DEV || typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
const DEBUG_NO_ENEMIES = DEBUG_FLAGS.has("noEnemies");
const DEBUG_NO_EFFECTS = DEBUG_FLAGS.has("noEffects");
const DEBUG_NO_ARMY = DEBUG_FLAGS.has("noArmy");
const DEBUG_NO_PROJECTILES = DEBUG_FLAGS.has("noProjectiles");
const DEBUG_NO_PHYSICS = DEBUG_FLAGS.has("noPhysics");
const DEBUG_SLOW = DEBUG_FLAGS.has("slow");
const DEBUG_NO_ADVANCE = DEBUG_FLAGS.has("noAdvance");
const DEBUG_STOP_AT = Number(DEBUG_FLAGS.get("stopAt")) || null;

function Hovercraft({ active, rapidRef, playerXRef }) {
  const ref = useRef();
  const previousX = useRef(0);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const velocity = (playerXRef.current - previousX.current) / Math.max(delta, 0.001);
    previousX.current = playerXRef.current;
    ref.current.position.y = 0.48 + Math.sin(t * 5.5) * 0.04;
    ref.current.rotation.z = THREE.MathUtils.damp(
      ref.current.rotation.z,
      clamp(-velocity * 0.045, -0.16, 0.16),
      10,
      delta,
    );
  });

  return (
    <group ref={ref} position={[0, 0.5, 4.35]}>
      <mesh>
        <boxGeometry args={[1.2, 0.26, 1.55]} />
        <meshStandardMaterial
          color="#e7fdff"
          metalness={0.7}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, 0.23, -0.1]}>
        <boxGeometry args={[0.68, 0.26, 0.7]} />
        <meshStandardMaterial
          color="#078dc8"
          metalness={0.65}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.33, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 1.28, 12]} />
        <meshStandardMaterial
          color="#eaffff"
          emissive="#52dcff"
          emissiveIntensity={0.75}
        />
      </mesh>
      {[-0.7, 0.7].map((side) => (
        <group key={side} position={[side, -0.02, 0.06]}>
          <mesh>
            <boxGeometry args={[0.34, 0.14, 1.22]} />
            <meshStandardMaterial
              color="#075a88"
              metalness={0.82}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, -0.06, 0.42]}>
            <cylinderGeometry args={[0.13, 0.13, 0.18, 16]} />
            <meshBasicMaterial color="#62f4ff" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <pointLight
        position={[0, 0.25, -0.92]}
        color={rapidRef.current ? "#efff72" : "#59eaff"}
        intensity={active ? (rapidRef.current ? 5 : 3) : 0.5}
        distance={4}
      />
    </group>
  );
}

function Army({ troopsRef, unitsRef, upgradePulseRef }) {
  const bodies = useRef();
  const heads = useRef();
  const guns = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const previousCount = useRef(0);

  useEffect(() => {
    [bodies, heads, guns].forEach((ref) => {
      if (ref.current) {
        ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      }
    });
  }, []);

  useFrame((state, delta) => {
    if (!bodies.current || !heads.current || !guns.current) return;
    const time = state.clock.elapsedTime;
    const count = Math.min(troopsRef.current, MAX_VISIBLE_TROOPS);

    if (count > previousCount.current) {
      const pulse = upgradePulseRef.current;
      pulse.at = time;
      pulse.from = previousCount.current;
      pulse.to = count;
      unitsRef.current.forEach((unit, index) => {
        if (index < previousCount.current) unit.glowUntil = time + 0.72;
      });
    }
    previousCount.current = count;
    updateArmyUnits(unitsRef.current, count, time, delta);

    unitsRef.current.forEach((unit, index) => {
      if (!unit.active || time < unit.spawnAt) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(index, dummy.matrix);
        heads.current.setMatrixAt(index, dummy.matrix);
        guns.current.setMatrixAt(index, dummy.matrix);
        return;
      }
      const step = Math.abs(Math.sin(time * 8 + index * 0.7)) * 0.045;
      const scale = unit.scale * 0.75;
      const glowing = time < unit.glowUntil;
      color.set(glowing ? "#fff27a" : "#20bce9");

      dummy.position.set(unit.x, 0.58 + step, unit.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(index, dummy.matrix);
      bodies.current.setColorAt(index, color);

      dummy.position.set(unit.x, 0.84 + step, unit.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);
      heads.current.setColorAt(index, color.set(glowing ? "#ffffff" : "#eaffff"));

      dummy.position.set(unit.x + 0.08, 0.65 + step, unit.z - 0.08);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      guns.current.setMatrixAt(index, dummy.matrix);
      guns.current.setColorAt(index, color.set(glowing ? "#fff27a" : "#f1ffff"));
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    guns.current.instanceMatrix.needsUpdate = true;
    if (bodies.current.instanceColor) bodies.current.instanceColor.needsUpdate = true;
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
    if (guns.current.instanceColor) guns.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[null, null, MAX_VISIBLE_TROOPS]}>
        <capsuleGeometry args={[0.085, 0.2, 3, 7]} />
        <meshStandardMaterial
          color="#20bce9"
          vertexColors
          emissive="#087eae"
          emissiveIntensity={0.18}
          metalness={0.4}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, MAX_VISIBLE_TROOPS]}>
        <sphereGeometry args={[0.115, 8, 8]} />
        <meshStandardMaterial
          color="#eaffff"
          vertexColors
          emissive="#108bc7"
          emissiveIntensity={0.22}
        />
      </instancedMesh>
      <instancedMesh ref={guns} args={[null, null, MAX_VISIBLE_TROOPS]}>
        <cylinderGeometry args={[0.022, 0.03, 0.3, 6]} />
        <meshStandardMaterial color="#f1ffff" vertexColors metalness={0.8} />
      </instancedMesh>
    </group>
  );
}

function Drone({ index, dronesRef }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.visible = index < dronesRef.current;
  });
  const side = index % 2 ? -1 : 1;
  return (
    <Float
      speed={3.2 + index}
      rotationIntensity={0.25}
      floatIntensity={0.28}
    >
      <group
        ref={ref}
        position={[
          side * (1.25 + Math.floor(index / 2) * 0.35),
          1.15 + (index % 2) * 0.22,
          2.7 - index * 0.24,
        ]}
      >
        <mesh>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial
            color="#e8ffff"
            emissive="#4f9dff"
            emissiveIntensity={1.1}
            metalness={0.72}
          />
        </mesh>
        <pointLight color="#70baff" intensity={1.2} distance={2} />
      </group>
    </Float>
  );
}

function DroneWing({ dronesRef }) {
  return (
    <group>
      {Array.from({ length: 5 }, (_, index) => (
        <Drone key={index} index={index} dronesRef={dronesRef} />
      ))}
    </group>
  );
}

function UpgradeBurst({ pulseRef }) {
  const ring = useRef();
  const light = useRef();
  useFrame((state) => {
    if (!ring.current || !light.current) return;
    const age = state.clock.elapsedTime - pulseRef.current.at;
    const active = age >= 0 && age < 0.8;
    ring.current.visible = active;
    light.current.visible = active;
    if (!active) return;
    const progress = age / 0.8;
    const scale = 0.35 + progress * 3.8;
    ring.current.scale.setScalar(scale);
    ring.current.material.opacity = (1 - progress) * 0.92;
    ring.current.rotation.z = progress * 1.8;
    light.current.intensity = (1 - progress) * 8;
  });
  return (
    <group position={[0, 0.32, 2.55]}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.72, 0.055, 8, 40]} />
        <meshBasicMaterial
          color="#fff16b"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={light}
        color="#ffe766"
        intensity={0}
        distance={6}
        visible={false}
      />
    </group>
  );
}

function PlayerRig({
  playerXRef,
  troopsRef,
  dronesRef,
  rapidRef,
  unitsRef,
  upgradePulseRef,
  active,
}) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.x = THREE.MathUtils.damp(
      ref.current.position.x,
      playerXRef.current,
      28,
      delta,
    );
  });
  return (
    <group ref={ref}>
      <Army
        troopsRef={troopsRef}
        unitsRef={unitsRef}
        upgradePulseRef={upgradePulseRef}
      />
      <DroneWing dronesRef={dronesRef} />
      <UpgradeBurst pulseRef={upgradePulseRef} />
      <Hovercraft
        active={active}
        rapidRef={rapidRef}
        playerXRef={playerXRef}
      />
    </group>
  );
}

function ProjectilePool({ bulletsRef }) {
  const glow = useRef();
  const core = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    [glow, core].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
  }, []);
  useFrame(() => {
    if (!glow.current || !core.current) return;
    bulletsRef.current.forEach((bullet, index) => {
      if (!bullet.active) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(bullet.x, bullet.y, bullet.z);
        dummy.rotation.set(0, 0, -bullet.vx * 0.035);
        dummy.scale.set(
          bullet.rapid ? 1.55 : 1.25,
          bullet.rapid ? 1.55 : 1.25,
          bullet.rapid ? 4.5 : 3.2,
        );
      }
      dummy.updateMatrix();
      glow.current.setMatrixAt(index, dummy.matrix);
      if (bullet.active) dummy.scale.multiplyScalar(0.52);
      dummy.updateMatrix();
      core.current.setMatrixAt(index, dummy.matrix);
    });
    glow.current.instanceMatrix.needsUpdate = true;
    core.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={glow} args={[null, null, MAX_BULLETS]}>
        <sphereGeometry args={[0.068, 6, 6]} />
        <meshBasicMaterial
          color="#ffba32"
          transparent
          opacity={0.8}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={core} args={[null, null, MAX_BULLETS]}>
        <sphereGeometry args={[0.068, 6, 6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function ImpactPool({ impactsRef }) {
  const particles = useRef();
  const rings = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const particlesPerImpact = 8;
  useEffect(() => {
    [particles, rings].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
  }, []);
  useFrame((_, delta) => {
    if (!particles.current || !rings.current) return;
    impactsRef.current.forEach((impact, impactIndex) => {
      if (impact.active) {
        impact.life -= delta;
        if (impact.life <= 0) impact.active = false;
      }
      for (let particle = 0; particle < particlesPerImpact; particle += 1) {
        const matrixIndex = impactIndex * particlesPerImpact + particle;
        if (!impact.active) {
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          particles.current.setMatrixAt(matrixIndex, dummy.matrix);
          continue;
        }
        const progress = 1 - impact.life / impact.duration;
        const angle = (particle / particlesPerImpact) * Math.PI * 2;
        const radius = 0.05 + progress * (0.18 + particle * 0.025);
        dummy.position.set(
          impact.x + Math.cos(angle) * radius,
          impact.y + Math.sin(angle) * radius,
          impact.z + (particle - 2) * 0.025,
        );
        dummy.rotation.set(progress * 3, angle, 0);
        dummy.scale.setScalar((impact.size || 1) * (1.1 - progress * 0.65));
        dummy.updateMatrix();
        particles.current.setMatrixAt(matrixIndex, dummy.matrix);
        particles.current.setColorAt(matrixIndex, color.set(impact.color));
      }
      if (!impact.active) {
        dummy.scale.setScalar(0);
      } else {
        const progress = 1 - impact.life / impact.duration;
        dummy.position.set(impact.x, impact.y, impact.z - 0.035);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar((impact.size || 1) * (0.35 + progress * 2.4));
      }
      dummy.updateMatrix();
      rings.current.setMatrixAt(impactIndex, dummy.matrix);
    });
    particles.current.instanceMatrix.needsUpdate = true;
    rings.current.instanceMatrix.needsUpdate = true;
    if (particles.current.instanceColor) particles.current.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh
        ref={particles}
        args={[null, null, MAX_IMPACTS * particlesPerImpact]}
      >
        <octahedronGeometry args={[0.065, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rings} args={[null, null, MAX_IMPACTS]}>
        <torusGeometry args={[0.12, 0.018, 5, 18]} />
        <meshBasicMaterial
          color="#fff27a"
          transparent
          opacity={0.92}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}

function GateValue({ stateRef, side }) {
  const text = useRef();
  const previous = useRef(null);
  useFrame(() => {
    if (!text.current) return;
    const value = stateRef[`${side}Value`];
    if (value !== previous.current) {
      previous.current = value;
      text.current.text = formatGateValue(value);
      text.current.sync?.();
    }
    const color = gateColor(value);
    text.current.color = color;
  });
  return (
    <Text
      ref={text}
      position={[0, 1.65, -0.08]}
      fontSize={0.82}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.035}
      outlineColor="#062d42"
    >
      {formatGateValue(stateRef[`${side}Value`])}
    </Text>
  );
}

function ValueBar({ stateRef, side, maxValue }) {
  const fill = useRef();
  useFrame(() => {
    if (!fill.current) return;
    const value = stateRef[`${side}Value`];
    const normalized = clamp((value + 20) / (maxValue + 20), 0.02, 1);
    const width = 1.72 * normalized;
    fill.current.scale.x = Math.max(0.01, width);
    fill.current.position.x = -0.86 + width / 2;
    fill.current.material.color.set(gateColor(value));
  });
  return (
    <group position={[0, 0.56, -0.03]}>
      <mesh>
        <boxGeometry args={[1.82, 0.09, 0.05]} />
        <meshBasicMaterial color="#062e40" transparent opacity={0.75} />
      </mesh>
      <mesh ref={fill} position={[-0.855, 0, -0.035]}>
        <boxGeometry args={[1, 0.07, 0.06]} />
        <meshBasicMaterial color="#35dffc" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Gate({
  x,
  z,
  data,
  side,
  distanceRef,
  playerXRef,
  stateRef,
}) {
  const group = useRef();
  const panel = useRef();
  const frameMaterials = useRef([]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const renderZ = distanceRef.current - z;
    const selected =
      side === "left" ? playerXRef.current < 0 : playerXRef.current >= 0;
    const approaching = renderZ > -25 && renderZ < PLAYER_GATE_CONTACT_Z;
    const resolvedAge = stateRef.resolved
      ? state.clock.elapsedTime - stateRef.resolvedAt
      : 0;
    const disappearing = stateRef.resolved && resolvedAge > 0;
    const hit = stateRef[`${side}Hit`] || 0;
    const value = stateRef[`${side}Value`];
    const color = gateColor(value);
    stateRef[`${side}Hit`] = Math.max(0, hit - delta * 5.5);
    const bounce = hit > 0 ? Math.sin(hit * Math.PI) * 0.18 : 0;
    const vanish = disappearing ? clamp(resolvedAge / 0.32, 0, 1) : 0;
    group.current.position.z = renderZ;
    group.current.visible =
      renderZ > -72 && renderZ < 7 && (!stateRef.resolved || vanish < 1);
    group.current.scale.set(
      (1 + bounce) * (1 - vanish * 0.7),
      (1 - bounce * 0.55) * (1 - vanish),
      1,
    );
    group.current.position.y = disappearing ? vanish * 0.5 : 0;
    if (panel.current) {
      panel.current.color.set(color);
      panel.current.emissive.set(color);
      panel.current.opacity = disappearing
        ? 0.22 * (1 - vanish)
        : approaching
          ? selected
            ? 0.2 + hit * 0.22
            : 0.055
          : 0.07;
      panel.current.emissiveIntensity = selected && approaching ? 1.2 + hit * 3 : 0.55;
    }
    frameMaterials.current.forEach((material) => {
      if (material) {
        material.emissive.set(color);
        material.emissiveIntensity = selected ? 0.9 + hit * 3.2 : 0.55;
      }
    });
  });

  return (
    <group ref={group} position={[x, 0, -50]}>
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[2.38, 2.7, 0.055]} />
        <meshStandardMaterial
          ref={panel}
          color={gateColor(stateRef[`${side}Value`])}
          emissive={gateColor(stateRef[`${side}Value`])}
          emissiveIntensity={0.65}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
      {[-1.19, 1.19].map((side) => (
        <mesh key={side} position={[side, 1.45, 0]}>
          <boxGeometry args={[0.12, 2.95, 0.18]} />
          <meshStandardMaterial
            ref={(material) => {
              frameMaterials.current[side > 0 ? 1 : 0] = material;
            }}
            color="#e9ffff"
            emissive={gateColor(stateRef[`${side}Value`])}
            emissiveIntensity={0.65}
            metalness={0.48}
          />
        </mesh>
      ))}
      <mesh position={[0, 2.89, 0]}>
        <boxGeometry args={[2.5, 0.14, 0.18]} />
        <meshStandardMaterial
          ref={(material) => {
            frameMaterials.current[2] = material;
          }}
          color="#eaffff"
          emissive={gateColor(stateRef[`${side}Value`])}
          emissiveIntensity={0.65}
        />
      </mesh>
      <GateValue stateRef={stateRef} side={side} />
      <ValueBar stateRef={stateRef} side={side} maxValue={data.maxValue} />
      <Text
        position={[0, 0.82, -0.08]}
        fontSize={0.16}
        color="#ddffff"
        anchorX="center"
      >
        SHOOT TO INCREASE
      </Text>
    </group>
  );
}

function GatePair({ gate, distanceRef, playerXRef, stateRef }) {
  return (
    <group>
      <Gate
        x={-LANE_X}
        z={gate.z}
        data={gate}
        side="left"
        distanceRef={distanceRef}
        playerXRef={playerXRef}
        stateRef={stateRef}
      />
      <Gate
        x={LANE_X}
        z={gate.z}
        data={gate}
        side="right"
        distanceRef={distanceRef}
        playerXRef={playerXRef}
        stateRef={stateRef}
      />
    </group>
  );
}

function EnemyWave({ wave, enemies, waveState, distanceRef }) {
  const bodies = useRef();
  const heads = useRef();
  const legs = useRef();
  const alertRing = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bodyColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    [bodies, heads, legs].forEach((ref) => {
      if (ref.current) {
        ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      }
    });
  }, []);

  useFrame((state) => {
    if (!bodies.current || !heads.current || !legs.current) return;
    const t = state.clock.elapsedTime;
    if (alertRing.current) {
      const alertAge = t - waveState.alertedAt;
      alertRing.current.visible = alertAge >= 0 && alertAge < 0.8;
      if (alertRing.current.visible) {
        alertRing.current.position.z =
          distanceRef.current - wave.z + waveState.advance;
        alertRing.current.scale.setScalar(0.6 + alertAge * 5.2);
        alertRing.current.material.opacity = Math.max(0, 0.7 - alertAge * 0.85);
      }
    }
    enemies.forEach((enemy, index) => {
      const renderZ =
        distanceRef.current - wave.z - enemy.zOffset + waveState.advance;
      let x = enemy.currentX;
      let y = 0.3;
      let z = renderZ;
      let scaleX = 1;
      let scaleY = 1;
      let scaleZ = 1;
      let rotationX = 0;
      let rotationY = 0;
      let rotationZ = 0;
      let visible = renderZ > -64 && renderZ < 8;
      let hit = 0;

      if (enemy.alive) {
        const runRate = waveState.alerted ? 10.5 : 5.5;
        y += Math.abs(Math.sin(t * runRate + enemy.id)) * (waveState.alerted ? 0.12 : 0.07);
        rotationY = Math.sin(t * 2 + enemy.id) * 0.14;
        const hitAge = t - enemy.hitAt;
        hit = hitAge >= 0 && hitAge < 0.22 ? 1 - hitAge / 0.22 : 0;
        scaleX = 1 + hit * 0.24;
        scaleY = 1 - hit * 0.28;
        scaleZ = 1 + hit * 0.24;
      } else {
        const age = t - enemy.deathAt;
        visible = age >= 0 && age <= 0.9;
        if (visible) {
          const flightAge = Math.max(0, age - 0.11);
          hit = age < 0.16 ? 1 : 0;
          x += enemy.vx * flightAge;
          y += enemy.vy * flightAge - 4.6 * flightAge * flightAge;
          z += enemy.vz * flightAge;
          rotationX = flightAge * enemy.spinX;
          rotationY = flightAge * enemy.spinY;
          rotationZ = flightAge * enemy.spinZ;
          const deathScale = age < 0.11 ? 1 + age * 2.2 : 1 - flightAge / 0.82;
          scaleX = scaleY = scaleZ = Math.max(0.05, deathScale);
        }
      }

      if (!visible) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(index, dummy.matrix);
        heads.current.setMatrixAt(index, dummy.matrix);
        legs.current.setMatrixAt(index, dummy.matrix);
        return;
      }

      dummy.position.set(x, y, z);
      dummy.rotation.set(rotationX, rotationY, rotationZ);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(index, dummy.matrix);
      bodyColor.set(hit > 0 ? "#ffffff" : "#e54f32");
      bodies.current.setColorAt(index, bodyColor);

      dummy.position.set(x, y + 0.3 * scaleY, z);
      dummy.scale.setScalar(0.95 * scaleX);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);
      heads.current.setColorAt(index, bodyColor.set(hit > 0 ? "#ffffff" : "#ffbc83"));

      dummy.position.set(x, y - 0.12 * scaleY, z);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      legs.current.setMatrixAt(index, dummy.matrix);
      legs.current.setColorAt(index, bodyColor.set(hit > 0 ? "#ffffff" : "#51222c"));
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    legs.current.instanceMatrix.needsUpdate = true;
    if (bodies.current.instanceColor) {
      bodies.current.instanceColor.needsUpdate = true;
    }
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
    if (legs.current.instanceColor) legs.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <mesh
        ref={alertRing}
        position={[0, 0.12, -50]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[0.8, 0.055, 7, 40]} />
        <meshBasicMaterial
          color="#ff3f2f"
          transparent
          opacity={0.7}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh ref={bodies} args={[null, null, enemies.length]}>
        <dodecahedronGeometry args={[0.23, 0]} />
        <meshStandardMaterial
          color="#e54f32"
          vertexColors
          emissive="#681109"
          emissiveIntensity={0.38}
          metalness={0.48}
          roughness={0.32}
        />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, enemies.length]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial
          color="#ffbc83"
          vertexColors
          emissive="#ff4d24"
          emissiveIntensity={0.42}
        />
      </instancedMesh>
      <instancedMesh ref={legs} args={[null, null, enemies.length]}>
        <boxGeometry args={[0.38, 0.32, 0.07]} />
        <meshStandardMaterial color="#51222c" vertexColors />
      </instancedMesh>
    </group>
  );
}

function Boss({ distanceRef, healthRef, activeRef, hitRef }) {
  const ref = useRef();
  const coreMaterial = useRef();
  const hitMaterials = useRef([]);

  useFrame((state) => {
    if (!ref.current) return;
    const z = distanceRef.current - BOSS_Z;
    ref.current.position.z = z;
    ref.current.visible = distanceRef.current >= 135 && z > -40 && z < 8;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.65) * 0.08;
    const hitAge = state.clock.elapsedTime - hitRef.current;
    const hit = hitAge >= 0 && hitAge < 0.11 ? 1 - hitAge / 0.11 : 0;
    ref.current.scale.set(1 + hit * 0.08, 1 - hit * 0.12, 1 + hit * 0.08);
    hitMaterials.current.forEach((material) => {
      if (!material) return;
      material.color.set(hit > 0 ? "#ffffff" : material.userData.baseColor);
    });
    if (coreMaterial.current) {
      coreMaterial.current.color.set(hit > 0 ? "#ffffff" : "#ecffff");
      coreMaterial.current.emissive.set(hit > 0
        ? "#ffffff"
        : healthRef.current < 45 ? "#ff5a27" : "#00a7df");
      coreMaterial.current.emissiveIntensity = activeRef.current
        ? 1.25 + (1 - healthRef.current / 100) + hit * 4
        : 0.45;
    }
  });

  return (
    <group ref={ref} position={[0, 1.08, -40]} visible={false}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[3.65, 1.18, 1.45]} />
        <meshBasicMaterial
          ref={(material) => {
            if (material) {
              material.userData.baseColor = "#176681";
              hitMaterials.current[0] = material;
            }
          }}
          color="#176681"
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.48, -0.74]}>
        <boxGeometry args={[2.75, 0.34, 0.08]} />
        <meshBasicMaterial
          ref={(material) => {
            if (material) {
              material.userData.baseColor = "#38cce5";
              hitMaterials.current[1] = material;
            }
          }}
          color="#38cce5"
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.05, -0.8]}>
        <boxGeometry args={[2.5, 0.45, 0.15]} />
        <meshStandardMaterial
          ref={(material) => {
            if (material) {
              material.userData.baseColor = "#75efff";
              hitMaterials.current[2] = material;
            }
          }}
          color="#75efff"
          emissive="#21d8f4"
          emissiveIntensity={1.2}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <icosahedronGeometry args={[0.92, 1]} />
        <meshStandardMaterial
          ref={coreMaterial}
          color="#ecffff"
          emissive="#00a7df"
          emissiveIntensity={0.45}
          metalness={0.62}
          roughness={0.2}
        />
      </mesh>
      {[-2.25, 2.25].map((side, sideIndex) => (
        <Float key={side} speed={2.4} rotationIntensity={0.2} floatIntensity={0.2}>
          <group position={[side, 0.3, 0]}>
            <mesh rotation={[0, 0, side > 0 ? -0.2 : 0.2]}>
              <octahedronGeometry args={[0.68, 0]} />
              <meshStandardMaterial
                ref={(material) => {
                  if (material) {
                    material.userData.baseColor = "#ffad3d";
                    hitMaterials.current[3 + sideIndex * 2] = material;
                  }
                }}
                color="#ffad3d"
                emissive="#ff551c"
                emissiveIntensity={1}
                metalness={0.45}
              />
            </mesh>
            <mesh position={[0, -0.55, 0]}>
              <cylinderGeometry args={[0.18, 0.24, 0.9, 8]} />
              <meshStandardMaterial
                ref={(material) => {
                  if (material) {
                    material.userData.baseColor = "#d9f8ff";
                    hitMaterials.current[4 + sideIndex * 2] = material;
                  }
                }}
                color="#d9f8ff"
                emissive="#168bb3"
                emissiveIntensity={0.5}
                metalness={0.7}
              />
            </mesh>
          </group>
        </Float>
      ))}
      <Text
        position={[0, 2.85, 0]}
        fontSize={0.48}
        color="#ffffff"
        outlineWidth={0.03}
        outlineColor="#062d42"
      >
        AEGIS CORE
      </Text>
      <Sparkles
        count={48}
        scale={[5, 4, 2.5]}
        size={4}
        speed={1.7}
        color="#58eaff"
      />
    </group>
  );
}

function FloatingIsland({ x, baseZ, scale = 1, distanceRef }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.position.z = baseZ + (distanceRef.current % 48);
  });
  return (
    <group ref={ref} position={[x, -1.7, baseZ]} scale={scale}>
      <mesh rotation={[0, 0.3, 0]}>
        <coneGeometry args={[2.05, 3.7, 7]} />
        <meshStandardMaterial color="#477866" roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[2.12, 2, 0.48, 7]} />
        <meshStandardMaterial color="#68c588" roughness={0.76} />
      </mesh>
      <mesh position={[0.35, 2.03, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 1.05, 6]} />
        <meshStandardMaterial color="#e9ffff" metalness={0.4} />
      </mesh>
      <mesh position={[0.35, 2.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.07, 8, 28]} />
        <meshStandardMaterial
          color="#8ffcff"
          emissive="#37dff4"
          emissiveIntensity={1.5}
        />
      </mesh>
    </group>
  );
}

function Road({ distanceRef }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.position.z = distanceRef.current % 8;
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 14 }, (_, index) => (
        <group key={index} position={[0, 0, -index * 8]}>
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[7.1, 0.42, 7.78]} />
            <meshStandardMaterial
              color="#b9e2e5"
              metalness={0.2}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <boxGeometry args={[6.0, 0.04, 7.62]} />
            <meshStandardMaterial color="#ccecee" roughness={0.58} />
          </mesh>
          {[-3.28, 3.28].map((x) => (
            <mesh key={x} position={[x, 0.08, 0]}>
              <boxGeometry args={[0.08, 0.04, 7.5]} />
              <meshBasicMaterial color="#61f2ff" toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.045, 0.04, 2.45]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function World({ status, runSeed, onFrameData, onEvent }) {
  const { camera, gl } = useThree();
  const gates = useMemo(() => createGates(runSeed), [runSeed]);
  const playerX = useRef(0);
  const pointerTargetX = useRef(0);
  const distance = useRef(0);
  const troops = useRef(12);
  const combo = useRef(1);
  const bossHealth = useRef(100);
  const rapidUntil = useRef(0);
  const rapidRef = useRef(false);
  const drones = useRef(0);
  const gateStates = useRef(
    gates.map((gate) => ({
      leftValue: gate.left,
      rightValue: gate.right,
      leftHit: 0,
      rightHit: 0,
      resolved: false,
      choice: null,
      resolvedAt: 0,
    })),
  );
  const waveStates = useRef(
    WAVES.map(() => ({
      alerted: false,
      alertedAt: -10,
      advance: 0,
    })),
  );
  const waveEnemies = useRef(
    WAVES.map((wave, waveIndex) =>
      Array.from({ length: wave.count }, (_, index) =>
        createEnemy(wave, waveIndex, index),
      ),
    ),
  );
  const armyUnits = useRef(
    Array.from({ length: MAX_VISIBLE_TROOPS }, (_, index) =>
      createArmyUnit(index),
    ),
  );
  const upgradePulse = useRef({ at: -10, from: 0, to: 0 });
  const bullets = useRef(
    Array.from({ length: MAX_BULLETS }, () => ({
      active: false,
      x: 0,
      y: 0.75,
      z: 3.5,
      speed: 18,
      vx: 0,
      rapid: false,
      shooter: 0,
    })),
  );
  const impacts = useRef(
    Array.from({ length: MAX_IMPACTS }, () => ({
      active: false,
      x: 0,
      y: 0.75,
      z: 0,
      life: 0,
      duration: 0.24,
      color: "#6cf4ff",
      size: 1,
    })),
  );
  const resolvedWaves = useRef(new Set());
  const clearedWaves = useRef(new Set());
  const bossActive = useRef(false);
  const bossHitAt = useRef(-10);
  const bossAttackTimer = useRef(1.2);
  const shotTimer = useRef(0);
  const finished = useRef(false);
  const shake = useRef(0);
  const uiTimer = useRef(0);
  const keyboard = useRef({ left: false, right: false });
  const lastHit = useRef(null);
  const lastEnemyHit = useRef(null);
  const movementSamples = useRef([]);
  const fpsCounter = useRef({ frames: 0, elapsed: 0, value: 0 });

  const spawnImpact = (x, y, z, color, duration = 0.24, size = 1) => {
    const impact =
      impacts.current.find((item) => !item.active) ||
      impacts.current.reduce((oldest, item) =>
        item.life < oldest.life ? item : oldest,
      );
    Object.assign(impact, {
      active: true,
      x,
      y,
      z,
      color,
      duration,
      life: duration,
      size,
    });
  };

  const spawnVolley = (rapid) => {
    const activeShooters = armyUnits.current.filter(
      (unit) => unit.active && unit.scale > 0.72,
    );
    if (!activeShooters.length) return;
    const count = clamp(2 + Math.floor(troops.current / 15), 2, rapid ? 10 : 8);
    const sorted = [...activeShooters].sort((a, b) => a.x - b.x);
    const shooterIndices = Array.from({ length: count }, (_, index) =>
      Math.round((index / Math.max(1, count - 1)) * (sorted.length - 1)),
    );
    shooterIndices.forEach((shooterIndex, index) => {
      const bullet = bullets.current.find((item) => !item.active);
      if (!bullet) return;
      const shooter = sorted[shooterIndex];
      const shooterX = playerX.current + shooter.x + 0.08;
      const target = chooseEnemyTarget(
        waveEnemies.current,
        waveStates.current,
        shooterX,
        distance.current,
      );
      bullet.active = true;
      bullet.x = shooterX;
      bullet.y = 0.7 + (index % 2) * 0.04;
      bullet.z = shooter.z - 0.22;
      bullet.speed = rapid ? 27 : 21;
      bullet.vx = target
        ? clamp((target.x - shooterX) * 1.45, -3.2, 3.2)
        : 0;
      bullet.rapid = rapid;
      bullet.shooter = shooter.index;
    });
  };

  useEffect(() => {
    const movePointer = (event) => {
      const rect = gl.domElement.getBoundingClientRect();
      const normalized = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerTargetX.current = clamp(
        normalized * PLAYER_LIMIT,
        -PLAYER_LIMIT,
        PLAYER_LIMIT,
      );
    };
    const down = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        movementSamples.current = [];
        keyboard.current.left = true;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        movementSamples.current = [];
        keyboard.current.right = true;
      }
    };
    const up = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keyboard.current.left = false;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keyboard.current.right = false;
      }
    };
    window.addEventListener("pointerdown", movePointer, { passive: true });
    window.addEventListener("pointermove", movePointer, { passive: true });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("pointerdown", movePointer);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [gl]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    fpsCounter.current.frames += 1;
    fpsCounter.current.elapsed += rawDelta;
    if (fpsCounter.current.elapsed >= 1) {
      fpsCounter.current.value = Math.round(
        fpsCounter.current.frames / fpsCounter.current.elapsed,
      );
      fpsCounter.current.frames = 0;
      fpsCounter.current.elapsed = 0;
    }
    const playing = status === "playing" && !finished.current;
    let targetX = pointerTargetX.current;
    if (keyboard.current.left) targetX = -PLAYER_LIMIT;
    if (keyboard.current.right) targetX = PLAYER_LIMIT;
    if (playing) {
      playerX.current = THREE.MathUtils.damp(
        playerX.current,
        targetX,
        15,
        delta,
      );
      movementSamples.current.push(playerX.current);
      if (movementSamples.current.length > 600) movementSamples.current.shift();
    }

    if (playing) {
      rapidRef.current = rapidUntil.current > state.clock.elapsedTime;
      if (!bossActive.current && !DEBUG_NO_ADVANCE) {
        distance.current = Math.min(
          DEBUG_STOP_AT ?? TRACK_END,
          distance.current +
            delta *
              (rapidRef.current ? 7.2 : 6.15) *
              (DEBUG_SLOW ? 0.28 : 1),
        );
      }

      WAVES.forEach((wave, waveIndex) => {
        const waveState = waveStates.current[waveIndex];
        if (waveState.alerted) {
          const frontZ = distance.current - wave.z + waveState.advance;
          const pressure = clamp((-frontZ + 5) / 34, 0.25, 1);
          waveState.advance += delta * wave.speed * pressure;
        }
        waveEnemies.current[waveIndex].forEach((enemy) => {
          if (!enemy.alive) return;
          const tracking = waveState.alerted ? playerX.current * 0.2 : 0;
          enemy.currentX = THREE.MathUtils.damp(
            enemy.currentX,
            enemy.x + tracking,
            waveState.alerted ? 2.8 : 4.5,
            delta,
          );
        });
      });

      if (!DEBUG_NO_PHYSICS) {
        shotTimer.current -= delta;
        if (shotTimer.current <= 0) {
          spawnVolley(rapidRef.current);
          shotTimer.current = rapidRef.current ? 0.065 : 0.125;
        }
      }

      if (!DEBUG_NO_PHYSICS) bullets.current.forEach((bullet) => {
        if (!bullet.active) return;
        const oldZ = bullet.z;
        const oldX = bullet.x;
        const nextZ = oldZ - bullet.speed * delta;
        const nextX = oldX + bullet.vx * delta;
        const collisionX = (oldX + nextX) * 0.5;
        let target = null;
        let targetZ = -Infinity;

        gates.forEach((gate, gateIndex) => {
          const gateState = gateStates.current[gateIndex];
          if (gateState.resolved) return;
          const z = distance.current - gate.z;
          const side = collisionX < 0 ? "left" : "right";
          const laneCenter = side === "left" ? -LANE_X : LANE_X;
          if (
            z <= oldZ + 0.12 &&
            z >= nextZ - 0.12 &&
            Math.abs(collisionX - laneCenter) <= 1.18 &&
            z > targetZ
          ) {
            target = { type: "gate", gateIndex, side, z };
            targetZ = z;
          }
        });

        if (!DEBUG_NO_ENEMIES) WAVES.forEach((wave, waveIndex) => {
          waveEnemies.current[waveIndex].forEach((enemy) => {
            if (!enemy.alive) return;
            const z =
              distance.current -
              wave.z -
              enemy.zOffset +
              waveStates.current[waveIndex].advance;
            if (
              z <= oldZ + 0.2 &&
              z >= nextZ - 0.2 &&
              Math.abs(collisionX - enemy.currentX) <= 0.3 &&
              z > targetZ
            ) {
              target = { type: "enemy", waveIndex, enemy, z };
              targetZ = z;
            }
          });
        });

        if (bossActive.current && bossHealth.current > 0) {
          const z = distance.current - BOSS_Z;
          if (
            z <= oldZ + 0.35 &&
            z >= nextZ - 0.35 &&
            Math.abs(collisionX) <= 2.15 &&
            z > targetZ
          ) {
            target = { type: "boss", z };
          }
        }

        if (!target) {
          bullet.z = nextZ;
          bullet.x = nextX;
          if (bullet.z < -55) bullet.active = false;
          return;
        }

        bullet.active = false;
        if (target.type === "gate") {
          const gateState = gateStates.current[target.gateIndex];
          const gate = gates[target.gateIndex];
          const valueKey = `${target.side}Value`;
          const increase = gate.hitStep * (bullet.rapid ? 2 : 1);
          gateState[valueKey] = clamp(
            gateState[valueKey] + increase,
            -99,
            gate.maxValue,
          );
          gateState[`${target.side}Hit`] = 1;
          spawnImpact(
            collisionX,
            bullet.y,
            target.z - 0.08,
            gateColor(gateState[valueKey]),
            0.27,
            1.15,
          );
          lastHit.current = {
            type: "gate",
            side: target.side,
            bulletX: collisionX,
            value: gateState[valueKey],
            at: state.clock.elapsedTime,
          };
          return;
        }

        if (target.type === "enemy") {
          const enemy = target.enemy;
          enemy.hp -= 1;
          enemy.hitAt = state.clock.elapsedTime;
          const waveState = waveStates.current[target.waveIndex];
          if (!waveState.alerted) {
            waveState.alerted = true;
            waveState.alertedAt = state.clock.elapsedTime;
            onEvent({ type: "wave-alert" });
          }
          lastHit.current = {
            type: "enemy",
            enemyId: enemy.id,
            enemyX: enemy.currentX,
            bulletX: collisionX,
            at: state.clock.elapsedTime,
          };
          lastEnemyHit.current = lastHit.current;
          spawnImpact(collisionX, bullet.y, target.z - 0.08, "#fff07a", 0.26, 1.2);
          if (enemy.hp <= 0) {
            enemy.alive = false;
            enemy.deathAt = state.clock.elapsedTime;
            const horizontal = clamp((enemy.currentX - collisionX) * 3, -1.8, 1.8);
            enemy.vx = horizontal + (enemy.currentX >= 0 ? 0.45 : -0.45);
            enemy.vy = 2.6 + Math.random() * 0.9;
            enemy.vz = 1.2 + Math.random() * 1.1;
            enemy.spinX = 5 + Math.random() * 5;
            enemy.spinY = 5 + Math.random() * 6;
            enemy.spinZ = (enemy.currentX >= 0 ? -1 : 1) * (6 + Math.random() * 5);
            const remaining = waveEnemies.current[target.waveIndex].some(
              (unit) => unit.alive,
            );
            if (
              !remaining &&
              !clearedWaves.current.has(target.waveIndex)
            ) {
              clearedWaves.current.add(target.waveIndex);
              combo.current += 1;
              onEvent({ type: "wave-clear", combo: combo.current });
            }
          }
          return;
        }

        bossHealth.current = Math.max(
          0,
          bossHealth.current - (bullet.rapid ? 0.34 : 0.22),
        );
        lastHit.current = {
          type: "boss",
          bulletX: collisionX,
          at: state.clock.elapsedTime,
        };
        if (state.clock.elapsedTime - bossHitAt.current > 0.1) {
          bossHitAt.current = state.clock.elapsedTime;
        }
        spawnImpact(collisionX, bullet.y, target.z - 0.75, "#fff08a", 0.34, 1.8);
        shake.current = Math.max(shake.current, 0.055);
      });

      gates.forEach((gate, index) => {
        const gateState = gateStates.current[index];
        const renderZ = distance.current - gate.z;
        if (!gateState.resolved && renderZ >= PLAYER_GATE_CONTACT_Z) {
          const side = playerX.current < 0 ? "left" : "right";
          const value = gateState[`${side}Value`];
          gateState.resolved = true;
          gateState.choice = side;
          gateState.resolvedAt = state.clock.elapsedTime;
          for (let burst = -1; burst <= 1; burst += 1) {
            spawnImpact(
              (side === "left" ? -LANE_X : LANE_X) + burst * 0.48,
              1.35 + Math.abs(burst) * 0.35,
              renderZ,
              gateColor(value),
              0.42,
              1.55,
            );
          }
          const previousTroops = troops.current;
          troops.current = clamp(troops.current + value, 0, 320);
          if (value > 0) {
            combo.current += 1;
            upgradePulse.current = {
              at: state.clock.elapsedTime,
              from: previousTroops,
              to: troops.current,
            };
          } else {
            combo.current = 1;
          }
          shake.current = value >= 0 ? 0.22 : 0.3;
          onEvent({
            type: "gate",
            value,
            label: formatGateValue(value),
            troops: troops.current,
            combo: combo.current,
          });
          if (troops.current <= 0 && !finished.current) {
            finished.current = true;
            onEvent({ type: "lost" });
          }
        }
      });

      if (!DEBUG_NO_ENEMIES) WAVES.forEach((wave, index) => {
        const renderZ =
          distance.current - wave.z + waveStates.current[index].advance;
        if (
          renderZ >= PLAYER_GATE_CONTACT_Z &&
          !resolvedWaves.current.has(index)
        ) {
          resolvedWaves.current.add(index);
          const survivors = waveEnemies.current[index].filter(
            (enemy) => enemy.alive,
          );
          if (survivors.length > 0) {
            const losses = Math.min(
              troops.current,
              Math.max(1, Math.ceil(survivors.length * 0.58)),
            );
            troops.current -= losses;
            survivors.forEach((enemy) => {
              enemy.alive = false;
              enemy.deathAt = state.clock.elapsedTime;
              enemy.vx = enemy.x * 0.8;
              enemy.vy = 1.8 + Math.random() * 0.5;
              enemy.vz = 1.2;
              enemy.spinX = 5;
              enemy.spinY = 6;
              enemy.spinZ = enemy.x >= 0 ? -7 : 7;
            });
            shake.current = 0.34;
            onEvent({ type: "wave-hit", losses, troops: troops.current });
          } else if (!clearedWaves.current.has(index)) {
            clearedWaves.current.add(index);
            combo.current += 1;
            onEvent({ type: "wave-clear", combo: combo.current });
          }
          if (troops.current <= 0 && !finished.current) {
            finished.current = true;
            onEvent({ type: "lost" });
          }
        }
      });

      if (distance.current >= TRACK_END && troops.current > 0) {
        bossActive.current = true;
        bossAttackTimer.current -= delta;
        if (bossAttackTimer.current <= 0 && bossHealth.current > 0) {
          bossAttackTimer.current = 1.35;
          const losses = Math.min(
            troops.current,
            Math.max(1, Math.ceil(1 + (100 - bossHealth.current) / 28)),
          );
          troops.current -= losses;
          shake.current = 0.24;
          onEvent({ type: "boss-hit", losses, troops: troops.current });
        }
        if (bossHealth.current <= 0 && !finished.current) {
          finished.current = true;
          onEvent({
            type: "won",
            troops: troops.current,
            combo: combo.current,
            score: Math.max(
              1000,
              Math.round(troops.current * combo.current * 125 + 10000),
            ),
          });
        } else if (troops.current <= 0 && !finished.current) {
          finished.current = true;
          onEvent({ type: "lost" });
        }
      }
    }

    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - delta);
      camera.position.x = (Math.random() - 0.5) * shake.current * 0.11;
      camera.position.y = 7.55 + (Math.random() - 0.5) * shake.current * 0.08;
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 10, delta);
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        7.55,
        10,
        delta,
      );
    }
    camera.lookAt(0, 0.42, -6.8);

    uiTimer.current += delta;
    if (uiTimer.current >= 0.1) {
      uiTimer.current = 0;
      onFrameData({
        troops: troops.current,
        combo: combo.current,
        bossHealth: bossHealth.current,
        progress: Math.min(100, (distance.current / TRACK_END) * 100),
        boss: bossActive.current,
        rapid: rapidRef.current,
        drones: drones.current,
      });
      if (import.meta.env.DEV) {
        window.__SKYLINE_DEBUG__ = {
          playerX: playerX.current,
          distance: distance.current,
          troops: troops.current,
          combo: combo.current,
          activeBullets: bullets.current.filter((bullet) => bullet.active).length,
          gateStates: gateStates.current.map((gate) => ({ ...gate })),
          aliveByWave: waveEnemies.current.map(
            (wave) => wave.filter((enemy) => enemy.alive).length,
          ),
          waveStates: waveStates.current.map((wave) => ({ ...wave })),
          lastHit: lastHit.current,
          lastEnemyHit: lastEnemyHit.current,
          movementSamples: [...movementSamples.current],
          fps: fpsCounter.current.value,
          debug: {
            slow: DEBUG_SLOW,
            noAdvance: DEBUG_NO_ADVANCE,
            stopAt: DEBUG_STOP_AT,
          },
        };
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#72d4e8"]} />
      <fog attach="fog" args={["#a8e6ef", 31, 92]} />
      <ambientLight intensity={0.52} color="#c8f7ff" />
      <hemisphereLight args={["#dfffff", "#075b79", 1.05]} />
      <directionalLight
        position={[-8, 18, 10]}
        intensity={1.7}
        color="#fff0c8"
      />

      <mesh position={[0, -2.35, -30]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[180, 240]} />
        <meshStandardMaterial color="#087b98" metalness={0.15} roughness={0.4} />
      </mesh>

      {[-74, -58, -42, -26, -10, 6].map((baseZ, index) => (
        <FloatingIsland
          key={baseZ}
          x={index % 2 ? 10.2 : -10.2}
          baseZ={baseZ}
          distanceRef={distance}
          scale={0.78 + (index % 3) * 0.18}
        />
      ))}

      <Road distanceRef={distance} />

      <mesh position={[-8.5, 4.6, -70]}>
        <torusGeometry args={[4.2, 0.24, 14, 60]} />
        <meshStandardMaterial
          color="#eaffff"
          emissive="#43e2ef"
          emissiveIntensity={0.68}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>

      {gates.map((gate, index) => (
        <GatePair
          key={gate.z}
          gate={gate}
          distanceRef={distance}
          playerXRef={playerX}
          stateRef={gateStates.current[index]}
        />
      ))}
      {!DEBUG_NO_ENEMIES && WAVES.map((wave, index) => (
        <EnemyWave
          key={wave.z}
          wave={wave}
          enemies={waveEnemies.current[index]}
          waveState={waveStates.current[index]}
          distanceRef={distance}
        />
      ))}
      <Boss
        distanceRef={distance}
        healthRef={bossHealth}
        activeRef={bossActive}
        hitRef={bossHitAt}
      />
      {!DEBUG_NO_ARMY && (
        <PlayerRig
          playerXRef={playerX}
          troopsRef={troops}
          dronesRef={drones}
          rapidRef={rapidRef}
          unitsRef={armyUnits}
          upgradePulseRef={upgradePulse}
          active={status === "playing"}
        />
      )}
      {!DEBUG_NO_PROJECTILES && <ProjectilePool bulletsRef={bullets} />}
      {!DEBUG_NO_EFFECTS && <ImpactPool impactsRef={impacts} />}
    </>
  );
}

function HUD({ data, status, sound, onPause, onSound, onFullscreen }) {
  return (
    <div className="hud" aria-live="polite">
      <div className="hud-top">
        <div className="squad-chip">
          <span className="eyebrow">SKY LEGION</span>
          <strong>{data.troops}</strong>
          <span className="unit-label">UNITS</span>
        </div>
        <div className="combo">
          <span>COMBO</span>
          <strong>×{data.combo}</strong>
          <div className="combo-line">
            <i style={{ width: `${Math.min(100, data.combo * 13)}%` }} />
          </div>
        </div>
        <div className="hud-actions">
          <button onClick={onSound} aria-label={sound ? "关闭声音" : "开启声音"}>
            {sound ? <SpeakerHigh weight="fill" /> : <SpeakerSlash weight="fill" />}
          </button>
          <button onClick={onFullscreen} aria-label="全屏">
            <ArrowsOutSimple weight="bold" />
          </button>
          <button
            onClick={onPause}
            aria-label={status === "paused" ? "继续" : "暂停"}
          >
            {status === "paused" ? <Play weight="fill" /> : <Pause weight="fill" />}
          </button>
        </div>
      </div>
      <div className={`boss-bar ${data.boss ? "is-visible" : ""}`}>
        <div className="boss-label">
          <span>AEGIS CORE</span>
          <b>{Math.ceil(data.bossHealth)}%</b>
        </div>
        <div className="boss-track">
          <i style={{ width: `${data.bossHealth}%` }} />
        </div>
      </div>
      <div className="route-progress">
        <i style={{ height: `${data.progress}%` }} />
      </div>
      {data.rapid && <div className="power-badge">RAPID FIRE</div>}
      {data.drones > 0 && <div className="drone-badge">DRONES ×{data.drones}</div>}
      {data.progress < 9 && (
        <div className="play-hint">左右移动 · 对准能量门持续充能</div>
      )}
    </div>
  );
}

function Intro({ best, onStart }) {
  return (
    <div className="screen intro-screen">
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="kicker">AZURE UTOPIA // SECTOR 07</p>
      <h1>
        SKYLINE
        <br />
        <em>LEGION</em>
      </h1>
      <p className="intro-copy">
        锁定能量门，扩张你的空中军团。
        <br />
        击溃敌群，摧毁天穹核心。
      </p>
      <button className="primary-button" onClick={onStart}>
        <span>开始突击</span>
        <Play weight="fill" />
      </button>
      <div className="control-hint">
        <div className="swipe-line">
          <i />
        </div>
        <span>拖动鼠标、手指，或使用 A / D</span>
      </div>
      <p className="build-tag">
        {best > 0 ? `BEST SCORE · ${best.toLocaleString()}` : "WEB STRIKE PROTOCOL · 02"}
      </p>
    </div>
  );
}

function EndScreen({ won, data, isRecord, onRestart }) {
  return (
    <div className={`screen end-screen ${won ? "victory" : "defeat"}`}>
      <p className="kicker">{won ? "MISSION COMPLETE" : "LEGION LOST"}</p>
      <h2>{won ? "天穹已净化" : "军团已覆灭"}</h2>
      <div className="result-number">
        {won ? data.score.toLocaleString() : Math.round(data.progress)}
      </div>
      <span className="result-label">{won ? "战斗评分" : "推进进度 %"}</span>
      <div className="result-stats">
        <div>
          <strong>{data.troops}</strong>
          <span>幸存单位</span>
        </div>
        <div>
          <strong>×{data.combo}</strong>
          <span>最高连击</span>
        </div>
      </div>
      {won && isRecord && <div className="new-record">NEW RECORD</div>}
      <button className="primary-button" onClick={onRestart}>
        <span>再次出击</span>
        <Play weight="fill" />
      </button>
    </div>
  );
}

export function App() {
  const [status, setStatus] = useState("menu");
  const [sound, setSound] = useState(!DEBUG_FLAGS.has("noAudio"));
  const [flash, setFlash] = useState(null);
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      const value = Number(localStorage.getItem("skyline-best"));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  });
  const [isRecord, setIsRecord] = useState(false);
  const [data, setData] = useState({
    troops: 12,
    combo: 1,
    bossHealth: 100,
    progress: 0,
    boss: false,
    rapid: false,
    drones: 0,
    score: 0,
  });
  const flashTimer = useRef();
  const audioContext = useRef();
  const bestRef = useRef(best);

  const playTone = useCallback(
    (
      frequency,
      duration = 0.08,
      type = "sine",
      volume = 0.035,
      delay = 0,
    ) => {
      if (!sound) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioContext.current) audioContext.current = new AudioContext();
      const context = audioContext.current;
      if (context.state === "suspended") context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(45, frequency * 0.72),
        start + duration,
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    },
    [sound],
  );

  const showFlash = useCallback((message, tone = "good", duration = 950) => {
    clearTimeout(flashTimer.current);
    setFlash({ message, tone, id: performance.now() });
    flashTimer.current = setTimeout(() => setFlash(null), duration);
  }, []);

  const handleEvent = useCallback(
    (event) => {
      if (event.type === "gate") {
        showFlash(
          `${event.label}  ·  ${event.troops} UNITS`,
          event.value >= 0 ? "good" : "danger",
        );
        if (event.value >= 0) {
          playTone(420, 0.11, "triangle", 0.045);
          playTone(680, 0.16, "sine", 0.04, 0.07);
        } else {
          playTone(125, 0.2, "sawtooth", 0.04);
        }
      } else if (event.type === "gate-miss") {
        showFlash("GATE MISSED", "danger");
        playTone(120, 0.18, "sawtooth", 0.035);
      } else if (event.type === "wave-clear") {
        showFlash("WAVE CLEAR", "good", 700);
        playTone(530, 0.1, "triangle", 0.028);
      } else if (event.type === "wave-alert") {
        playTone(190, 0.12, "square", 0.022);
        playTone(150, 0.15, "sawtooth", 0.018, 0.08);
      } else if (event.type === "wave-hit") {
        showFlash(`-${event.losses}  防线受损`, "danger");
        playTone(145, 0.15, "sawtooth", 0.04);
      } else if (event.type === "boss-hit") {
        showFlash(`CORE STRIKE  -${event.losses}`, "danger", 620);
        playTone(105, 0.13, "square", 0.03);
      } else if (event.type === "won") {
        const score = event.score;
        setData((current) => ({
          ...current,
          troops: event.troops,
          combo: event.combo,
          bossHealth: 0,
          progress: 100,
          score,
        }));
        const nextBest = Math.max(bestRef.current, score);
        setIsRecord(score > bestRef.current);
        bestRef.current = nextBest;
        setBest(nextBest);
        try {
          localStorage.setItem("skyline-best", String(nextBest));
        } catch {
          // The game remains playable when storage is unavailable.
        }
        playTone(440, 0.18, "triangle", 0.045);
        playTone(660, 0.22, "triangle", 0.045, 0.12);
        playTone(880, 0.34, "sine", 0.045, 0.25);
        setStatus("won");
      } else if (event.type === "lost") {
        playTone(180, 0.4, "sawtooth", 0.045);
        setStatus("lost");
      }
    },
    [playTone, showFlash],
  );

  const start = () => {
    playTone(520, 0.1, "triangle", 0.035);
    setData({
      troops: 12,
      combo: 1,
      bossHealth: 100,
      progress: 0,
      boss: false,
      rapid: false,
      drones: 0,
      score: 0,
    });
    setIsRecord(false);
    setFlash(null);
    setRunId((value) => value + 1);
    setStatus("playing");
  };

  const togglePause = () => {
    setStatus((current) => {
      if (current === "playing") return "paused";
      if (current === "paused") return "playing";
      return current;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleFrameData = useCallback((next) => {
    setData((current) => ({ ...current, ...next }));
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  useEffect(() => {
    if (status !== "playing" || !sound) return undefined;
    const timer = window.setInterval(() => {
      playTone(
        data.rapid ? 345 : 240,
        data.rapid ? 0.032 : 0.042,
        "square",
        data.rapid ? 0.009 : 0.006,
      );
    }, data.rapid ? 115 : 250);
    return () => window.clearInterval(timer);
  }, [data.rapid, playTone, sound, status]);

  return (
    <main className={`game-shell ${flash ? `feedback-${flash.tone}` : ""}`}>
      <Canvas
        key={runId}
        dpr={[1, 1.45]}
        camera={{ position: [0, 7.55, 11.4], fov: 49, near: 0.1, far: 190 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <Suspense fallback={null}>
          <World
            status={status}
            runSeed={runId}
            onFrameData={handleFrameData}
            onEvent={handleEvent}
          />
        </Suspense>
      </Canvas>

      {status !== "menu" && status !== "won" && status !== "lost" && (
        <HUD
          data={data}
          status={status}
          sound={sound}
          onPause={togglePause}
          onSound={() => setSound((value) => !value)}
          onFullscreen={toggleFullscreen}
        />
      )}
      {status === "menu" && <Intro best={best} onStart={start} />}
      {status === "paused" && (
        <div className="screen pause-screen">
          <p className="kicker">TACTICAL HOLD</p>
          <h2>突击暂停</h2>
          <button className="primary-button" onClick={togglePause}>
            <span>继续战斗</span>
            <Play weight="fill" />
          </button>
        </div>
      )}
      {(status === "won" || status === "lost") && (
        <EndScreen
          won={status === "won"}
          data={data}
          isRecord={isRecord}
          onRestart={start}
        />
      )}
      {flash && (
        <div key={flash.id} className={`impact-flash ${flash.tone}`}>
          {flash.message}
        </div>
      )}
      <div className="edge-glow" />
    </main>
  );
}
