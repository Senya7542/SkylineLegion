# Skyline Legion v5.2 难度平衡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留 v5.1“1 发子弹 = +1”打门爽感的前提下，复测并收紧普通流程难度，让完整通关仍有敌群和 Boss 压力。

**Architecture:** 不改玩法结构，只增加开发期平衡记录能力，然后基于实测数据小范围调整 `gameConfig.js` 和 Boss 参数。正式玩家路径不启用自动驾驶或额外调试行为；QA 数据通过开发环境 `window.__SKYLINE_DEBUG__` 暴露。

**Tech Stack:** React 19, Vite 6, Three.js, @react-three/fiber, PowerShell, browser/Playwright verification.

---

## 文件职责

- `src/App.jsx`：添加开发期 `autoPilot` 和 `balanceLog`，记录过门、波次、Boss 开始、胜利和失败节点；如有必要，调整 Boss 血量与攻击节奏。
- `src/gameConfig.js`：调整倍增门上限、初始范围、敌人数量和推进速度。
- `design-qa.md`：追加 v5.2 实测结果、调整原因、验证结果和剩余问题。

---

### Task 1: 加开发期平衡记录和自动驾驶

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 添加 `autoPilot` 调试开关**

在 `src/App.jsx` 的调试常量区域，把下面代码加在 `const DEBUG_ENEMY_RUSH = DEBUG_FLAGS.has("enemyRush");` 后面：

```js
const DEBUG_AUTO_PILOT = DEBUG_FLAGS.has("autoPilot");
```

- [ ] **Step 2: 添加平衡日志引用**

在 `World` 组件里，把下面代码加在 `const fpsCounter = useRef({ frames: 0, elapsed: 0, value: 0 });` 后面：

```js
  const balanceLog = useRef([]);
  const bossStartedAt = useRef(null);
  const bossStartTroops = useRef(0);
```

- [ ] **Step 3: 添加平衡日志记录函数**

在 `spawnBossVolley` 函数结束后、`useEffect` 之前加入：

```js
  const recordBalanceEvent = (type, time, payload = {}) => {
    if (!import.meta.env.DEV) return;
    balanceLog.current.push({
      type,
      time: Number(time.toFixed(2)),
      distance: Number(distance.current.toFixed(2)),
      troops: troops.current,
      combo: combo.current,
      bossHealth: Number(bossHealth.current.toFixed(1)),
      ...payload,
    });
    if (balanceLog.current.length > 120) balanceLog.current.shift();
  };
```

- [ ] **Step 4: 添加自动驾驶目标选择函数**

把下面函数放在 `recordBalanceEvent` 后面：

```js
  const getAutoPilotTargetX = () => {
    const nextGateIndex = gates.findIndex(
      (_, index) => !gateStates.current[index].resolved,
    );
    if (nextGateIndex >= 0) {
      const gateState = gateStates.current[nextGateIndex];
      const leftScore = gateState.leftValue;
      const rightScore = gateState.rightValue;
      return leftScore > rightScore ? -PLAYER_LIMIT * 0.82 : PLAYER_LIMIT * 0.82;
    }
    const activeWaveIndex = WAVES.findIndex((_, index) => {
      const waveState = waveStates.current[index];
      return (
        waveState.unlocked &&
        waveEnemies.current[index].some((enemy) => enemy.alive)
      );
    });
    if (activeWaveIndex >= 0) {
      const alive = waveEnemies.current[activeWaveIndex].filter(
        (enemy) => enemy.alive,
      );
      const averageX =
        alive.reduce((sum, enemy) => sum + enemy.currentX, 0) /
        Math.max(1, alive.length);
      return clamp(averageX * 0.72, -PLAYER_LIMIT, PLAYER_LIMIT);
    }
    if (bossActive.current) {
      return Math.sin(performance.now() / 520) * PLAYER_LIMIT * 0.72;
    }
    return 0;
  };
```

- [ ] **Step 5: 使用自动驾驶目标**

在 `useFrame` 里找到：

```js
    let targetX = pointerTargetX.current;
    if (keyboard.current.left) targetX = -PLAYER_LIMIT;
    if (keyboard.current.right) targetX = PLAYER_LIMIT;
```

替换成：

```js
    let targetX = DEBUG_AUTO_PILOT
      ? getAutoPilotTargetX()
      : pointerTargetX.current;
    if (!DEBUG_AUTO_PILOT && keyboard.current.left) targetX = -PLAYER_LIMIT;
    if (!DEBUG_AUTO_PILOT && keyboard.current.right) targetX = PLAYER_LIMIT;
```

- [ ] **Step 6: 记录过门事件**

在 gate contact 逻辑里，找到 `onEvent({ type: "gate", ... });` 后面，加入：

```js
          recordBalanceEvent("gate", state.clock.elapsedTime, {
            gateIndex: index,
            side,
            value,
            leftValue: gateState.leftValue,
            rightValue: gateState.rightValue,
            previousTroops,
            resultTroops: troops.current,
          });
```

- [ ] **Step 7: 记录波次清除和敌人接触损失**

在 `onEvent({ type: "wave-clear", combo: combo.current });` 后面加入：

```js
            recordBalanceEvent("wave-clear", state.clock.elapsedTime, {
              waveIndex: index,
              aliveByWave: waveEnemies.current.map(
                (wave) => wave.filter((enemy) => enemy.alive).length,
              ),
            });
```

在 `onEvent({ type: "wave-hit", ... });` 后面加入：

```js
          recordBalanceEvent("wave-hit", state.clock.elapsedTime, {
            losses: contactLosses,
            aliveByWave: waveEnemies.current.map(
              (wave) => wave.filter((enemy) => enemy.alive).length,
            ),
          });
```

- [ ] **Step 8: 记录 Boss 开始、胜利和失败**

在 `if (distance.current >= TRACK_END && troops.current > 0) {` 下面、`bossActive.current = true;` 之前加入：

```js
        if (!bossActive.current) {
          bossStartedAt.current = state.clock.elapsedTime;
          bossStartTroops.current = troops.current;
          recordBalanceEvent("boss-start", state.clock.elapsedTime, {
            bossStartTroops: troops.current,
          });
        }
```

在胜利 `onEvent({ type: "won", ... });` 前加入：

```js
          recordBalanceEvent("won", state.clock.elapsedTime, {
            bossDuration:
              bossStartedAt.current == null
                ? 0
                : Number((state.clock.elapsedTime - bossStartedAt.current).toFixed(2)),
            bossStartTroops: bossStartTroops.current,
            finalTroops: troops.current,
          });
```

在每个 `onEvent({ type: "lost" });` 前加入同一段失败记录，使用对应上下文的 `reason`：

```js
            recordBalanceEvent("lost", state.clock.elapsedTime, {
              reason: "troops-depleted",
              bossDuration:
                bossStartedAt.current == null
                  ? 0
                  : Number((state.clock.elapsedTime - bossStartedAt.current).toFixed(2)),
              bossStartTroops: bossStartTroops.current,
            });
```

- [ ] **Step 9: 暴露 balanceLog 到调试对象**

在 `window.__SKYLINE_DEBUG__ = { ... }` 里加入：

```js
          balanceLog: [...balanceLog.current],
```

- [ ] **Step 10: 验证开发构建**

Run:

```powershell
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 11: 提交调试记录能力**

Run:

```powershell
git add src/App.jsx
git commit -m "chore: add balance audit debug hooks"
```

---

### Task 2: 跑 v5.1 基线完整流程

**Files:**
- Read: `src/App.jsx`
- Read: `src/gameConfig.js`

- [ ] **Step 1: 启动本地开发服务器**

Run:

```powershell
npm run dev
```

Expected:

```text
Local:   http://127.0.0.1:<port>/
```

- [ ] **Step 2: 用浏览器打开自动复测地址**

Open:

```text
http://127.0.0.1:<port>/?flags=autoPilot
```

点击开始按钮后，让游戏运行到胜利或失败。

- [ ] **Step 3: 读取基线数据**

在浏览器控制台读取：

```js
window.__SKYLINE_DEBUG__.balanceLog
window.__SKYLINE_DEBUG__.troops
window.__SKYLINE_DEBUG__.bossHealth
window.__SKYLINE_DEBUG__.aliveByWave
window.__SKYLINE_DEBUG__.fps
```

Expected:

```text
balanceLog contains gate, wave-clear or wave-hit, boss-start, and won/lost entries.
```

- [ ] **Step 4: 判断是否需要调参**

如果满足任意一项，就执行 Task 3：

```text
finalTroops > 160
bossDuration < 15
boss-start troops > 180
wave-hit events are absent or total wave losses < 8
```

如果没有满足这些条件，只执行 Task 4 的 QA 记录和最终验证。

---

### Task 3: 做第一轮保守数值调整

**Files:**
- Modify: `src/gameConfig.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: 调整倍增门和敌群数值**

在 `src/gameConfig.js` 里，把 `GATE_TEMPLATES` 和 `WAVES` 调整为：

```js
const GATE_TEMPLATES = [
  { z: 28, left: [-10, -5], right: [1, 4], shotsPerPoint: 1 },
  { z: 67, left: [-14, -7], right: [-1, 5], shotsPerPoint: 1 },
  { z: 108, left: [-18, -10], right: [-4, 4], shotsPerPoint: 1 },
  { z: 145, left: [-22, -13], right: [-6, 3], shotsPerPoint: 1 },
];

export const WAVES = [
  { z: 54, count: 44, speed: 2.05, gateIndex: 0 },
  { z: 94, count: 66, speed: 2.32, gateIndex: 1 },
  { z: 135, count: 86, speed: 2.62, gateIndex: 2 },
  { z: 166, count: 108, speed: 2.92, gateIndex: 3 },
];
```

在 `createGates` 返回对象里，把：

```js
      maxValue: 32 + index * 10,
```

替换成：

```js
      maxValue: 26 + index * 8,
```

- [ ] **Step 2: 调整 Boss 第一轮参数**

在 `src/App.jsx` 里，把：

```js
  const bossHealth = useRef(82);
```

替换成：

```js
  const bossHealth = useRef(112);
```

把 Boss 前压计算：

```js
                delta * (0.72 + (100 - bossHealth.current) * 0.0035),
```

替换成：

```js
                delta * (0.82 + (112 - bossHealth.current) * 0.0028),
```

把 Boss 子弹间隔：

```js
              bossVolleyTimer.current = 2.2;
```

替换成：

```js
              bossVolleyTimer.current = 1.95;
```

把 Boss 冲击波间隔：

```js
              bossShockwaveTimer.current = 5.2;
```

替换成：

```js
              bossShockwaveTimer.current = 4.7;
```

- [ ] **Step 3: 构建验证**

Run:

```powershell
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 4: 跑自动复测并读取数据**

重复 Task 2 的浏览器流程，记录 `balanceLog`、最终兵力、Boss 时长和 FPS。

- [ ] **Step 5: 如果仍然过易，执行第二轮窄调**

仅当自动复测仍满足下面任一条件时执行：

```text
finalTroops > 170
bossDuration < 15
boss-start troops > 190
```

把 `src/gameConfig.js` 的 `maxValue` 再改为：

```js
      maxValue: 24 + index * 7,
```

把 `src/App.jsx` 的 Boss 血量改为：

```js
  const bossHealth = useRef(126);
```

并把 Boss 前压计算中的 `112` 同步改成 `126`：

```js
                delta * (0.82 + (126 - bossHealth.current) * 0.0028),
```

- [ ] **Step 6: 提交数值调整**

Run:

```powershell
git add src/gameConfig.js src/App.jsx
git commit -m "fix: tune v5.2 difficulty balance"
```

---

### Task 4: 记录 QA 并完成最终验证

**Files:**
- Modify: `design-qa.md`

- [ ] **Step 1: 追加 v5.2 QA 记录**

在 `design-qa.md` 顶部当前最新 v5.1 段落之前追加：

```md
## v5.2 难度平衡验证

- Source feedback: v5.1 后倍增门已经按可见子弹命中成长；本轮检查普通流程是否过易，并只做小范围数值平衡。
- Baseline result: 写入本轮实际测得的 v5.1 基线数据，必须包含 4 次过门值、Boss 前兵力、Boss 战时长、最终兵力和胜负。
- Tuned result: 写入本轮实际测得的 v5.2 调整后数据，必须包含同一组指标，便于对比。

### Findings and patches

- [Fixed P1] 写清实际修改的倍增门、敌群或 Boss 参数，以及修改原因。
- [Fixed P1] 写清 Boss 战压力是否恢复，包含 Boss 血量、攻击节奏或前压调整。
- [Fixed P2] 写清敌群是否造成了有效损失，包含波次数量或速度调整。

### Verification

- Production build: passed.
- Browser console: zero runtime errors；已有 Three.js 上游 warning 可保留。
- AutoPilot full run: 写入胜负、最终兵力、Boss 时长和 FPS。

### Follow-up polish

- P2: 后续需要真人手感复测，确认自动驾驶平衡在手玩时也公平。
- P3: 后续模型和动画升级可以提升 Boss 威胁感，避免继续单纯堆数值。

final result: passed
```

执行时必须把上面示例中的“写入本轮实际测得...”句子替换成具体数字，例如 `第 1 门右侧 +26，过门后 38 兵`。最终提交前不能留下说明性句子。

- [ ] **Step 2: 跑空白占位检查**

Run:

```powershell
Select-String -LiteralPath 'design-qa.md' -Encoding UTF8 -Pattern '写入本轮实际测得|说明性句子|T[O]DO|T[B]D|F[I]XME'
```

Expected: no matches.

- [ ] **Step 3: 跑 diff 检查**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. LF-to-CRLF warnings are acceptable if Git reports them separately.

- [ ] **Step 4: 跑生产构建**

Run:

```powershell
npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 5: 提交 QA 记录**

Run:

```powershell
git add design-qa.md
git commit -m "docs: record v5.2 balance verification"
```

---

### Task 5: 收尾状态检查

**Files:**
- Read: repository state

- [ ] **Step 1: 检查工作区**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: 汇总提交**

Run:

```powershell
git log --oneline -5
```

Expected: includes the v5.2 debug hook commit, balance tuning commit if tuning was needed, and QA record commit.
