// Gameplay owns transforms, collision and state. Renderers only consume this contract,
// so procedural meshes can later be replaced by GLB/FBX-derived adapters.
export const ENTITY_VISUALS = {
  playerSoldier: {
    source: "procedural",
    modelUrl: null,
    scale: 0.92,
    facing: "-Z",
    clips: {
      idle: "Idle",
      run: "Run",
      shoot: "Shoot",
      hit: "Hit",
      death: "Death",
    },
    sockets: { muzzle: "Muzzle" },
  },
  enemySoldier: {
    source: "procedural",
    modelUrl: null,
    scale: 1,
    facing: "+Z",
    clips: {
      idle: "Idle",
      run: "Run",
      hit: "Hit",
      death: "Death",
    },
  },
  boss: {
    source: "procedural",
    modelUrl: null,
    scale: 1,
    facing: "+Z",
    clips: {
      idle: "Idle",
      move: "Move",
      attack: "Attack",
      hit: "Hit",
      death: "Death",
    },
    sockets: {
      muzzleLeft: "Muzzle_L",
      muzzleRight: "Muzzle_R",
      weakPoint: "WeakPoint",
    },
  },
};

export function unitVisualState(unit, time) {
  if (unit.dying) return "death";
  if (time - unit.hitAt < 0.2) return "hit";
  return "run";
}
