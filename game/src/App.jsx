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

function Hovercraft({ x, active, rapid }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = 0.48 + Math.sin(t * 5.5) * 0.04;
    ref.current.rotation.z = THREE.MathUtils.lerp(
      ref.current.rotation.z,
      -x * 0.045,
      0.08,
    );
  });

  return (
    <group ref={ref} position={[x, 0.5, 4.35]}>
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
        color={rapid ? "#efff72" : "#59eaff"}
        intensity={active ? (rapid ? 5 : 3) : 0.5}
        distance={4}
      />
    </group>
  );
}

function Trooper({ index, count }) {
  const ref = useRef();
  const columns = 8;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const visible = index < Math.min(count, 64);
  const visibleColumns = Math.min(columns, Math.max(4, Math.ceil(Math.sqrt(count))));
  const centeredCol = (col % visibleColumns) - (visibleColumns - 1) / 2;
  const x = centeredCol * 0.31 + (row % 2 ? 0.15 : 0);
  const z = 3.02 - row * 0.42;

  useFrame((state) => {
    if (!ref.current || !visible) return;
    ref.current.position.y =
      0.28 + Math.abs(Math.sin(state.clock.elapsedTime * 8 + index * 0.7)) * 0.045;
  });

  if (!visible) return null;
  return (
    <group ref={ref} position={[x, 0.28, z]} scale={0.75}>
      <mesh position={[0, 0.3, 0]}>
        <capsuleGeometry args={[0.085, 0.2, 3, 7]} />
        <meshStandardMaterial
          color={index % 7 === 0 ? "#e8ffff" : "#20bce9"}
          emissive="#087eae"
          emissiveIntensity={0.18}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <sphereGeometry args={[0.115, 9, 9]} />
        <meshStandardMaterial
          color="#eaffff"
          emissive="#108bc7"
          emissiveIntensity={0.22}
        />
      </mesh>
      <mesh position={[0.11, 0.37, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.03, 0.3, 6]} />
        <meshStandardMaterial color="#f1ffff" metalness={0.8} />
      </mesh>
    </group>
  );
}

function Army({ x, count }) {
  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: 64 }, (_, index) => (
        <Trooper key={index} index={index} count={count} />
      ))}
    </group>
  );
}

function DroneWing({ x, count }) {
  if (!count) return null;
  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: count }, (_, index) => {
        const side = index % 2 ? -1 : 1;
        return (
          <Float
            key={index}
            speed={3.2 + index}
            rotationIntensity={0.25}
            floatIntensity={0.28}
          >
            <group
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
      })}
    </group>
  );
}

function BulletStream({ x, rapid, active }) {
  const ref = useRef();
  const bullets = useMemo(() => Array.from({ length: 32 }), []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.visible = active;
    if (!active) return;
    const speed = rapid ? 24 : 16;
    const visibleCount = rapid ? 32 : 20;
    ref.current.children.forEach((bullet, index) => {
      bullet.visible = index < visibleCount;
      bullet.position.x = x + ((index % 5) - 2) * (rapid ? 0.15 : 0.1);
      bullet.position.y = 0.72 + (index % 3) * 0.035;
      bullet.position.z =
        3.8 - ((state.clock.elapsedTime * speed + index * 1.05) % 35);
      bullet.scale.z = rapid ? 2.7 : 1.8;
    });
  });

  return (
    <group ref={ref}>
      {bullets.map((_, index) => (
        <mesh key={index}>
          <sphereGeometry args={[rapid ? 0.05 : 0.04, 5, 5]} />
          <meshBasicMaterial
            color={index % 4 === 0 ? "#f0ff75" : "#6cf4ff"}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ChargeBar({ charge, color }) {
  const width = 1.72 * clamp(charge, 0, 1);
  return (
    <group position={[0, 0.56, -0.03]}>
      <mesh>
        <boxGeometry args={[1.82, 0.09, 0.05]} />
        <meshBasicMaterial color="#062e40" transparent opacity={0.75} />
      </mesh>
      <mesh position={[-0.86 + width / 2, 0, -0.035]}>
        <boxGeometry args={[Math.max(0.01, width), 0.07, 0.06]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Gate({
  x,
  z,
  data,
  distance,
  selected,
  charge,
  resolved,
  chosen,
}) {
  const renderZ = distance - z;
  const approaching = renderZ > -24 && renderZ < -2;
  const isChosen = resolved && chosen;
  const color =
    data.type === "rapid"
      ? "#eaff6c"
      : data.type === "drone"
        ? "#78a8ff"
        : "#35ecc9";
  const panelOpacity = approaching ? (selected ? 0.16 : 0.07) : 0.08;

  return (
    <group
      position={[x, 0, renderZ]}
      visible={renderZ > -72 && renderZ < 7 && (!resolved || renderZ < 1.5)}
    >
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[2.38, 2.7, 0.055]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected && approaching ? 1.4 : 0.65}
          transparent
          opacity={isChosen ? 0.24 : panelOpacity}
          depthWrite={false}
        />
      </mesh>
      {[-1.19, 1.19].map((side) => (
        <mesh key={side} position={[side, 1.45, 0]}>
          <boxGeometry args={[0.12, 2.95, 0.18]} />
          <meshStandardMaterial
            color="#e9ffff"
            emissive={color}
            emissiveIntensity={selected ? 1.35 : 0.75}
            metalness={0.48}
          />
        </mesh>
      ))}
      <mesh position={[0, 2.89, 0]}>
        <boxGeometry args={[2.5, 0.14, 0.18]} />
        <meshStandardMaterial
          color="#eaffff"
          emissive={color}
          emissiveIntensity={selected ? 1.3 : 0.7}
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
      <ChargeBar charge={charge} color={color} />
      <Text
        position={[0, 0.82, -0.08]}
        fontSize={0.16}
        color="#ddffff"
        anchorX="center"
      >
        {charge >= 0.98 ? "READY" : selected && approaching ? "CHARGING" : "SELECT"}
      </Text>
      {selected && approaching && (
        <Sparkles
          count={22}
          scale={[2.3, 2.8, 0.35]}
          size={3}
          speed={1.7}
          color={color}
        />
      )}
    </group>
  );
}

function GatePair({ gate, index, distance, playerX, state }) {
  return (
    <group>
      <Gate
        x={-LANE_X}
        z={gate.z}
        data={gate.left}
        distance={distance}
        selected={playerX < 0}
        charge={state.left}
        resolved={state.resolved}
        chosen={state.choice === "left"}
      />
      <Gate
        x={LANE_X}
        z={gate.z}
        data={gate.right}
        distance={distance}
        selected={playerX >= 0}
        charge={state.right}
        resolved={state.resolved}
        chosen={state.choice === "right"}
      />
      {!state.resolved && gate.z - distance < 17 && gate.z - distance > 4 && (
        <Text
          position={[0, 3.55, distance - gate.z]}
          fontSize={0.22}
          color="#ffffff"
          anchorX="center"
          outlineWidth={0.018}
          outlineColor="#0b5971"
        >
          GATE {index + 1}
        </Text>
      )}
    </group>
  );
}

function Enemy({ index, x, z, visible, active }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current || !visible) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = 0.3 + Math.abs(Math.sin(t * 5.5 + index)) * 0.07;
    ref.current.rotation.y = Math.sin(t * 2 + index) * 0.14;
  });

  if (!visible) return null;
  return (
    <group ref={ref} position={[x, 0.3, z]} scale={active ? 1 : 0.92}>
      <mesh>
        <dodecahedronGeometry args={[0.23, 0]} />
        <meshStandardMaterial
          color="#e54f32"
          emissive="#681109"
          emissiveIntensity={0.38}
          metalness={0.48}
          roughness={0.32}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial
          color="#ffbc83"
          emissive="#ff4d24"
          emissiveIntensity={0.42}
        />
      </mesh>
      {[-0.21, 0.21].map((side) => (
        <mesh key={side} position={[side, -0.12, 0]}>
          <boxGeometry args={[0.07, 0.32, 0.07]} />
          <meshStandardMaterial color="#51222c" />
        </mesh>
      ))}
    </group>
  );
}

function EnemyWave({ wave, alive, distance }) {
  const renderZ = distance - wave.z;
  const totalVisible = Math.min(32, wave.count);
  const aliveVisible = Math.ceil((alive / wave.count) * totalVisible);
  const active = renderZ > -30 && renderZ < -3;

  return (
    <group visible={renderZ > -64 && renderZ < 8}>
      {Array.from({ length: totalVisible }, (_, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        return (
          <Enemy
            key={index}
            index={index}
            visible={index < aliveVisible}
            active={active}
            x={(col - 3.5) * 0.52 + (row % 2 ? 0.25 : 0)}
            z={renderZ - row * 0.46}
          />
        );
      })}
      {active && aliveVisible > 0 && (
        <Sparkles
          position={[0, 0.55, renderZ]}
          count={Math.min(42, 10 + aliveVisible)}
          scale={[4.2, 1.6, 2]}
          size={2.6}
          speed={2}
          color="#ffe061"
        />
      )}
    </group>
  );
}

function Boss({ distance, health, active }) {
  const z = distance - BOSS_Z;
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.65) * 0.08;
  });

  if (distance < 135) return null;
  return (
    <group ref={ref} position={[0, 1.08, z]} visible={z > -40 && z < 8}>
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
          emissiveIntensity={active ? 1.8 : 0.8}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <icosahedronGeometry args={[0.92, 1]} />
        <meshStandardMaterial
          color="#ecffff"
          emissive={health < 45 ? "#ff5a27" : "#00a7df"}
          emissiveIntensity={active ? 1.25 + (1 - health / 100) : 0.45}
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
                emissiveIntensity={active ? 1.4 : 0.6}
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
      {active && (
        <Sparkles
          count={health < 45 ? 70 : 35}
          scale={[5, 4, 2.5]}
          size={4}
          speed={1.7}
          color={health < 45 ? "#ff7b42" : "#58eaff"}
        />
      )}
    </group>
  );
}

function FloatingIsland({ x, z, scale = 1 }) {
  return (
    <group position={[x, -1.7, z]} scale={scale}>
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

function World({ status, onFrameData, onEvent }) {
  const { pointer, camera } = useThree();
  const playerX = useRef(0);
  const distance = useRef(0);
  const troops = useRef(12);
  const combo = useRef(1);
  const bossHealth = useRef(100);
  const rapidUntil = useRef(0);
  const drones = useRef(0);
  const gateStates = useRef(
    GATES.map(() => ({ left: 0, right: 0, resolved: false, choice: null })),
  );
  const waveAlive = useRef(WAVES.map((wave) => wave.count));
  const resolvedWaves = useRef(new Set());
  const bossActive = useRef(false);
  const bossAttackTimer = useRef(1.2);
  const finished = useRef(false);
  const shake = useRef(0);
  const uiTimer = useRef(0);
  const keyboard = useRef({ left: false, right: false });

  const [render, setRender] = useState({
    x: 0,
    distance: 0,
    troops: 12,
    combo: 1,
    bossHealth: 100,
    rapid: false,
    drones: 0,
    gates: gateStates.current,
    waves: waveAlive.current,
    boss: false,
  });

  useEffect(() => {
    const down = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keyboard.current.left = true;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
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
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((state, delta) => {
    const playing = status === "playing" && !finished.current;
    let targetX = clamp(pointer.x * PLAYER_LIMIT, -PLAYER_LIMIT, PLAYER_LIMIT);
    if (keyboard.current.left) targetX = -PLAYER_LIMIT;
    if (keyboard.current.right) targetX = PLAYER_LIMIT;
    if (playing) {
      playerX.current = THREE.MathUtils.lerp(playerX.current, targetX, 0.12);
    }

    if (playing) {
      const rapid = rapidUntil.current > state.clock.elapsedTime;
      if (!bossActive.current) {
        distance.current = Math.min(
          TRACK_END,
          distance.current + delta * (rapid ? 7.2 : 6.15),
        );
      }

      GATES.forEach((gate, index) => {
        const gateState = gateStates.current[index];
        const localZ = gate.z - distance.current;
        if (!gateState.resolved && localZ < 24 && localZ > 3.2) {
          const side = playerX.current < 0 ? "left" : "right";
          const laneCenter = side === "left" ? -LANE_X : LANE_X;
          const alignment = 1 - clamp(Math.abs(playerX.current - laneCenter) / 1.8, 0, 1);
          gateState[side] = clamp(
            gateState[side] + delta * (rapid ? 0.95 : 0.7) * (0.35 + alignment),
            0,
            1,
          );
        }
        if (!gateState.resolved && localZ <= 3.2) {
          const side = playerX.current < 0 ? "left" : "right";
          const choice = gate[side];
          const charge = gateState[side];
          gateState.resolved = true;
          gateState.choice = side;
          if (charge < 0.36) {
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
          shake.current = 0.22;
          onEvent({
            type: "gate",
            label: choice.label,
            troops: troops.current,
            combo: combo.current,
          });
        }
      });

      WAVES.forEach((wave, index) => {
        const localZ = wave.z - distance.current;
        if (localZ < 31 && localZ > 3.5 && waveAlive.current[index] > 0) {
          const firePower =
            1.5 + troops.current * 0.042 + drones.current * 0.7 + (rapid ? 3.8 : 0);
          waveAlive.current[index] = Math.max(
            0,
            waveAlive.current[index] - firePower * delta,
          );
        }
        if (localZ <= 3.5 && !resolvedWaves.current.has(index)) {
          resolvedWaves.current.add(index);
          const survivors = Math.ceil(waveAlive.current[index]);
          if (survivors > 0) {
            const losses = Math.min(
              troops.current,
              Math.max(1, Math.ceil(survivors * 0.62)),
            );
            troops.current -= losses;
            shake.current = 0.38;
            onEvent({ type: "wave-hit", losses, troops: troops.current });
          } else {
            combo.current += 1;
            onEvent({ type: "wave-clear", combo: combo.current });
          }
          waveAlive.current[index] = 0;
          if (troops.current <= 0 && !finished.current) {
            finished.current = true;
            onEvent({ type: "lost" });
          }
        }
      });

      if (distance.current >= TRACK_END && troops.current > 0) {
        bossActive.current = true;
        bossAttackTimer.current -= delta;
        const bossDps =
          3.8 + troops.current * 0.085 + drones.current * 1.25 + (rapid ? 2.5 : 0);
        bossHealth.current = Math.max(0, bossHealth.current - bossDps * delta);
        shake.current = Math.max(shake.current, 0.025);

        if (bossAttackTimer.current <= 0 && bossHealth.current > 0) {
          bossAttackTimer.current = 1.35;
          const losses = Math.min(
            troops.current,
            Math.max(1, Math.ceil(1 + (100 - bossHealth.current) / 28)),
          );
          troops.current -= losses;
          shake.current = 0.25;
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
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.08);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 7.55, 0.08);
    }
    camera.lookAt(0, 0.42, -6.8);

    uiTimer.current += delta;
    if (uiTimer.current >= 0.1) {
      uiTimer.current = 0;
      const next = {
        x: playerX.current,
        distance: distance.current,
        troops: troops.current,
        combo: combo.current,
        bossHealth: bossHealth.current,
        rapid: rapidUntil.current > state.clock.elapsedTime,
        drones: drones.current,
        gates: gateStates.current.map((gate) => ({ ...gate })),
        waves: [...waveAlive.current],
        boss: bossActive.current,
      };
      setRender(next);
      onFrameData({
        troops: next.troops,
        combo: next.combo,
        bossHealth: next.bossHealth,
        progress: Math.min(100, (next.distance / TRACK_END) * 100),
        boss: next.boss,
        rapid: next.rapid,
        drones: next.drones,
      });
    }
  });

  const roadOffset = render.distance % 8;
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

      {[-74, -58, -42, -26, -10, 6].map((z, index) => (
        <FloatingIsland
          key={z}
          x={index % 2 ? 10.2 : -10.2}
          z={z + (render.distance % 48)}
          scale={0.78 + (index % 3) * 0.18}
        />
      ))}

      <group position={[0, 0, roadOffset]}>
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
          index={index}
          distance={render.distance}
          playerX={render.x}
          state={render.gates[index]}
        />
      ))}
      {WAVES.map((wave, index) => (
        <EnemyWave
          key={wave.z}
          wave={wave}
          alive={render.waves[index]}
          distance={render.distance}
        />
      ))}
      <Boss
        distance={render.distance}
        health={render.bossHealth}
        active={render.boss}
      />

      <Army x={render.x} count={render.troops} />
      <DroneWing x={render.x} count={render.drones} />
      <Hovercraft x={render.x} active={status === "playing"} rapid={render.rapid} />
      <BulletStream
        x={render.x}
        rapid={render.rapid}
        active={status === "playing"}
      />
      {render.rapid && (
        <Sparkles
          count={65}
          scale={[6.2, 3.5, 18]}
          position={[0, 1.1, -6]}
          size={2.8}
          speed={2.8}
          color="#eaff75"
        />
      )}
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
  const [sound, setSound] = useState(true);
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
