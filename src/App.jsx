import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
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
  useLayoutEffect,
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
  findNearestArmyUnit,
  killArmyUnit,
  killArmyUnits,
  updateArmyUnits,
} from "./gameSystems.js";
import { ENTITY_VISUALS } from "./entityVisuals.js";

const DEBUG_PARAMS =
  !import.meta.env.DEV || typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
const DEBUG_FLAG_BUNDLE = new Set(
  (DEBUG_PARAMS.get("flags") || "")
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean),
);
const DEBUG_FLAGS = {
  has: (flag) => DEBUG_PARAMS.has(flag) || DEBUG_FLAG_BUNDLE.has(flag),
  get: (flag) => DEBUG_PARAMS.get(flag),
};
const DEBUG_NO_ENEMIES = DEBUG_FLAGS.has("noEnemies");
const DEBUG_NO_EFFECTS = DEBUG_FLAGS.has("noEffects");
const DEBUG_NO_ARMY = DEBUG_FLAGS.has("noArmy");
const DEBUG_NO_PROJECTILES = DEBUG_FLAGS.has("noProjectiles");
const DEBUG_NO_PHYSICS = DEBUG_FLAGS.has("noPhysics");
const DEBUG_SLOW = DEBUG_FLAGS.has("slow");
const DEBUG_NO_ADVANCE = DEBUG_FLAGS.has("noAdvance");
const DEBUG_STOP_AT = Number(DEBUG_FLAGS.get("stopAt")) || null;
const DEBUG_START_AT = Number(DEBUG_FLAGS.get("startAt")) || 0;
const DEBUG_BOSS_TEST = DEBUG_FLAGS.has("bossTest");
const DEBUG_BOSS_PIN = DEBUG_FLAGS.has("bossPin");
const DEBUG_ENEMY_RUSH = DEBUG_FLAGS.has("enemyRush");
const MAX_BOSS_PROJECTILES = 36;
const FEEDBACK_COLOR_ATTRIBUTE = "instanceFeedback";
const FEEDBACK_GREY_ATTRIBUTE = "instanceGrey";
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

function setupFeedbackAttributes(mesh, count) {
  if (!mesh?.geometry) return;
  const feedback = new THREE.InstancedBufferAttribute(
    new Float32Array(count * 4),
    4,
  );
  const grey = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  feedback.setUsage(THREE.DynamicDrawUsage);
  grey.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute(FEEDBACK_COLOR_ATTRIBUTE, feedback);
  mesh.geometry.setAttribute(FEEDBACK_GREY_ATTRIBUTE, grey);
}

function setFeedback(mesh, index, color, amount, greyAmount) {
  const feedback = mesh.geometry.getAttribute(FEEDBACK_COLOR_ATTRIBUTE);
  const grey = mesh.geometry.getAttribute(FEEDBACK_GREY_ATTRIBUTE);
  if (!feedback || !grey) return;
  feedback.setXYZW(index, color.r, color.g, color.b, amount);
  grey.setX(index, greyAmount);
}

function markFeedbackForUpdate(mesh) {
  const feedback = mesh.geometry.getAttribute(FEEDBACK_COLOR_ATTRIBUTE);
  const grey = mesh.geometry.getAttribute(FEEDBACK_GREY_ATTRIBUTE);
  if (feedback) feedback.needsUpdate = true;
  if (grey) grey.needsUpdate = true;
}

function FeedbackMaterial({ greyColor, cacheKey, ...props }) {
  const patchShader = useMemo(() => {
    const grey = new THREE.Color(greyColor);
    return (shader) => {
      shader.vertexShader = `
        attribute vec4 ${FEEDBACK_COLOR_ATTRIBUTE};
        attribute float ${FEEDBACK_GREY_ATTRIBUTE};
        varying vec4 vInstanceFeedback;
        varying float vInstanceGrey;
      ${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vInstanceFeedback = ${FEEDBACK_COLOR_ATTRIBUTE};
        vInstanceGrey = ${FEEDBACK_GREY_ATTRIBUTE};`,
      );
      shader.fragmentShader = `
        varying vec4 vInstanceFeedback;
        varying float vInstanceGrey;
      ${shader.fragmentShader}`.replace(
        "#include <dithering_fragment>",
        `
        float feedbackAmount = smoothstep(0.0, 1.0, vInstanceFeedback.a);
        gl_FragColor.rgb = mix(
          gl_FragColor.rgb,
          min(vec3(1.0), vInstanceFeedback.rgb * (1.0 + feedbackAmount * 1.25)),
          feedbackAmount
        );
        gl_FragColor.rgb += vInstanceFeedback.rgb * feedbackAmount * (1.0 - vInstanceGrey) * 0.55;
        gl_FragColor.rgb = mix(
          gl_FragColor.rgb,
          vec3(${grey.r.toFixed(5)}, ${grey.g.toFixed(5)}, ${grey.b.toFixed(5)}),
          smoothstep(0.0, 1.0, vInstanceGrey)
        );
        #include <dithering_fragment>`,
      );
    };
  }, [greyColor]);
  const programKey = useCallback(
    () => `instanced-feedback-${cacheKey}-${greyColor}`,
    [cacheKey, greyColor],
  );

  return (
    <meshStandardMaterial
      {...props}
      onBeforeCompile={patchShader}
      customProgramCacheKey={programKey}
    />
  );
}

function Hovercraft({ active, rapidRef, playerXRef, cannonPulseRef }) {
  const ref = useRef();
  const cannon = useRef();
  const cannonMaterial = useRef();
  const engineMaterials = useRef([]);
  const previousX = useRef(0);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const velocity = (playerXRef.current - previousX.current) / Math.max(delta, 0.001);
    previousX.current = playerXRef.current;
    ref.current.position.y = 1.02 + Math.sin(t * 5.5) * 0.04;
    ref.current.rotation.z = THREE.MathUtils.damp(
      ref.current.rotation.z,
      clamp(-velocity * 0.045, -0.16, 0.16),
      10,
      delta,
    );
    const cannonAge = t - cannonPulseRef.current;
    const cannonKick =
      cannonAge >= 0 && cannonAge < 0.24
        ? Math.sin((cannonAge / 0.24) * Math.PI) * 0.26
        : 0;
    if (cannon.current) cannon.current.position.z = -0.88 + cannonKick;
    if (cannonMaterial.current) {
      cannonMaterial.current.emissiveIntensity = 0.8 + cannonKick * 12;
    }
    engineMaterials.current.forEach((material) => {
      if (material) material.opacity = active ? 0.86 + Math.sin(t * 18) * 0.1 : 0.3;
    });
  });

  return (
    <group ref={ref} position={[0, 1.02, 3.72]}>
      <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
        <octahedronGeometry args={[0.78, 0]} />
        <meshStandardMaterial
          color="#17384f"
          emissive="#061b2c"
          emissiveIntensity={0.35}
          metalness={0.82}
          roughness={0.18}
        />
      </mesh>
      <mesh
        position={[0, 0.26, 0.08]}
        scale={[0.7, 0.58, 1.05]}
        castShadow
      >
        <sphereGeometry args={[0.48, 12, 8]} />
        <meshStandardMaterial
          color="#078dc8"
          emissive="#0a7eb5"
          emissiveIntensity={0.45}
          metalness={0.65}
          roughness={0.2}
        />
      </mesh>
      <mesh
        ref={cannon}
        position={[0, 0.34, -0.88]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.11, 0.15, 1.42, 12]} />
        <meshStandardMaterial
          ref={cannonMaterial}
          color="#203346"
          emissive="#ffb72d"
          emissiveIntensity={1.2}
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>
      <mesh
        position={[0, 0.34, -1.61]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.115, 0.032, 8, 20]} />
        <meshBasicMaterial color="#ffd23f" toneMapped={false} />
      </mesh>
      {[-1, 1].map((side, sideIndex) => (
        <group
          key={side}
          position={[side * 0.83, -0.02, 0.12]}
          rotation={[0, side * -0.18, side * -0.04]}
        >
          <mesh rotation={[0, 0, side * 0.08]} castShadow>
            <boxGeometry args={[0.78, 0.11, 1.16]} />
            <meshStandardMaterial
              color="#254c67"
              emissive="#0b83bd"
              emissiveIntensity={0.72}
              metalness={0.82}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[side * 0.08, -0.08, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.17, 0.85, 10]} />
            <meshBasicMaterial
              ref={(material) => {
                engineMaterials.current[sideIndex] = material;
              }}
              color="#7ff8ff"
              transparent
              opacity={0.86}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
      <pointLight
        position={[0, 0.25, -1.08]}
        color={rapidRef.current ? "#fff06a" : "#ffd84d"}
        intensity={active ? (rapidRef.current ? 5 : 3) : 0.5}
        distance={4}
      />
    </group>
  );
}

function Army({ troopsRef, unitsRef, upgradePulseRef, active }) {
  const bodies = useRef();
  const heads = useRef();
  const shoulders = useRef();
  const visors = useRef();
  const boots = useRef();
  const guns = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const feedbackColor = useMemo(() => new THREE.Color(), []);
  const playerBodyBase = useMemo(() => new THREE.Color("#37d4ff"), []);
  const playerBodyGrey = useMemo(() => new THREE.Color("#94a0a8"), []);
  const previousCount = useRef(0);

  useLayoutEffect(() => {
    [bodies, heads, shoulders, visors, boots, guns].forEach((ref) => {
      if (ref.current) {
        ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        setupFeedbackAttributes(ref.current, MAX_VISIBLE_TROOPS);
      }
    });
  }, []);

  useFrame((state, delta) => {
    if (!active) return;
    if (
      !bodies.current ||
      !heads.current ||
      !shoulders.current ||
      !visors.current ||
      !boots.current ||
      !guns.current
    ) return;
    const time = state.clock.elapsedTime;
    const count = Math.min(troopsRef.current, MAX_VISIBLE_TROOPS);

    if (count > previousCount.current) {
      const pulse = upgradePulseRef.current;
      pulse.at = time;
      pulse.from = previousCount.current;
      pulse.to = count;
      unitsRef.current.forEach((unit) => {
        if (unit.active && !unit.dying && time - unit.spawnAt > 0.08) {
          unit.glowAt = time;
        }
      });
    }
    previousCount.current = count;
    updateArmyUnits(unitsRef.current, count, time, delta);

    unitsRef.current.forEach((unit, index) => {
      if (!unit.active) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(index, dummy.matrix);
        heads.current.setMatrixAt(index, dummy.matrix);
        shoulders.current.setMatrixAt(index, dummy.matrix);
        visors.current.setMatrixAt(index, dummy.matrix);
        boots.current.setMatrixAt(index, dummy.matrix);
        guns.current.setMatrixAt(index, dummy.matrix);
        feedbackColor.set("#ffffff");
        [bodies.current, heads.current, shoulders.current, visors.current, boots.current, guns.current].forEach((mesh) =>
          setFeedback(mesh, index, feedbackColor, 0, 0),
        );
        return;
      }
      const step = Math.abs(Math.sin(time * 8 + index * 0.7)) * 0.045;
      const scale = unit.scale * ENTITY_VISUALS.playerSoldier.scale;
      const glowAge = time - unit.glowAt;
      const glowIntensity =
        glowAge < 0 || glowAge >= 0.78
          ? 0
          : glowAge < 0.09
            ? THREE.MathUtils.smoothstep(glowAge, 0, 0.09)
            : glowAge < 0.24
              ? 1
              : 1 - THREE.MathUtils.smoothstep(glowAge, 0.24, 0.78);
      const hitAge = time - unit.hitAt;
      const hitIntensity =
        hitAge < 0 || hitAge >= 0.66
          ? 0
          : hitAge < 0.07
            ? THREE.MathUtils.smoothstep(hitAge, 0, 0.07)
            : hitAge < 0.2
              ? 1
              : 1 - THREE.MathUtils.smoothstep(hitAge, 0.2, 0.66);
      const deathAge = unit.dying ? time - unit.deathAt : -1;
      const greyAmount = unit.dying
        ? THREE.MathUtils.smoothstep(deathAge, 0.2, 0.66)
        : 0;
      const overlayIntensity = Math.max(glowIntensity, hitIntensity);
      const overlayColor =
        hitIntensity >= glowIntensity ? "#ffffff" : "#ffe64d";
      feedbackColor.set(overlayColor);

      dummy.position.set(unit.x, 0.58 + step + unit.y, unit.z);
      dummy.rotation.set(unit.rotation * 0.45, 0, unit.rotation);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(index, dummy.matrix);
      setFeedback(
        bodies.current,
        index,
        feedbackColor,
        overlayIntensity,
        greyAmount,
      );
      if (import.meta.env.DEV) {
        unit.debugBodyColor = color
          .copy(playerBodyBase)
          .lerp(feedbackColor, overlayIntensity)
          .lerp(playerBodyGrey, greyAmount)
          .getHexString();
        unit.debugGlowIntensity = glowIntensity;
        unit.debugHitIntensity = hitIntensity;
        unit.debugGreyAmount = greyAmount;
      }
      dummy.position.set(unit.x, 0.84 + step + unit.y, unit.z);
      dummy.rotation.set(unit.rotation * 0.45, 0, unit.rotation);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);
      setFeedback(
        heads.current,
        index,
        feedbackColor,
        overlayIntensity,
        greyAmount,
      );

      dummy.position.set(unit.x, 0.83 + step + unit.y, unit.z - 0.125);
      dummy.rotation.set(unit.rotation * 0.45, 0, unit.rotation);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      visors.current.setMatrixAt(index, dummy.matrix);
      setFeedback(
        visors.current,
        index,
        feedbackColor,
        overlayIntensity,
        greyAmount,
      );

      dummy.position.set(unit.x, 0.69 + step + unit.y, unit.z + 0.01);
      dummy.rotation.set(unit.rotation * 0.45, 0, unit.rotation);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      shoulders.current.setMatrixAt(index, dummy.matrix);
      setFeedback(
        shoulders.current,
        index,
        feedbackColor,
        overlayIntensity,
        greyAmount,
      );

      dummy.position.set(unit.x, 0.4 + step * 0.45 + unit.y, unit.z + 0.015);
      dummy.rotation.set(unit.rotation * 0.45, 0, unit.rotation);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      boots.current.setMatrixAt(index, dummy.matrix);
      setFeedback(
        boots.current,
        index,
        feedbackColor,
        overlayIntensity,
        greyAmount,
      );

      dummy.position.set(unit.x + 0.085, 0.63 + step + unit.y, unit.z - 0.12);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      guns.current.setMatrixAt(index, dummy.matrix);
      setFeedback(
        guns.current,
        index,
        feedbackColor,
        overlayIntensity,
        greyAmount,
      );
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    shoulders.current.instanceMatrix.needsUpdate = true;
    visors.current.instanceMatrix.needsUpdate = true;
    boots.current.instanceMatrix.needsUpdate = true;
    guns.current.instanceMatrix.needsUpdate = true;
    markFeedbackForUpdate(bodies.current);
    markFeedbackForUpdate(heads.current);
    markFeedbackForUpdate(shoulders.current);
    markFeedbackForUpdate(visors.current);
    markFeedbackForUpdate(boots.current);
    markFeedbackForUpdate(guns.current);
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[null, null, MAX_VISIBLE_TROOPS]} castShadow>
        <boxGeometry args={[0.22, 0.34, 0.18]} />
        <FeedbackMaterial
          greyColor="#94a0a8"
          cacheKey="army-body"
          color="#37d4ff"
          emissive="#079ed3"
          emissiveIntensity={0.38}
          metalness={0.4}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, MAX_VISIBLE_TROOPS]} castShadow>
        <dodecahedronGeometry args={[0.145, 0]} />
        <FeedbackMaterial
          greyColor="#b9c2c8"
          cacheKey="army-head"
          color="#f7ffff"
          emissive="#38cfff"
          emissiveIntensity={0.28}
        />
      </instancedMesh>
      <instancedMesh ref={visors} args={[null, null, MAX_VISIBLE_TROOPS]}>
        <boxGeometry args={[0.24, 0.055, 0.038]} />
        <FeedbackMaterial
          greyColor="#7fa2ad"
          cacheKey="army-visor"
          color="#48f7ff"
          emissive="#00d7ff"
          emissiveIntensity={1.35}
          metalness={0.2}
          roughness={0.12}
        />
      </instancedMesh>
      <instancedMesh ref={shoulders} args={[null, null, MAX_VISIBLE_TROOPS]} castShadow>
        <boxGeometry args={[0.43, 0.095, 0.16]} />
        <FeedbackMaterial
          greyColor="#9aa8b2"
          cacheKey="army-shoulder"
          color="#f4ffff"
          emissive="#22c7eb"
          emissiveIntensity={0.22}
          metalness={0.55}
          roughness={0.24}
        />
      </instancedMesh>
      <instancedMesh ref={boots} args={[null, null, MAX_VISIBLE_TROOPS]} castShadow>
        <boxGeometry args={[0.32, 0.13, 0.2]} />
        <FeedbackMaterial
          greyColor="#6f7d87"
          cacheKey="army-boots"
          color="#154f86"
          emissive="#053c73"
          emissiveIntensity={0.26}
          metalness={0.5}
          roughness={0.28}
        />
      </instancedMesh>
      <instancedMesh ref={guns} args={[null, null, MAX_VISIBLE_TROOPS]}>
        <cylinderGeometry args={[0.026, 0.038, 0.42, 6]} />
        <FeedbackMaterial
          greyColor="#929ca3"
          cacheKey="army-gun"
          color="#f1ffff"
          metalness={0.8}
        />
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
  cannonPulseRef,
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
        active={active}
      />
      <DroneWing dronesRef={dronesRef} />
      <UpgradeBurst pulseRef={upgradePulseRef} />
      <Hovercraft
        active={active}
        rapidRef={rapidRef}
        playerXRef={playerXRef}
        cannonPulseRef={cannonPulseRef}
      />
    </group>
  );
}

function ProjectilePool({ bulletsRef }) {
  const glow = useRef();
  const core = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
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
        const heavyScale = bullet.heavy ? 1.78 : 1;
        dummy.scale.set(
          (bullet.rapid ? 1.28 : 1.05) * heavyScale,
          (bullet.rapid ? 1.28 : 1.05) * heavyScale,
          (bullet.rapid ? 4.0 : 3.2) * (bullet.heavy ? 1.45 : 1),
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
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshBasicMaterial
          color="#ffe600"
          transparent
          opacity={1}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh ref={core} args={[null, null, MAX_BULLETS]}>
        <sphereGeometry args={[0.052, 8, 8]} />
        <meshBasicMaterial color="#fffbd0" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function BossProjectilePool({ projectilesRef }) {
  const glow = useRef();
  const core = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    [glow, core].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
  }, []);
  useFrame(() => {
    if (!glow.current || !core.current) return;
    projectilesRef.current.forEach((projectile, index) => {
      if (!projectile.active) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(projectile.x, projectile.y, projectile.z);
        dummy.rotation.set(0, 0, projectile.vx * 0.08);
        dummy.scale.set(1.4, 1.4, 3.5);
      }
      dummy.updateMatrix();
      glow.current.setMatrixAt(index, dummy.matrix);
      if (projectile.active) dummy.scale.multiplyScalar(0.48);
      dummy.updateMatrix();
      core.current.setMatrixAt(index, dummy.matrix);
    });
    glow.current.instanceMatrix.needsUpdate = true;
    core.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={glow} args={[null, null, MAX_BOSS_PROJECTILES]}>
        <sphereGeometry args={[0.11, 7, 7]} />
        <meshBasicMaterial
          color="#ff3d1f"
          transparent
          opacity={0.82}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh ref={core} args={[null, null, MAX_BOSS_PROJECTILES]}>
        <sphereGeometry args={[0.11, 7, 7]} />
        <meshBasicMaterial color="#fff0b0" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function BossTargetTelegraphs({ projectilesRef }) {
  const rings = useRef();
  const fills = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    [rings, fills].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
  }, []);
  useFrame((state) => {
    if (!rings.current || !fills.current) return;
    projectilesRef.current.forEach((projectile, index) => {
      if (!projectile.active) {
        dummy.scale.setScalar(0);
      } else {
        const warningAge = state.clock.elapsedTime - projectile.spawnedAt;
        const pulse = 1 + Math.sin(warningAge * 14) * 0.09;
        dummy.position.set(projectile.targetX, 0.13, projectile.targetZ);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.setScalar(projectile.radius * pulse);
      }
      dummy.updateMatrix();
      rings.current.setMatrixAt(index, dummy.matrix);
      if (projectile.active) dummy.scale.multiplyScalar(0.82);
      dummy.updateMatrix();
      fills.current.setMatrixAt(index, dummy.matrix);
    });
    rings.current.instanceMatrix.needsUpdate = true;
    fills.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={rings} args={[null, null, MAX_BOSS_PROJECTILES]}>
        <torusGeometry args={[1, 0.055, 8, 48]} />
        <meshBasicMaterial
          color="#ff3d1f"
          transparent
          opacity={0.92}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh ref={fills} args={[null, null, MAX_BOSS_PROJECTILES]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          color="#ff5b2d"
          transparent
          opacity={0.18}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}

function BossShockwave({ shockwaveRef }) {
  const ring = useRef();
  useFrame((state) => {
    if (!ring.current) return;
    const age = state.clock.elapsedTime - shockwaveRef.current.at;
    const active = age >= 0 && age < 0.85;
    ring.current.visible = active;
    if (!active) return;
    const progress = age / 0.85;
    ring.current.position.z = shockwaveRef.current.z;
    ring.current.scale.setScalar(0.4 + progress * 7);
    ring.current.material.opacity = (1 - progress) * 0.88;
  });
  return (
    <mesh
      ref={ring}
      position={[0, 0.14, -20]}
      rotation={[Math.PI / 2, 0, 0]}
      visible={false}
    >
      <torusGeometry args={[0.58, 0.065, 8, 48]} />
      <meshBasicMaterial
        color="#ff4b2d"
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function ImpactPool({ impactsRef }) {
  const particles = useRef();
  const rings = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
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
  });
  return (
    <group>
      <instancedMesh
        ref={particles}
        args={[null, null, MAX_IMPACTS * particlesPerImpact]}
      >
        <octahedronGeometry args={[0.065, 0]} />
        <meshBasicMaterial
          color="#fff16a"
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
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

function EnemyWave({ wave, enemies, waveState, distanceRef, active }) {
  const bodies = useRef();
  const heads = useRef();
  const shoulders = useRef();
  const visors = useRef();
  const cores = useRef();
  const legs = useRef();
  const alertRing = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flashColor = useMemo(() => new THREE.Color("#ffffff"), []);

  useLayoutEffect(() => {
    [bodies, heads, shoulders, visors, cores, legs].forEach((ref) => {
      if (ref.current) {
        ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        setupFeedbackAttributes(ref.current, enemies.length);
      }
    });
  }, [enemies.length]);

  useFrame((state) => {
    if (!active) return;
    if (
      !bodies.current ||
      !heads.current ||
      !shoulders.current ||
      !visors.current ||
      !cores.current ||
      !legs.current
    ) return;
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
      let greyAmount = 0;

      if (enemy.alive) {
        const runRate = waveState.alerted ? 10.5 : 5.5;
        y += Math.abs(Math.sin(t * runRate + enemy.id)) * (waveState.alerted ? 0.12 : 0.07);
        rotationY = Math.sin(t * 2 + enemy.id) * 0.14;
        const hitAge = t - enemy.hitAt;
        hit =
          hitAge < 0 || hitAge >= 0.66
            ? 0
            : hitAge < 0.07
              ? THREE.MathUtils.smoothstep(hitAge, 0, 0.07)
              : hitAge < 0.2
                ? 1
                : 1 - THREE.MathUtils.smoothstep(hitAge, 0.2, 0.66);
        scaleX = 1 + hit * 0.24;
        scaleY = 1 - hit * 0.28;
        scaleZ = 1 + hit * 0.24;
      } else {
        const age = t - enemy.deathAt;
        visible = age >= 0 && age <= 1.8;
        if (visible) {
          const flightAge = Math.max(0, age - 0.14);
          hit =
            age < 0 || age >= 0.66
              ? 0
              : age < 0.07
                ? THREE.MathUtils.smoothstep(age, 0, 0.07)
                : age < 0.2
                  ? 1
                  : 1 - THREE.MathUtils.smoothstep(age, 0.2, 0.66);
          greyAmount = THREE.MathUtils.smoothstep(age, 0.2, 0.62);
          x += enemy.vx * flightAge;
          y += enemy.vy * flightAge - 4.6 * flightAge * flightAge;
          z += enemy.vz * flightAge;
          rotationX = flightAge * enemy.spinX;
          rotationY = flightAge * enemy.spinY;
          rotationZ = flightAge * enemy.spinZ;
          const deathScale =
            age < 0.2
              ? 1 + Math.sin((age / 0.2) * Math.PI) * 0.22
              : 1 - flightAge / 1.62;
          scaleX = scaleY = scaleZ = Math.max(0.05, deathScale);
        }
      }

      if (!visible) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(index, dummy.matrix);
        heads.current.setMatrixAt(index, dummy.matrix);
        shoulders.current.setMatrixAt(index, dummy.matrix);
        visors.current.setMatrixAt(index, dummy.matrix);
        cores.current.setMatrixAt(index, dummy.matrix);
        legs.current.setMatrixAt(index, dummy.matrix);
        [bodies.current, heads.current, shoulders.current, visors.current, cores.current, legs.current].forEach((mesh) =>
          setFeedback(mesh, index, flashColor, 0, 0),
        );
        return;
      }

      dummy.position.set(x, y, z);
      dummy.rotation.set(rotationX, rotationY, rotationZ);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(index, dummy.matrix);
      setFeedback(bodies.current, index, flashColor, hit, greyAmount);

      dummy.position.set(x, y + 0.3 * scaleY, z);
      dummy.scale.setScalar(0.95 * scaleX);
      dummy.updateMatrix();
      heads.current.setMatrixAt(index, dummy.matrix);
      setFeedback(heads.current, index, flashColor, hit, greyAmount);

      dummy.position.set(x, y + 0.29 * scaleY, z - 0.145);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      visors.current.setMatrixAt(index, dummy.matrix);
      setFeedback(visors.current, index, flashColor, hit, greyAmount);

      dummy.position.set(x, y + 0.1 * scaleY, z - 0.01);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      shoulders.current.setMatrixAt(index, dummy.matrix);
      setFeedback(shoulders.current, index, flashColor, hit, greyAmount);

      dummy.position.set(x, y + 0.02 * scaleY, z - 0.135);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      cores.current.setMatrixAt(index, dummy.matrix);
      setFeedback(cores.current, index, flashColor, hit, greyAmount);

      dummy.position.set(x, y - 0.12 * scaleY, z);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      legs.current.setMatrixAt(index, dummy.matrix);
      setFeedback(legs.current, index, flashColor, hit, greyAmount);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    shoulders.current.instanceMatrix.needsUpdate = true;
    visors.current.instanceMatrix.needsUpdate = true;
    cores.current.instanceMatrix.needsUpdate = true;
    legs.current.instanceMatrix.needsUpdate = true;
    markFeedbackForUpdate(bodies.current);
    markFeedbackForUpdate(heads.current);
    markFeedbackForUpdate(shoulders.current);
    markFeedbackForUpdate(visors.current);
    markFeedbackForUpdate(cores.current);
    markFeedbackForUpdate(legs.current);
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
      <instancedMesh ref={bodies} args={[null, null, enemies.length]} castShadow>
        <boxGeometry args={[0.34, 0.42, 0.24]} />
        <FeedbackMaterial
          greyColor="#969da3"
          cacheKey={`enemy-body-${wave.gateIndex}`}
          color="#e54f32"
          emissive="#681109"
          emissiveIntensity={0.3}
          metalness={0.48}
          roughness={0.32}
        />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, enemies.length]} castShadow>
        <octahedronGeometry args={[0.17, 0]} />
        <FeedbackMaterial
          greyColor="#b8b2aa"
          cacheKey={`enemy-head-${wave.gateIndex}`}
          color="#ffbc83"
          emissive="#5f1608"
          emissiveIntensity={0.22}
        />
      </instancedMesh>
      <instancedMesh ref={visors} args={[null, null, enemies.length]}>
        <boxGeometry args={[0.22, 0.055, 0.045]} />
        <FeedbackMaterial
          greyColor="#aa977f"
          cacheKey={`enemy-visor-${wave.gateIndex}`}
          color="#ffb33f"
          emissive="#ff8a00"
          emissiveIntensity={1.35}
          metalness={0.24}
          roughness={0.16}
        />
      </instancedMesh>
      <instancedMesh ref={shoulders} args={[null, null, enemies.length]}>
        <boxGeometry args={[0.48, 0.12, 0.16]} />
        <FeedbackMaterial
          greyColor="#8e9296"
          cacheKey={`enemy-shoulder-${wave.gateIndex}`}
          color="#7b2530"
          emissive="#300710"
          emissiveIntensity={0.18}
          metalness={0.42}
          roughness={0.34}
        />
      </instancedMesh>
      <instancedMesh ref={cores} args={[null, null, enemies.length]}>
        <octahedronGeometry args={[0.075, 0]} />
        <FeedbackMaterial
          greyColor="#9a8b73"
          cacheKey={`enemy-core-${wave.gateIndex}`}
          color="#ffd15a"
          emissive="#ff9a00"
          emissiveIntensity={1.1}
          metalness={0.2}
          roughness={0.18}
        />
      </instancedMesh>
      <instancedMesh ref={legs} args={[null, null, enemies.length]}>
        <boxGeometry args={[0.42, 0.28, 0.12]} />
        <FeedbackMaterial
          greyColor="#858c91"
          cacheKey={`enemy-legs-${wave.gateIndex}`}
          color="#51222c"
        />
      </instancedMesh>
    </group>
  );
}

function Boss({
  distanceRef,
  healthRef,
  activeRef,
  hitRef,
  advanceRef,
  attackRef,
}) {
  const ref = useRef();
  const coreMaterial = useRef();
  const hitMaterials = useRef([]);
  const baseColor = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const coreBase = useMemo(() => new THREE.Color("#ecffff"), []);
  const coreEmissive = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!ref.current) return;
    const z = distanceRef.current - BOSS_Z + advanceRef.current;
    ref.current.position.z = z;
    ref.current.visible =
      distanceRef.current >= TRACK_END - 12 && z > -40 && z < 8;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.65) * 0.08;
    const hitAge = state.clock.elapsedTime - hitRef.current;
    const hit =
      hitAge < 0 || hitAge >= 0.5
        ? 0
        : hitAge < 0.08
          ? THREE.MathUtils.smoothstep(hitAge, 0, 0.08)
          : 1 - THREE.MathUtils.smoothstep(hitAge, 0.08, 0.5);
    ref.current.scale.set(1 + hit * 0.08, 1 - hit * 0.12, 1 + hit * 0.08);
    const attackAge = state.clock.elapsedTime - attackRef.current;
    const attacking =
      attackAge >= 0 && attackAge < 0.42
        ? Math.sin((attackAge / 0.42) * Math.PI)
        : 0;
    ref.current.rotation.x = -attacking * 0.08;
    hitMaterials.current.forEach((material) => {
      if (!material) return;
      material.color
        .copy(baseColor.set(material.userData.baseColor))
        .lerp(white, hit * 0.48);
      if (material.emissive) {
        material.emissiveIntensity =
          (material.userData.baseEmissive ?? 0) + attacking * 2.5 + hit * 1.35;
      }
    });
    if (coreMaterial.current) {
      coreMaterial.current.color.copy(coreBase).lerp(white, hit * 0.55);
      coreEmissive.set(healthRef.current < 45 ? "#ff5a27" : "#00a7df");
      coreMaterial.current.emissive.copy(coreEmissive).lerp(white, hit * 0.45);
      coreMaterial.current.emissiveIntensity = activeRef.current
        ? 1.25 + (1 - healthRef.current / 100) + hit * 2.2
        : 0.45;
    }
  });

  return (
    <group ref={ref} position={[0, 1.08, -40]} visible={false}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[3.35, 1.1, 1.28]} />
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
      <mesh position={[0, 0.18, 0.42]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.88, 0]} />
        <meshStandardMaterial
          ref={(material) => {
            if (material) {
              material.userData.baseColor = "#0e435c";
              material.userData.baseEmissive = 0.6;
              hitMaterials.current[7] = material;
            }
          }}
          color="#0e435c"
          emissive="#073954"
          emissiveIntensity={0.6}
          metalness={0.75}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, 0.48, 0.74]}>
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
      <mesh position={[0, 0.05, 0.84]}>
        <boxGeometry args={[2.5, 0.45, 0.15]} />
        <meshStandardMaterial
          ref={(material) => {
            if (material) {
              material.userData.baseColor = "#75efff";
              material.userData.baseEmissive = 1.2;
              hitMaterials.current[2] = material;
            }
          }}
          color="#75efff"
          emissive="#21d8f4"
          emissiveIntensity={1.2}
          metalness={0.5}
        />
      </mesh>
      {[-1.38, 1.38].map((side, index) => (
        <group key={side} position={[side, 0.58, 0.96]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.24, 1.05, 8]} />
            <meshStandardMaterial
              ref={(material) => {
                if (material) {
                  material.userData.baseColor = "#f7fbff";
                  material.userData.baseEmissive = 0.7;
                  hitMaterials.current[8 + index * 2] = material;
                }
              }}
              color="#f7fbff"
              emissive="#18bfe4"
              emissiveIntensity={0.7}
              metalness={0.82}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, 0, 0.57]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.26, 0.42, 8]} />
            <meshStandardMaterial
              ref={(material) => {
                if (material) {
                  material.userData.baseColor = "#ffb340";
                  material.userData.baseEmissive = 1.2;
                  hitMaterials.current[9 + index * 2] = material;
                }
              }}
              color="#ffb340"
              emissive="#ff5b1f"
              emissiveIntensity={1.2}
              metalness={0.42}
              roughness={0.24}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.22, 1.11]}>
        <torusGeometry args={[0.62, 0.06, 8, 36]} />
        <meshBasicMaterial
          color="#4ff8ff"
          toneMapped={false}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0.22, 1.13]}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial
          ref={(material) => {
            if (material) {
              material.userData.baseColor = "#dfffff";
              material.userData.baseEmissive = 1.55;
              hitMaterials.current[12] = material;
            }
          }}
          color="#dfffff"
          emissive="#00dcff"
          emissiveIntensity={1.55}
          metalness={0.35}
          roughness={0.14}
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
            <mesh rotation={[0, 0, side > 0 ? -0.32 : 0.32]} scale={[1.35, 0.76, 0.74]}>
              <octahedronGeometry args={[0.68, 0]} />
              <meshStandardMaterial
                ref={(material) => {
                  if (material) {
                    material.userData.baseColor = "#ffad3d";
                    material.userData.baseEmissive = 1;
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
                    material.userData.baseEmissive = 0.5;
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
  useFrame((state) => {
    if (!ref.current) return;
    const loopStart = -126;
    const loopLength = 154;
    ref.current.position.z =
      THREE.MathUtils.euclideanModulo(
        baseZ + distanceRef.current - loopStart,
        loopLength,
      ) + loopStart;
    ref.current.position.y =
      -1.7 + Math.sin(state.clock.elapsedTime * 0.42 + baseZ) * 0.11;
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
  const markings = useRef();
  useFrame(() => {
    if (markings.current) markings.current.position.z = distanceRef.current % 8;
  });
  return (
    <group>
      <mesh position={[0, -0.055, -42]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.85, 96, 4, 18]} />
        <meshStandardMaterial
          color="#bcecf0"
          metalness={0.34}
          roughness={0.18}
          transparent
          opacity={0.34}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.085, -42]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.25, 96, 1, 1]} />
        <meshBasicMaterial
          color="#49eaff"
          transparent
          opacity={0.1}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {[-3.1, 3.1].map((x) => (
        <group key={x} position={[x, 0.065, -42]}>
          <mesh>
            <boxGeometry args={[0.07, 0.045, 96]} />
            <meshBasicMaterial
              color="#53f4ff"
              toneMapped={false}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh position={[x > 0 ? -0.18 : 0.18, -0.035, 0]}>
            <boxGeometry args={[0.012, 0.025, 96]} />
            <meshBasicMaterial
              color="#e8ffff"
              toneMapped={false}
              transparent
              opacity={0.26}
            />
          </mesh>
        </group>
      ))}

      <group ref={markings}>
        {Array.from({ length: 13 }, (_, index) => {
          const z = 4 - index * 8;
          const fade = clamp(1 - Math.max(0, index - 7) / 5, 0.18, 1);
          return (
            <group key={index} position={[0, 0.072, z]}>
              <mesh>
                <boxGeometry args={[5.65, 0.018, 0.035]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.17 * fade}
                />
              </mesh>
              <mesh position={[0, 0.004, -2.6]}>
                <boxGeometry args={[0.035, 0.022, 1.45]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.36 * fade}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function SkyEnvironment() {
  const { scene } = useThree();
  const isCompact =
    typeof window !== "undefined" &&
    (window.innerWidth < 900 || window.devicePixelRatio > 2);
  const texture = useLoader(
    THREE.TextureLoader,
    isCompact
      ? assetUrl("assets/azure-sky-panorama-v2-2k.jpg")
      : assetUrl("assets/azure-sky-panorama-v2-4k.jpg"),
  );
  useEffect(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = null;
    scene.environment = texture;
    scene.environmentIntensity = 0.64;
    return () => {
      scene.background = null;
      if (scene.environment === texture) scene.environment = null;
    };
  }, [scene, texture]);
  return null;
}

function FixedSkyBackdrop() {
  const texture = useLoader(THREE.TextureLoader, assetUrl("assets/skyline-backdrop-v1.jpg"));
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  return (
    <mesh position={[0, 8.6, -88]} renderOrder={-100}>
      <planeGeometry args={[44, 78]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthWrite={false}
        depthTest={false}
        fog={false}
      />
    </mesh>
  );
}

function World({ status, runSeed, onFrameData, onEvent }) {
  const { camera, gl } = useThree();
  const gates = useMemo(() => createGates(runSeed), [runSeed]);
  const playerX = useRef(0);
  const pointerTargetX = useRef(0);
  const distance = useRef(DEBUG_BOSS_TEST ? TRACK_END : DEBUG_START_AT);
  const troops = useRef(DEBUG_BOSS_TEST ? 80 : DEBUG_ENEMY_RUSH ? 40 : 12);
  const combo = useRef(1);
  const bossHealth = useRef(82);
  const rapidUntil = useRef(0);
  const rapidRef = useRef(false);
  const drones = useRef(0);
  const gateStates = useRef(
    gates.map((gate) => ({
      leftValue: gate.left,
      rightValue: gate.right,
      leftCharge: 0,
      rightCharge: 0,
      leftHit: 0,
      rightHit: 0,
      resolved: DEBUG_BOSS_TEST,
      choice: null,
      resolvedAt: 0,
    })),
  );
  const waveStates = useRef(
    WAVES.map(() => ({
      unlocked: DEBUG_BOSS_TEST,
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
      heavy: false,
      shooter: 0,
      regionIndex: 0,
      phase: "gate",
      life: 0,
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
      color: "#fff16a",
      size: 1,
    })),
  );
  const clearedWaves = useRef(
    new Set(DEBUG_BOSS_TEST ? WAVES.map((_, index) => index) : []),
  );
  const bossActive = useRef(DEBUG_BOSS_TEST);
  const bossHitAt = useRef(-10);
  const bossAdvance = useRef(0);
  const bossAttackAt = useRef(-10);
  const bossVolleyTimer = useRef(1.2);
  const bossShockwaveTimer = useRef(2.2);
  const bossShockwave = useRef({ at: -10, z: -20 });
  const bossProjectiles = useRef(
    Array.from({ length: MAX_BOSS_PROJECTILES }, () => ({
      active: false,
      x: 0,
      y: 0.8,
      z: -20,
      vx: 0,
      vz: 0,
      life: 0,
      targetX: 0,
      targetZ: 3.05,
      radius: 1.15,
      spawnedAt: -10,
    })),
  );
  const shotTimer = useRef(0);
  const heavyShotTimer = useRef(0.55);
  const cannonPulse = useRef(-10);
  const finished = useRef(false);
  const shake = useRef(0);
  const uiTimer = useRef(0);
  const keyboard = useRef({ left: false, right: false });
  const lastHit = useRef(null);
  const lastEnemyHit = useRef(null);
  const lastPlayerDeath = useRef(null);
  const movementSamples = useRef([]);
  const fpsCounter = useRef({ frames: 0, elapsed: 0, value: 0 });

  const getCombatStage = () => {
    const regionIndex = WAVES.findIndex(
      (_, index) => !clearedWaves.current.has(index),
    );
    if (regionIndex < 0) return { regionIndex: WAVES.length, phase: "boss" };
    const gateDistance = gates[regionIndex].z - distance.current;
    return {
      regionIndex,
      phase: gateStates.current[regionIndex].resolved
        ? "wave"
        : gateDistance <= 27 + regionIndex * 9
          ? "gate"
          : "travel",
    };
  };

  const getGateIndexForBullet = (bullet) => {
    if (bullet.phase === "wave") {
      return bullet.regionIndex + 1 < gates.length ? bullet.regionIndex + 1 : null;
    }
    if (bullet.phase === "gate") return bullet.regionIndex;
    return null;
  };

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
    const stage = getCombatStage();
    const activeShooters = armyUnits.current.filter(
      (unit) => unit.active && !unit.dying && unit.scale > 0.72,
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
        stage.regionIndex,
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
      bullet.heavy = false;
      bullet.shooter = shooter.index;
      bullet.regionIndex = stage.regionIndex;
      bullet.phase = stage.phase;
      bullet.life = stage.phase === "travel" ? 0.48 : 2.6;
    });
    const muzzle = sorted[Math.floor(sorted.length / 2)];
    if (muzzle) {
      spawnImpact(
        playerX.current + muzzle.x,
        0.72,
        muzzle.z - 0.2,
        "#fff16a",
        0.12,
        0.42,
      );
    }
    onEvent({ type: "shoot", heavy: false });
  };

  const spawnHeavyShot = (time) => {
    const stage = getCombatStage();
    const bullet = bullets.current.find((item) => !item.active);
    if (!bullet) return;
    const target = chooseEnemyTarget(
      waveEnemies.current,
      waveStates.current,
      playerX.current,
      distance.current,
      stage.regionIndex,
    );
    bullet.active = true;
    bullet.x = playerX.current;
    bullet.y = 1.62;
    bullet.z = 3.34;
    bullet.speed = 17.5;
    bullet.vx = target
      ? clamp((target.x - playerX.current) * 1.05, -2.25, 2.25)
      : 0;
    bullet.rapid = false;
    bullet.heavy = true;
    bullet.shooter = -1;
    bullet.regionIndex = stage.regionIndex;
    bullet.phase = stage.phase;
    bullet.life = stage.phase === "travel" ? 0.48 : 2.8;
    cannonPulse.current = time;
    spawnImpact(playerX.current, 0.83, 3.08, "#fff16a", 0.2, 1.25);
    onEvent({ type: "shoot", heavy: true });
  };

  const spawnBossVolley = (time) => {
    const bossZ = distance.current - BOSS_Z + bossAdvance.current;
    [-1.65, 1.65].forEach((muzzleX, index) => {
      const projectile = bossProjectiles.current.find((item) => !item.active);
      if (!projectile) return;
      const targetX =
        playerX.current + (index ? 0.28 : -0.28) + (Math.random() - 0.5) * 0.18;
      const travelTime = Math.max(0.8, (3.1 - bossZ) / 8.2);
      projectile.active = true;
      projectile.x = muzzleX;
      projectile.y = 1.05;
      projectile.z = bossZ + 0.1;
      projectile.vx = (targetX - muzzleX) / travelTime;
      projectile.vz = 8.2;
      projectile.life = 2.6;
      projectile.targetX = targetX;
      projectile.targetZ = 3.05;
      projectile.radius = 0.82 + (82 - bossHealth.current) * 0.0022;
      projectile.spawnedAt = time;
    });
    bossAttackAt.current = time;
    onEvent({ type: "boss-fire" });
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
        if (
          DEBUG_ENEMY_RUSH &&
          waveState.unlocked &&
          !waveState.alerted
        ) {
          waveState.alerted = true;
          waveState.alertedAt = state.clock.elapsedTime;
        }
        if (waveState.alerted) {
          const frontZ = distance.current - wave.z + waveState.advance;
          const pressure = clamp((-frontZ + 5) / 34, 0.25, 1);
          waveState.advance +=
            delta * wave.speed * pressure * (DEBUG_ENEMY_RUSH ? 3.5 : 1);
        }
        waveEnemies.current[waveIndex].forEach((enemy) => {
          if (!enemy.alive) return;
          const renderZ =
            distance.current -
            wave.z -
            enemy.zOffset +
            waveState.advance;
          let targetX = enemy.x + (waveState.alerted ? playerX.current * 0.2 : 0);
          if (waveState.alerted && renderZ > -10) {
            const nearest = armyUnits.current
              .filter((unit) => unit.active && !unit.dying)
              .reduce((best, unit) => {
                const worldX = playerX.current + unit.x;
                const distanceToEnemy = Math.abs(worldX - enemy.currentX);
                return !best || distanceToEnemy < best.distance
                  ? { x: worldX, distance: distanceToEnemy }
                  : best;
              }, null);
            if (nearest) targetX = nearest.x;
          }
          enemy.currentX = THREE.MathUtils.damp(
            enemy.currentX,
            targetX,
            waveState.alerted ? 3.4 : 4.5,
            delta,
          );
        });
      });

      if (!DEBUG_NO_PHYSICS && !DEBUG_ENEMY_RUSH) {
        shotTimer.current -= delta;
        heavyShotTimer.current -= delta;
        if (shotTimer.current <= 0) {
          spawnVolley(rapidRef.current);
          shotTimer.current = rapidRef.current ? 0.065 : 0.125;
        }
        if (heavyShotTimer.current <= 0) {
          spawnHeavyShot(state.clock.elapsedTime);
          heavyShotTimer.current = rapidRef.current ? 0.62 : 0.92;
        }
      }

      if (!DEBUG_NO_PHYSICS) bullets.current.forEach((bullet) => {
        if (!bullet.active) return;
        bullet.life -= delta;
        if (bullet.life <= 0) {
          bullet.active = false;
          return;
        }
        const oldZ = bullet.z;
        const oldX = bullet.x;
        const nextZ = oldZ - bullet.speed * delta;
        const nextX = oldX + bullet.vx * delta;
        const targetY = bullet.heavy ? 0.82 : bullet.y;
        bullet.y = THREE.MathUtils.damp(bullet.y, targetY, 4.5, delta);
        const collisionX = (oldX + nextX) * 0.5;
        let target = null;
        let targetZ = -Infinity;

        gates.forEach((gate, gateIndex) => {
          if (
            gateIndex !== getGateIndexForBullet(bullet)
          ) return;
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
          if (
            bullet.phase !== "wave" ||
            waveIndex !== bullet.regionIndex ||
            !waveStates.current[waveIndex].unlocked
          ) return;
          waveEnemies.current[waveIndex].forEach((enemy) => {
            if (!enemy.alive) return;
            const z =
              distance.current -
              wave.z -
              enemy.zOffset +
              waveStates.current[waveIndex].advance;
            const hitRadius = bullet.heavy ? 0.64 : 0.42;
            const zTolerance = bullet.heavy ? 0.34 : 0.24;
            if (
              z <= oldZ + zTolerance &&
              z >= nextZ - zTolerance &&
              Math.abs(collisionX - enemy.currentX) <= hitRadius &&
              z > targetZ
            ) {
              target = { type: "enemy", waveIndex, enemy, z };
              targetZ = z;
            }
          });
        });

        if (
          bossActive.current &&
          bossHealth.current > 0
        ) {
          const z = distance.current - BOSS_Z + bossAdvance.current;
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
          const chargeKey = `${target.side}Charge`;
          const chargeWeight = bullet.heavy ? 2 : 1;
          gateState[chargeKey] += chargeWeight;
          let increase = 0;
          while (gateState[chargeKey] >= gate.shotsPerPoint) {
            gateState[chargeKey] -= gate.shotsPerPoint;
            increase += 1;
          }
          if (increase > 0) {
            gateState[valueKey] = clamp(
              gateState[valueKey] + increase,
              -99,
              gate.maxValue,
            );
          }
          gateState[`${target.side}Hit`] = 1;
          spawnImpact(
            collisionX,
            bullet.y,
            target.z - 0.08,
            "#fff16a",
            0.27,
            bullet.heavy ? 1.8 : 1.15,
          );
          onEvent({ type: "impact", target: "gate", heavy: bullet.heavy });
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
          enemy.hp -= bullet.heavy ? 3 : 1;
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
          spawnImpact(
            collisionX,
            bullet.y,
            target.z - 0.08,
            "#fff16a",
            bullet.heavy ? 0.34 : 0.26,
            bullet.heavy ? 2.1 : 1.2,
          );
          onEvent({
            type: "impact",
            target: "enemy",
            heavy: bullet.heavy,
            killed: enemy.hp <= 0,
          });
          if (bullet.heavy) {
            waveEnemies.current[target.waveIndex].forEach((nearby) => {
              if (
                nearby !== enemy &&
                nearby.alive &&
                Math.abs(nearby.currentX - enemy.currentX) < 0.72 &&
                Math.abs(nearby.zOffset - enemy.zOffset) < 0.72
              ) {
                nearby.hp -= 1;
                nearby.hitAt = state.clock.elapsedTime;
                if (nearby.hp <= 0) {
                  nearby.alive = false;
                  nearby.deathAt = state.clock.elapsedTime;
                  nearby.vx = (nearby.currentX >= enemy.currentX ? 1 : -1) * 2.1;
                  nearby.vy = 3.5 + Math.random() * 1.0;
                  nearby.vz = -3.2 - Math.random() * 1.1;
                  nearby.spinX = 7;
                  nearby.spinY = 8;
                  nearby.spinZ = nearby.vx * -5;
                }
              }
            });
          }
          if (enemy.hp <= 0) {
            enemy.alive = false;
            enemy.deathAt = state.clock.elapsedTime;
            const horizontal = clamp((enemy.currentX - collisionX) * 3, -1.8, 1.8);
            enemy.vx = (horizontal + (enemy.currentX >= 0 ? 0.65 : -0.65)) * 1.45;
            enemy.vy = 3.7 + Math.random() * 1.1;
            enemy.vz = -3.4 - Math.random() * 1.4;
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

        if (!DEBUG_BOSS_PIN) {
          bossHealth.current = Math.max(
            0,
            bossHealth.current -
              (bullet.heavy ? 2.4 : bullet.rapid ? 0.34 : 0.22),
          );
        }
        lastHit.current = {
          type: "boss",
          bulletX: collisionX,
          at: state.clock.elapsedTime,
        };
        if (state.clock.elapsedTime - bossHitAt.current > 0.1) {
          bossHitAt.current = state.clock.elapsedTime;
        }
        if (bullet.heavy) {
          bossAdvance.current = Math.max(0, bossAdvance.current - 0.12);
        }
        spawnImpact(
          collisionX,
          bullet.y,
          target.z - 0.75,
          "#fff16a",
          bullet.heavy ? 0.42 : 0.34,
          bullet.heavy ? 2.8 : 1.8,
        );
        onEvent({ type: "impact", target: "boss", heavy: bullet.heavy });
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
          if (waveStates.current[index]) {
            waveStates.current[index].unlocked = true;
          }
          for (let burst = -1; burst <= 1; burst += 1) {
            spawnImpact(
              (side === "left" ? -LANE_X : LANE_X) + burst * 0.48,
              1.35 + Math.abs(burst) * 0.35,
              renderZ,
              "#fff16a",
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
            killArmyUnits(
              armyUnits.current,
              previousTroops - troops.current,
              state.clock.elapsedTime,
            );
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

      if (!DEBUG_NO_ENEMIES) {
        let contactLosses = 0;
        WAVES.forEach((wave, index) => {
          const waveState = waveStates.current[index];
          if (!waveState.unlocked) return;

          waveEnemies.current[index].forEach((enemy) => {
            if (!enemy.alive) return;
            const renderZ =
              distance.current -
              wave.z -
              enemy.zOffset +
              waveState.advance;
            if (renderZ < 1.25 || renderZ > 4.55) return;

            let victim = findNearestArmyUnit(
              armyUnits.current,
              enemy.currentX,
              renderZ,
              playerX.current,
            );
            if (!victim) return;

            const worldVictimX = playerX.current + victim.x;
            const impulseX = clamp((worldVictimX - enemy.currentX) * 3.2, -2.2, 2.2);
            if (
              killArmyUnit(
                victim,
                state.clock.elapsedTime,
                impulseX,
                1.65,
              )
            ) {
              troops.current = Math.max(0, troops.current - 1);
              contactLosses += 1;
              lastPlayerDeath.current = {
                source: "enemy",
                enemyId: enemy.id,
                victimId: victim.index,
                enemyX: enemy.currentX,
                victimX: worldVictimX,
                at: state.clock.elapsedTime,
              };
            }

            enemy.alive = false;
            enemy.hitAt = state.clock.elapsedTime;
            enemy.deathAt = state.clock.elapsedTime;
            enemy.vx = -impulseX * 1.15;
            enemy.vy = 3.6 + Math.random() * 0.9;
            enemy.vz = -3.1;
            enemy.spinX = 7 + Math.random() * 4;
            enemy.spinY = 6 + Math.random() * 4;
            enemy.spinZ = (enemy.currentX >= worldVictimX ? 1 : -1) * 8;
            spawnImpact(
              (worldVictimX + enemy.currentX) * 0.5,
              0.68,
              renderZ,
              "#fff16a",
              0.28,
              1.5,
            );
          });

          const anyAlive = waveEnemies.current[index].some(
            (enemy) => enemy.alive,
          );
          if (!anyAlive && !clearedWaves.current.has(index)) {
            clearedWaves.current.add(index);
            combo.current += 1;
            onEvent({ type: "wave-clear", combo: combo.current });
          }
        });

        if (contactLosses > 0) {
          shake.current = Math.max(shake.current, 0.24);
          onEvent({
            type: "wave-hit",
            losses: contactLosses,
            troops: troops.current,
          });
        }
        if (troops.current <= 0 && !finished.current) {
          finished.current = true;
          onEvent({ type: "lost" });
        }
      }

      if (distance.current >= TRACK_END && troops.current > 0) {
        bossActive.current = true;
        const bossZ = distance.current - BOSS_Z + bossAdvance.current;
        if (bossHealth.current > 0) {
          if (!DEBUG_BOSS_PIN) {
            bossAdvance.current = Math.min(
              7.1,
              bossAdvance.current +
                delta * (0.72 + (100 - bossHealth.current) * 0.0035),
            );
            bossVolleyTimer.current -= delta;
            bossShockwaveTimer.current -= delta;
            if (bossVolleyTimer.current <= 0) {
              bossVolleyTimer.current = 2.2;
              spawnBossVolley(state.clock.elapsedTime);
            }
            if (bossZ > -7.4 && bossShockwaveTimer.current <= 0) {
              bossShockwaveTimer.current = 5.2;
              bossShockwave.current = {
                at: state.clock.elapsedTime,
                z: bossZ + 0.2,
              };
              const victims = armyUnits.current
                .filter((unit) => unit.active && !unit.dying)
                .sort((a, b) => a.z - b.z)
                .slice(0, 1);
              victims.forEach((victim) => {
                if (
                  killArmyUnit(
                    victim,
                    state.clock.elapsedTime,
                    victim.x * 2.3,
                    1.9,
                  )
                ) {
                  troops.current = Math.max(0, troops.current - 1);
                }
              });
              shake.current = 0.32;
              onEvent({
                type: "boss-shockwave",
                losses: victims.length,
                troops: troops.current,
              });
            }
          }
        }

        if (!DEBUG_BOSS_PIN) bossProjectiles.current.forEach((projectile) => {
          if (!projectile.active) return;
          projectile.life -= delta;
          projectile.x += projectile.vx * delta;
          projectile.z += projectile.vz * delta;
          if (projectile.life <= 0) {
            projectile.active = false;
            return;
          }
          if (projectile.z < projectile.targetZ) return;
          projectile.active = false;
          const maxVictims = bossHealth.current < 35 ? 2 : 1;
          const victims = armyUnits.current
            .filter((unit) => unit.active && !unit.dying && unit.scale > 0.45)
            .map((unit) => {
              const worldX = playerX.current + unit.x;
              const dx = worldX - projectile.targetX;
              const dz = unit.z - projectile.targetZ;
              return { unit, worldX, distance: Math.hypot(dx, dz), dx, dz };
            })
            .filter((entry) => entry.distance <= projectile.radius)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, maxVictims);
          victims.forEach(({ unit, worldX, dx, dz }) => {
            if (
              killArmyUnit(
                unit,
                state.clock.elapsedTime,
                clamp(dx * 3.2, -3.4, 3.4),
                2.3 + Math.max(0, -dz) * 0.5,
              )
            ) {
              troops.current = Math.max(0, troops.current - 1);
              lastPlayerDeath.current = {
                source: "boss-projectile",
                victimId: unit.index,
                projectileX: projectile.targetX,
                victimX: worldX,
                at: state.clock.elapsedTime,
              };
            }
          });
          spawnImpact(
            projectile.targetX,
            0.7,
            projectile.targetZ,
            "#ff5a2f",
            0.48,
            projectile.radius * 2.15,
          );
          shake.current = Math.max(shake.current, 0.34);
          onEvent({
            type: "boss-projectile-hit",
            losses: victims.length,
            troops: troops.current,
          });
        });

        if (!DEBUG_BOSS_PIN && bossHealth.current <= 0 && !finished.current) {
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
      camera.position.y = 6.9 + (Math.random() - 0.5) * shake.current * 0.08;
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 10, delta);
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        6.9,
        10,
        delta,
      );
    }
    camera.lookAt(0, 1.05, -11.5);

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
          activeHeavyBullets: bullets.current.filter(
            (bullet) => bullet.active && bullet.heavy,
          ).length,
          armyBounds: armyUnits.current
            .filter((unit) => unit.active)
            .reduce(
              (bounds, unit) => ({
                minX: Math.min(bounds.minX, unit.x),
                maxX: Math.max(bounds.maxX, unit.x),
                minZ: Math.min(bounds.minZ, unit.z),
                maxZ: Math.max(bounds.maxZ, unit.z),
              }),
              { minX: 99, maxX: -99, minZ: 99, maxZ: -99 },
            ),
          armyVisualSamples: armyUnits.current
            .filter((unit) => unit.active)
            .slice(0, 12)
            .map((unit) => ({
              index: unit.index,
              glowAge: state.clock.elapsedTime - unit.glowAt,
              hitAge: state.clock.elapsedTime - unit.hitAt,
              dying: unit.dying,
              deathAge: unit.dying
                ? state.clock.elapsedTime - unit.deathAt
                : null,
              bodyColor: unit.debugBodyColor,
              glowIntensity: unit.debugGlowIntensity,
              hitIntensity: unit.debugHitIntensity,
              greyAmount: unit.debugGreyAmount,
            })),
          gateStates: gateStates.current.map((gate) => ({ ...gate })),
          aliveByWave: waveEnemies.current.map(
            (wave) => wave.filter((enemy) => enemy.alive).length,
          ),
          waveStates: waveStates.current.map((wave) => ({ ...wave })),
          lastPlayerDeath: lastPlayerDeath.current,
          bossAdvance: bossAdvance.current,
          activeBossProjectiles: bossProjectiles.current.filter(
            (projectile) => projectile.active,
          ).length,
          bossShockwave: { ...bossShockwave.current },
          lastHit: lastHit.current,
          lastEnemyHit: lastEnemyHit.current,
          movementSamples: [...movementSamples.current],
          fps: fpsCounter.current.value,
          debug: {
            slow: DEBUG_SLOW,
            noAdvance: DEBUG_NO_ADVANCE,
            stopAt: DEBUG_STOP_AT,
            startAt: DEBUG_START_AT,
          },
        };
      }
    }
  });

  return (
    <>
      <SkyEnvironment />
      <fog attach="fog" args={["#c9f2f5", 48, 132]} />
      <ambientLight intensity={0.36} color="#c8f7ff" />
      <hemisphereLight args={["#dfffff", "#075b79", 0.82]} />
      <directionalLight
        position={[-8, 18, 10]}
        intensity={2.15}
        color="#fff0c8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={14}
        shadow-camera-bottom={-4}
      />

      <Road distanceRef={distance} />

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
          active={status === "playing"}
        />
      ))}
      <Boss
        distanceRef={distance}
        healthRef={bossHealth}
        activeRef={bossActive}
        hitRef={bossHitAt}
        advanceRef={bossAdvance}
        attackRef={bossAttackAt}
      />
      {!DEBUG_NO_ARMY && (
        <PlayerRig
          playerXRef={playerX}
          troopsRef={troops}
          dronesRef={drones}
          rapidRef={rapidRef}
          unitsRef={armyUnits}
          upgradePulseRef={upgradePulse}
          cannonPulseRef={cannonPulse}
          active={status === "playing"}
        />
      )}
      {!DEBUG_NO_PROJECTILES && <ProjectilePool bulletsRef={bullets} />}
      {!DEBUG_NO_PROJECTILES && (
        <BossProjectilePool projectilesRef={bossProjectiles} />
      )}
      {!DEBUG_NO_EFFECTS && (
        <BossTargetTelegraphs projectilesRef={bossProjectiles} />
      )}
      {!DEBUG_NO_EFFECTS && <BossShockwave shockwaveRef={bossShockwave} />}
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
  const sfxTimes = useRef({ shoot: 0, impact: 0 });

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
      } else if (event.type === "shoot") {
        const now = performance.now();
        if (event.heavy || now - sfxTimes.current.shoot > 75) {
          sfxTimes.current.shoot = now;
          if (event.heavy) {
            playTone(118, 0.16, "sawtooth", 0.04);
            playTone(330, 0.08, "square", 0.018, 0.015);
          } else {
            playTone(285, 0.045, "square", 0.012);
          }
        }
      } else if (event.type === "impact") {
        const now = performance.now();
        if (event.heavy || now - sfxTimes.current.impact > 55) {
          sfxTimes.current.impact = now;
          const frequency =
            event.target === "boss" ? 105 : event.target === "gate" ? 520 : 210;
          playTone(
            frequency,
            event.heavy ? 0.14 : 0.065,
            event.target === "gate" ? "triangle" : "square",
            event.heavy ? 0.038 : 0.017,
          );
          if (event.killed) {
            playTone(92, 0.11, "sawtooth", 0.018, 0.018);
          }
        }
      } else if (event.type === "wave-hit") {
        showFlash(`-${event.losses}  防线受损`, "danger");
        playTone(145, 0.15, "sawtooth", 0.04);
      } else if (event.type === "boss-hit") {
        showFlash(`CORE STRIKE  -${event.losses}`, "danger", 620);
        playTone(105, 0.13, "square", 0.03);
      } else if (event.type === "boss-fire") {
        playTone(92, 0.16, "sawtooth", 0.035);
        playTone(210, 0.08, "square", 0.02, 0.03);
      } else if (event.type === "boss-projectile-hit") {
        if (event.losses > 0) {
          showFlash(`BOSS BLAST  -${event.losses}`, "danger", 520);
        }
        playTone(118, 0.12, "square", 0.028);
      } else if (event.type === "boss-shockwave") {
        showFlash(`SHOCKWAVE  -${event.losses}`, "danger", 560);
        playTone(70, 0.34, "sawtooth", 0.045);
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

  return (
    <main className={`game-shell ${flash ? `feedback-${flash.tone}` : ""}`}>
      <Canvas
        key={runId}
        shadows="percentage"
        dpr={[1, 1.45]}
        camera={{ position: [0, 6.9, 13.2], fov: 43, near: 0.1, far: 190 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
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
