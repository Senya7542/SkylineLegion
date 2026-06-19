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

const TRACK_END = 146;
const BOSS_Z = 155;
const PLAYER_LIMIT = 1.34;
const LANE_X = 1.62;

const GATES = [
  {
    z: 28,
    left: { label: "×2", value: 2, type: "multiply" },
    right: { label: "+18", value: 18, type: "add" },
  },
  {
    z: 64,
    left: { label: "+30", value: 30, type: "add" },
    right: { label: "×3", value: 3, type: "multiply" },
  },
  {
    z: 98,
    left: { label: "RAPID", value: 7, type: "rapid" },
    right: { label: "+45", value: 45, type: "add" },
  },
  {
    z: 128,
    left: { label: "×2", value: 2, type: "multiply" },
    right: { label: "DRONES", value: 3, type: "drone" },
  },
];

const WAVES = [
  { z: 46, count: 18 },
  { z: 81, count: 28 },
  { z: 113, count: 40 },
  { z: 140, count: 52 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const PLAYER_GATE_CONTACT_Z = 2.35;
const MAX_BULLETS = 96;
const MAX_IMPACTS = 28;
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

function Army({ troopsRef }) {
  const bodies = useRef();
  const heads = useRef();
  const guns = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    [bodies, heads, guns].forEach((ref) => {
      if (ref.current) {
        ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      }
    });
  }, []);

  useFrame((state) => {
    if (!bodies.current || !heads.current || !guns.current) return;
    const count = Math.min(troopsRef.current, 64);
    const columns = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(count))));
    for (let index = 0; index < 64; index += 1) {
      if (index >= count) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(index, dummy.matrix);
        heads.current.setMatrixAt(index, dummy.matrix);
        guns.current.setMatrixAt(index, dummy.matrix);
        continue;
      }
      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = (col - (columns - 1) / 2) * 0.31 + (row % 2 ? 0.15 : 0);
      const z = 3.02 - row * 0.42;
      const step =
        Math.abs(Math.sin(state.clock.elapsedTime * 8 + index * 0.7)) * 0.045;

      dummy.position.set(x, 0.58 + step, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.75, 0.75, 0.75);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, 0.84 + step, z);
      dummy.scale.setScalar(0.75);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x + 0.08, 0.65 + step, z - 0.08);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.setScalar(0.75);
      dummy.updateMatrix();
      guns.current.setMatrixAt(index, dummy.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    guns.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[null, null, 64]}>
        <capsuleGeometry args={[0.085, 0.2, 3, 7]} />
        <meshStandardMaterial
          color="#20bce9"
          emissive="#087eae"
          emissiveIntensity={0.18}
          metalness={0.4}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, 64]}>
        <sphereGeometry args={[0.115, 8, 8]} />
        <meshStandardMaterial
          color="#eaffff"
          emissive="#108bc7"
          emissiveIntensity={0.22}
        />
      </instancedMesh>
      <instancedMesh ref={guns} args={[null, null, 64]}>
        <cylinderGeometry args={[0.022, 0.03, 0.3, 6]} />
        <meshStandardMaterial color="#f1ffff" metalness={0.8} />
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

function PlayerRig({
  playerXRef,
  troopsRef,
  dronesRef,
  rapidRef,
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
      <Army troopsRef={troopsRef} />
      <DroneWing dronesRef={dronesRef} />
      <Hovercraft
        active={active}
        rapidRef={rapidRef}
        playerXRef={playerXRef}
      />
    </group>
  );
}

function ProjectilePool({ bulletsRef }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (mesh.current) {
      mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);
  useFrame(() => {
    if (!mesh.current) return;
    bulletsRef.current.forEach((bullet, index) => {
      if (!bullet.active) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(bullet.x, bullet.y, bullet.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, bullet.rapid ? 2.8 : 1.9);
      }
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[null, null, MAX_BULLETS]}>
      <sphereGeometry args={[0.045, 5, 5]} />
      <meshBasicMaterial color="#6cf4ff" toneMapped={false} />
    </instancedMesh>
  );
}

function ImpactPool({ impactsRef }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particlesPerImpact = 5;
  useEffect(() => {
    if (mesh.current) {
      mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);
  useFrame((_, delta) => {
    if (!mesh.current) return;
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
          mesh.current.setMatrixAt(matrixIndex, dummy.matrix);
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
        dummy.scale.setScalar(0.9 - progress * 0.55);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(matrixIndex, dummy.matrix);
      }
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[null, null, MAX_IMPACTS * particlesPerImpact]}
    >
      <octahedronGeometry args={[0.055, 0]} />
      <meshBasicMaterial color="#fff07a" toneMapped={false} />
    </instancedMesh>
  );
}

function ChargeBar({ stateRef, side, color }) {
  const fill = useRef();
  useFrame(() => {
    if (!fill.current) return;
    const width = 1.72 * clamp(stateRef[side], 0, 1);
    fill.current.scale.x = Math.max(0.01, width);
    fill.current.position.x = -0.86 + width / 2;
  });
  return (
    <group position={[0, 0.56, -0.03]}>
      <mesh>
        <boxGeometry args={[1.82, 0.09, 0.05]} />
        <meshBasicMaterial color="#062e40" transparent opacity={0.75} />
      </mesh>
      <mesh ref={fill} position={[-0.855, 0, -0.035]}>
        <boxGeometry args={[1, 0.07, 0.06]} />
        <meshBasicMaterial color={color} toneMapped={false} />
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
  const color =
    data.type === "rapid"
      ? "#eaff6c"
      : data.type === "drone"
        ? "#78a8ff"
        : "#35ecc9";

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
    stateRef[`${side}Hit`] = Math.max(0, hit - delta * 5.5);
    const bounce = hit > 0 ? Math.sin(hit * Math.PI) * 0.13 : 0;
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
      if (material) material.emissiveIntensity = selected ? 0.9 + hit * 3.2 : 0.55;
    });
  });

  return (
    <group ref={group} position={[x, 0, -50]}>
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[2.38, 2.7, 0.055]} />
        <meshStandardMaterial
          ref={panel}
          color={color}
          emissive={color}
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
            emissive={color}
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
          emissive={color}
          emissiveIntensity={0.65}
        />
      </mesh>
      <Text
        position={[0, 1.78, -0.08]}
        fontSize={data.label.length > 3 ? 0.4 : 0.7}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#075a76"
      >
        {data.label}
      </Text>
      <ChargeBar stateRef={stateRef} side={side} color={color} />
      <Text
        position={[0, 0.82, -0.08]}
        fontSize={0.16}
        color="#ddffff"
        anchorX="center"
      >
        FIRE TO CHARGE
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
        data={gate.left}
        side="left"
        distanceRef={distanceRef}
        playerXRef={playerXRef}
        stateRef={stateRef}
      />
      <Gate
        x={LANE_X}
        z={gate.z}
        data={gate.right}
        side="right"
        distanceRef={distanceRef}
        playerXRef={playerXRef}
        stateRef={stateRef}
      />
    </group>
  );
}

function EnemyWave({ wave, enemies, distanceRef }) {
  const bodies = useRef();
  const heads = useRef();
  const legs = useRef();
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
    enemies.forEach((enemy, index) => {
      const renderZ = distanceRef.current - wave.z - enemy.zOffset;
      let x = enemy.x;
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
        y += Math.abs(Math.sin(t * 5.5 + enemy.id)) * 0.07;
        rotationY = Math.sin(t * 2 + enemy.id) * 0.14;
        const hitAge = t - enemy.hitAt;
        hit = hitAge >= 0 && hitAge < 0.12 ? 1 - hitAge / 0.12 : 0;
        scaleX = 1 + hit * 0.12;
        scaleY = 1 - hit * 0.18;
        scaleZ = 1 + hit * 0.12;
      } else {
        const age = t - enemy.deathAt;
        visible = age >= 0 && age <= 0.78;
        if (visible) {
          x += enemy.vx * age;
          y += enemy.vy * age - 4.6 * age * age;
          z += enemy.vz * age;
          rotationX = age * enemy.spinX;
          rotationY = age * enemy.spinY;
          rotationZ = age * enemy.spinZ;
          scaleX = scaleY = scaleZ = Math.max(0.05, 1 - age / 0.82);
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
      bodyColor.set(hit > 0 ? "#fff4b0" : "#e54f32");
      bodies.current.setColorAt(index, bodyColor);

      dummy.position.set(x, y + 0.3 * scaleY, z);
      dummy.scale.setScalar(0.95 * scaleX);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, y - 0.12 * scaleY, z);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      legs.current.setMatrixAt(index, dummy.matrix);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    legs.current.instanceMatrix.needsUpdate = true;
    if (bodies.current.instanceColor) {
      bodies.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
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
          emissive="#ff4d24"
          emissiveIntensity={0.42}
        />
      </instancedMesh>
      <instancedMesh ref={legs} args={[null, null, enemies.length]}>
        <boxGeometry args={[0.38, 0.32, 0.07]} />
        <meshStandardMaterial color="#51222c" />
      </instancedMesh>
    </group>
  );
}

function Boss({ distanceRef, healthRef, activeRef }) {
  const ref = useRef();
  const coreMaterial = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const z = distanceRef.current - BOSS_Z;
    ref.current.position.z = z;
    ref.current.visible = distanceRef.current >= 135 && z > -40 && z < 8;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.65) * 0.08;
    if (coreMaterial.current) {
      coreMaterial.current.emissive.set(
        healthRef.current < 45 ? "#ff5a27" : "#00a7df",
      );
      coreMaterial.current.emissiveIntensity = activeRef.current
        ? 1.25 + (1 - healthRef.current / 100)
        : 0.45;
    }
  });

  return (
    <group ref={ref} position={[0, 1.08, -40]} visible={false}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[3.65, 1.18, 1.45]} />
        <meshBasicMaterial
          color="#176681"
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.48, -0.74]}>
        <boxGeometry args={[2.75, 0.34, 0.08]} />
        <meshBasicMaterial color="#38cce5" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.05, -0.8]}>
        <boxGeometry args={[2.5, 0.45, 0.15]} />
        <meshStandardMaterial
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
      {[-2.25, 2.25].map((side) => (
        <Float key={side} speed={2.4} rotationIntensity={0.2} floatIntensity={0.2}>
          <group position={[side, 0.3, 0]}>
            <mesh rotation={[0, 0, side > 0 ? -0.2 : 0.2]}>
              <octahedronGeometry args={[0.68, 0]} />
              <meshStandardMaterial
                color="#ffad3d"
                emissive="#ff551c"
                emissiveIntensity={1}
                metalness={0.45}
              />
            </mesh>
            <mesh position={[0, -0.55, 0]}>
              <cylinderGeometry args={[0.18, 0.24, 0.9, 8]} />
              <meshStandardMaterial
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

function World({ status, onFrameData, onEvent }) {
  const { camera, gl } = useThree();
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
    GATES.map(() => ({
      left: 0,
      right: 0,
      leftHit: 0,
      rightHit: 0,
      resolved: false,
      choice: null,
      resolvedAt: 0,
    })),
  );
  const waveEnemies = useRef(
    WAVES.map((wave, waveIndex) =>
      Array.from({ length: wave.count }, (_, index) => {
        const columns = 8;
        const row = Math.floor(index / columns);
        const col = index % columns;
        return {
          id: waveIndex * 100 + index,
          x: (col - (columns - 1) / 2) * 0.52 + (row % 2 ? 0.25 : 0),
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
      }),
    ),
  );
  const bullets = useRef(
    Array.from({ length: MAX_BULLETS }, () => ({
      active: false,
      x: 0,
      y: 0.75,
      z: 3.5,
      speed: 18,
      rapid: false,
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
    })),
  );
  const resolvedWaves = useRef(new Set());
  const clearedWaves = useRef(new Set());
  const bossActive = useRef(false);
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

  const spawnImpact = (x, y, z, color, duration = 0.24) => {
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
    });
  };

  const spawnVolley = (rapid) => {
    const count = clamp(2 + Math.floor(troops.current / 18), 2, 7);
    const spacing = count > 5 ? 0.18 : 0.21;
    for (let index = 0; index < count; index += 1) {
      const bullet = bullets.current.find((item) => !item.active);
      if (!bullet) break;
      bullet.active = true;
      bullet.x = playerX.current + (index - (count - 1) / 2) * spacing;
      bullet.y = 0.72 + (index % 2) * 0.045;
      bullet.z = 3.45 - (index % 3) * 0.04;
      bullet.speed = rapid ? 25 : 19;
      bullet.rapid = rapid;
    }
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
        const nextZ = oldZ - bullet.speed * delta;
        let target = null;
        let targetZ = -Infinity;

        GATES.forEach((gate, gateIndex) => {
          const gateState = gateStates.current[gateIndex];
          if (gateState.resolved) return;
          const z = distance.current - gate.z;
          const side = bullet.x < 0 ? "left" : "right";
          const laneCenter = side === "left" ? -LANE_X : LANE_X;
          if (
            z <= oldZ + 0.12 &&
            z >= nextZ - 0.12 &&
            Math.abs(bullet.x - laneCenter) <= 1.18 &&
            z > targetZ
          ) {
            target = { type: "gate", gateIndex, side, z };
            targetZ = z;
          }
        });

        if (!DEBUG_NO_ENEMIES) WAVES.forEach((wave, waveIndex) => {
          waveEnemies.current[waveIndex].forEach((enemy) => {
            if (!enemy.alive) return;
            const z = distance.current - wave.z - enemy.zOffset;
            if (
              z <= oldZ + 0.2 &&
              z >= nextZ - 0.2 &&
              Math.abs(bullet.x - enemy.x) <= 0.27 &&
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
            Math.abs(bullet.x) <= 2.15 &&
            z > targetZ
          ) {
            target = { type: "boss", z };
          }
        }

        if (!target) {
          bullet.z = nextZ;
          if (bullet.z < -55) bullet.active = false;
          return;
        }

        bullet.active = false;
        if (target.type === "gate") {
          const gateState = gateStates.current[target.gateIndex];
          const damage = bullet.rapid ? 0.065 : 0.05;
          gateState[target.side] = clamp(
            gateState[target.side] + damage,
            0,
            1,
          );
          gateState[`${target.side}Hit`] = 1;
          spawnImpact(
            bullet.x,
            bullet.y,
            target.z - 0.08,
            target.side === "left" ? "#68ffdc" : "#7aeaff",
          );
          lastHit.current = {
            type: "gate",
            side: target.side,
            bulletX: bullet.x,
            at: state.clock.elapsedTime,
          };
          return;
        }

        if (target.type === "enemy") {
          const enemy = target.enemy;
          enemy.hp -= 1;
          enemy.hitAt = state.clock.elapsedTime;
          lastHit.current = {
            type: "enemy",
            enemyId: enemy.id,
            enemyX: enemy.x,
            bulletX: bullet.x,
            at: state.clock.elapsedTime,
          };
          lastEnemyHit.current = lastHit.current;
          spawnImpact(bullet.x, bullet.y, target.z - 0.08, "#ffe56a", 0.2);
          if (enemy.hp <= 0) {
            enemy.alive = false;
            enemy.deathAt = state.clock.elapsedTime;
            const horizontal = clamp((enemy.x - bullet.x) * 3, -1.8, 1.8);
            enemy.vx = horizontal + (enemy.x >= 0 ? 0.45 : -0.45);
            enemy.vy = 2.6 + Math.random() * 0.9;
            enemy.vz = 1.2 + Math.random() * 1.1;
            enemy.spinX = 5 + Math.random() * 5;
            enemy.spinY = 5 + Math.random() * 6;
            enemy.spinZ = (enemy.x >= 0 ? -1 : 1) * (6 + Math.random() * 5);
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
          bossHealth.current - (bullet.rapid ? 0.72 : 0.55),
        );
        lastHit.current = {
          type: "boss",
          bulletX: bullet.x,
          at: state.clock.elapsedTime,
        };
        spawnImpact(bullet.x, bullet.y, target.z - 0.75, "#ffb34c", 0.28);
        shake.current = Math.max(shake.current, 0.035);
      });

      GATES.forEach((gate, index) => {
        const gateState = gateStates.current[index];
        const renderZ = distance.current - gate.z;
        if (!gateState.resolved && renderZ >= PLAYER_GATE_CONTACT_Z) {
          const side = playerX.current < 0 ? "left" : "right";
          const choice = gate[side];
          const charge = gateState[side];
          gateState.resolved = true;
          gateState.choice = side;
          gateState.resolvedAt = state.clock.elapsedTime;
          for (let burst = -1; burst <= 1; burst += 1) {
            spawnImpact(
              (side === "left" ? -LANE_X : LANE_X) + burst * 0.48,
              1.35 + Math.abs(burst) * 0.35,
              renderZ,
              choice.type === "rapid" ? "#efff72" : "#65ffe1",
              0.34,
            );
          }
          if (charge < 0.28) {
            combo.current = 1;
            onEvent({ type: "gate-miss" });
            return;
          }
          if (choice.type === "multiply") {
            troops.current = Math.min(320, troops.current * choice.value);
          } else if (choice.type === "add") {
            troops.current = Math.min(320, troops.current + choice.value);
          } else if (choice.type === "rapid") {
            rapidUntil.current = state.clock.elapsedTime + choice.value;
          } else if (choice.type === "drone") {
            drones.current = Math.min(5, drones.current + choice.value);
          }
          combo.current += 1;
          shake.current = 0.2;
          onEvent({
            type: "gate",
            label: choice.label,
            troops: troops.current,
            combo: combo.current,
          });
        }
      });

      if (!DEBUG_NO_ENEMIES) WAVES.forEach((wave, index) => {
        const renderZ = distance.current - wave.z;
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

      {GATES.map((gate, index) => (
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
          distanceRef={distance}
        />
      ))}
      <Boss
        distanceRef={distance}
        healthRef={bossHealth}
        activeRef={bossActive}
      />
      {!DEBUG_NO_ARMY && (
        <PlayerRig
          playerXRef={playerX}
          troopsRef={troops}
          dronesRef={drones}
          rapidRef={rapidRef}
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
        showFlash(`${event.label}  ·  ${event.troops} UNITS`);
        playTone(420, 0.11, "triangle", 0.045);
        playTone(680, 0.16, "sine", 0.04, 0.07);
      } else if (event.type === "gate-miss") {
        showFlash("GATE MISSED", "danger");
        playTone(120, 0.18, "sawtooth", 0.035);
      } else if (event.type === "wave-clear") {
        showFlash("WAVE CLEAR", "good", 700);
        playTone(530, 0.1, "triangle", 0.028);
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
