"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SCENARIOS } from "@/lib/scenarios";
import {
  Entity,
  EntityState,
  EntityType,
  Frame,
  Scenario,
  resolveStates,
} from "@/lib/types";
import { EntityIcon, iconSize } from "./EntityIcon";

const STORAGE_KEY = "sailing_tactics_v1";
const MOVE_TRANSITION = { duration: 0.95, ease: [0.22, 1, 0.36, 1] as const };

let idCounter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${idCounter++}`;

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export default function TacticsBoard() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    deepClone(SCENARIOS)
  );
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [frameIndex, setFrameIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const scenario =
    scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const frame = scenario.frames[frameIndex] ?? scenario.frames[0];

  // ── localStorage 로드/저장 ───────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Scenario[];
        if (Array.isArray(parsed) && parsed.length) setScenarios(parsed);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      /* ignore */
    }
  }, [scenarios, loaded]);

  // ── 보드 크기 측정 ───────────────────────────────────────
  const boardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const states = useMemo(
    () => resolveStates(scenario, frameIndex),
    [scenario, frameIndex]
  );

  // ── 프레임 이동 ──────────────────────────────────────────
  const go = useCallback(
    (dir: 1 | -1) => {
      setFrameIndex((i) =>
        clamp(i + dir, 0, scenario.frames.length - 1)
      );
    },
    [scenario.frames.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editMode) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, editMode]);

  // 시나리오 변경 시 프레임 초기화
  useEffect(() => {
    setFrameIndex(0);
    setSelectedId(null);
  }, [scenarioId]);

  // ── 드래그 (편집 모드) ───────────────────────────────────
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(
    null
  );

  const pointerToPercent = (clientX: number, clientY: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  // 현재 프레임에 엔티티 상태를 기록(병합)
  const writeState = useCallback(
    (id: string, patch: Partial<EntityState>) => {
      setScenarios((prev) =>
        prev.map((s) => {
          if (s.id !== scenarioId) return s;
          const frames = s.frames.map((f, i) => {
            if (i !== frameIndex) return f;
            const merged = resolveStates(s, i)[id] ?? { x: 50, y: 50 };
            return {
              ...f,
              states: {
                ...f.states,
                [id]: { ...merged, ...f.states[id], ...patch },
              },
            };
          });
          return { ...s, frames };
        })
      );
    },
    [scenarioId, frameIndex]
  );

  const onEntityPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editMode) return;
    e.stopPropagation();
    setSelectedId(id);
    const cur = states[id] ?? { x: 50, y: 50 };
    const p = pointerToPercent(e.clientX, e.clientY);
    dragRef.current = { id, offX: p.x - cur.x, offY: p.y - cur.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onBoardPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = pointerToPercent(e.clientX, e.clientY);
    writeState(d.id, {
      x: clamp(p.x - d.offX),
      y: clamp(p.y - d.offY),
    });
  };

  const onBoardPointerUp = () => {
    dragRef.current = null;
  };

  // ── 프레젠트 모드: 보드 클릭 → 다음 프레임 ─────────────────
  const onBoardClick = () => {
    if (editMode) {
      setSelectedId(null);
      return;
    }
    if (frameIndex < scenario.frames.length - 1) go(1);
  };

  // ── 편집 액션들 ─────────────────────────────────────────
  const updateScenario = (fn: (s: Scenario) => Scenario) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? fn(deepClone(s)) : s))
    );
  };

  const rotateSelected = (delta: number) => {
    if (!selectedId) return;
    const cur = states[selectedId] ?? { x: 50, y: 50 };
    writeState(selectedId, { rotation: (cur.rotation ?? 0) + delta });
  };

  const toggleVisibleSelected = () => {
    if (!selectedId) return;
    const cur = states[selectedId];
    writeState(selectedId, { visible: !(cur?.visible ?? false) });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    updateScenario((s) => {
      s.entities = s.entities.filter((en) => en.id !== selectedId);
      s.frames = s.frames.map((f) => {
        const st = { ...f.states };
        delete st[selectedId];
        return { ...f, states: st };
      });
      return s;
    });
    setSelectedId(null);
  };

  const addEntity = (type: EntityType) => {
    const id = uid(type);
    const colors = ["#ffd54a", "#7fd1ff", "#ff9a8b", "#b9f6ca", "#e0b0ff"];
    const ent: Entity = {
      id,
      type,
      label:
        type === "boat"
          ? String.fromCharCode(65 + (scenario.entities.filter((e) => e.type === "boat").length % 26))
          : type === "mark"
          ? "마크"
          : type === "note"
          ? "메모"
          : undefined,
      color:
        type === "boat"
          ? colors[scenario.entities.filter((e) => e.type === "boat").length % colors.length]
          : undefined,
    };
    updateScenario((s) => {
      s.entities.push(ent);
      s.frames[frameIndex].states[id] = {
        x: 50,
        y: 50,
        rotation: type === "wind" ? 180 : 0,
        visible: true,
      };
      return s;
    });
    setSelectedId(id);
  };

  const addFrame = () => {
    updateScenario((s) => {
      const idx = frameIndex;
      const newFrame: Frame = {
        id: uid("f"),
        title: `새 프레임 ${s.frames.length + 1}`,
        description: "여기에 전술 설명을 입력하세요.",
        states: {}, // 직전 프레임 위치를 상속 (변경분만 기록)
      };
      s.frames.splice(idx + 1, 0, newFrame);
      return s;
    });
    setFrameIndex((i) => i + 1);
  };

  const deleteFrame = () => {
    if (scenario.frames.length <= 1) return;
    updateScenario((s) => {
      s.frames.splice(frameIndex, 1);
      return s;
    });
    setFrameIndex((i) => clamp(i, 0, scenario.frames.length - 2));
  };

  const editFrameText = (patch: Partial<Pick<Frame, "title" | "description">>) => {
    updateScenario((s) => {
      s.frames[frameIndex] = { ...s.frames[frameIndex], ...patch };
      return s;
    });
  };

  const editEntityLabel = (label: string) => {
    if (!selectedId) return;
    updateScenario((s) => {
      const en = s.entities.find((e) => e.id === selectedId);
      if (en) en.label = label;
      return s;
    });
  };

  const resetAll = () => {
    if (!confirm("모든 편집 내용을 초기화하고 기본 시나리오로 되돌릴까요?"))
      return;
    setScenarios(deepClone(SCENARIOS));
    setScenarioId(SCENARIOS[0].id);
    setFrameIndex(0);
    setSelectedId(null);
  };

  const selectedEntity = scenario.entities.find((e) => e.id === selectedId);

  // 스타트 라인 좌표 (rc ↔ pin)
  const startLine = useMemo(() => {
    const rc = states["rc"];
    const pin = states["pin"];
    if (!rc?.visible || !pin?.visible) return null;
    return { rc, pin };
  }, [states]);

  return (
    <div style={S.root}>
      {/* 상단 바 */}
      <header style={S.topbar}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={S.logo}>⛵ Sailing Tactics</span>
          <span style={S.logoSub}>세일링 전술 보드</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            style={S.select}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditMode((v) => !v);
              setSelectedId(null);
            }}
            style={{ ...S.btn, ...(editMode ? S.btnActive : {}) }}
          >
            {editMode ? "✏️ 편집 중" : "✏️ 편집"}
          </button>
          {editMode && (
            <button onClick={resetAll} style={{ ...S.btn, ...S.btnGhost }}>
              ↺ 초기화
            </button>
          )}
        </div>
      </header>

      <div style={S.main}>
        {/* 보드 */}
        <div style={S.boardWrap}>
          <div
            ref={boardRef}
            style={{
              ...S.board,
              cursor: editMode ? "default" : "pointer",
            }}
            onClick={onBoardClick}
            onPointerMove={onBoardPointerMove}
            onPointerUp={onBoardPointerUp}
            onPointerLeave={onBoardPointerUp}
          >
            {/* 그리드 / 분필 결 */}
            <div style={S.grid} />

            {/* 스타트 라인 */}
            {startLine && size.w > 0 && (
              <svg style={S.overlay} width={size.w} height={size.h}>
                <motion.line
                  initial={false}
                  animate={{
                    x1: (startLine.pin.x / 100) * size.w,
                    y1: (startLine.pin.y / 100) * size.h,
                    x2: (startLine.rc.x / 100) * size.w,
                    y2: (startLine.rc.y / 100) * size.h,
                  }}
                  transition={MOVE_TRANSITION}
                  stroke="rgba(234,243,236,0.6)"
                  strokeWidth={2}
                  strokeDasharray="7 6"
                />
              </svg>
            )}

            {/* 엔티티 */}
            {scenario.entities.map((en) => {
              const st = states[en.id];
              if (!st) return null;
              const { w, h } = iconSize(en);
              const visible = st.visible ?? false;
              const x = (st.x / 100) * size.w;
              const y = (st.y / 100) * size.h;
              const dragging = dragRef.current?.id === en.id;
              const isSel = editMode && selectedId === en.id;
              return (
                <motion.div
                  key={en.id}
                  initial={false}
                  animate={{
                    x,
                    y,
                    rotate: en.type === "wind" ? st.rotation ?? 180 : st.rotation ?? 0,
                    opacity: visible ? 1 : 0,
                    scale: (st.scale ?? 1) * (visible ? 1 : 0.5),
                  }}
                  transition={dragging ? { duration: 0 } : MOVE_TRANSITION}
                  onPointerDown={(e) => onEntityPointerDown(e, en.id)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: w,
                    height: h,
                    marginLeft: -w / 2,
                    marginTop: -h / 2,
                    pointerEvents: visible || editMode ? "auto" : "none",
                    cursor: editMode ? "grab" : "default",
                    touchAction: "none",
                    zIndex: en.type === "wind" ? 1 : isSel ? 30 : 10,
                    filter: isSel
                      ? "drop-shadow(0 0 6px rgba(255,255,255,0.5))"
                      : "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
                  }}
                >
                  <EntityIcon entity={en} selected={isSel} />
                </motion.div>
              );
            })}

            {/* 프레임 인디케이터 (좌상단) */}
            <div style={S.frameBadge}>
              {frameIndex + 1} / {scenario.frames.length}
            </div>

            {!editMode && frameIndex < scenario.frames.length - 1 && (
              <div style={S.clickHint}>클릭하면 다음 장면 →</div>
            )}
          </div>

          {/* 필름스트립 */}
          <div style={S.filmstrip}>
            {scenario.frames.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFrameIndex(i)}
                style={{
                  ...S.chip,
                  ...(i === frameIndex ? S.chipActive : {}),
                }}
                title={f.title}
              >
                {i + 1}
              </button>
            ))}
            {editMode && (
              <button onClick={addFrame} style={{ ...S.chip, ...S.chipAdd }}>
                ＋
              </button>
            )}
          </div>
        </div>

        {/* 사이드 패널 */}
        <aside style={S.panel}>
          {!editMode ? (
            <PresentPanel
              scenario={scenario}
              frame={frame}
              frameIndex={frameIndex}
              go={go}
            />
          ) : (
            <EditPanel
              frame={frame}
              editFrameText={editFrameText}
              addEntity={addEntity}
              addFrame={addFrame}
              deleteFrame={deleteFrame}
              canDeleteFrame={scenario.frames.length > 1}
              selectedEntity={selectedEntity}
              selectedState={selectedId ? states[selectedId] : undefined}
              editEntityLabel={editEntityLabel}
              rotateSelected={rotateSelected}
              toggleVisibleSelected={toggleVisibleSelected}
              deleteSelected={deleteSelected}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ── 프레젠트 패널 ───────────────────────────────────────────
function PresentPanel({
  scenario,
  frame,
  frameIndex,
  go,
}: {
  scenario: Scenario;
  frame: Frame;
  frameIndex: number;
  go: (d: 1 | -1) => void;
}) {
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={S.scenarioName}>{scenario.name}</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={frame.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <h2 style={S.frameTitle} className="chalk-text">
              {frame.title}
            </h2>
            <p style={S.frameDesc}>{frame.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={S.navRow}>
        <button
          onClick={() => go(-1)}
          disabled={frameIndex === 0}
          style={{
            ...S.navBtn,
            opacity: frameIndex === 0 ? 0.35 : 1,
          }}
        >
          ← 이전
        </button>
        <button
          onClick={() => go(1)}
          disabled={frameIndex === scenario.frames.length - 1}
          style={{
            ...S.navBtn,
            ...S.navBtnPrimary,
            opacity:
              frameIndex === scenario.frames.length - 1 ? 0.35 : 1,
          }}
        >
          다음 →
        </button>
      </div>
      <p style={S.kbdHint}>← / → 또는 Space · 보드 클릭으로도 이동</p>
    </>
  );
}

// ── 편집 패널 ───────────────────────────────────────────────
function EditPanel({
  frame,
  editFrameText,
  addEntity,
  addFrame,
  deleteFrame,
  canDeleteFrame,
  selectedEntity,
  selectedState,
  editEntityLabel,
  rotateSelected,
  toggleVisibleSelected,
  deleteSelected,
}: {
  frame: Frame;
  editFrameText: (p: Partial<Pick<Frame, "title" | "description">>) => void;
  addEntity: (t: EntityType) => void;
  addFrame: () => void;
  deleteFrame: () => void;
  canDeleteFrame: boolean;
  selectedEntity?: Entity;
  selectedState?: EntityState;
  editEntityLabel: (s: string) => void;
  rotateSelected: (d: number) => void;
  toggleVisibleSelected: () => void;
  deleteSelected: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
      <div>
        <label style={S.label}>프레임 제목</label>
        <input
          style={S.input}
          value={frame.title}
          onChange={(e) => editFrameText({ title: e.target.value })}
        />
      </div>
      <div>
        <label style={S.label}>전술 설명</label>
        <textarea
          style={{ ...S.input, height: 120, resize: "vertical" }}
          value={frame.description}
          onChange={(e) => editFrameText({ description: e.target.value })}
        />
      </div>

      <div>
        <label style={S.label}>프레임</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addFrame} style={{ ...S.btn, flex: 1 }}>
            ＋ 프레임 추가
          </button>
          <button
            onClick={deleteFrame}
            disabled={!canDeleteFrame}
            style={{ ...S.btn, ...S.btnGhost, flex: 1, opacity: canDeleteFrame ? 1 : 0.4 }}
          >
            🗑 삭제
          </button>
        </div>
        <p style={S.tip}>
          팁: 새 프레임은 직전 장면을 그대로 물려받습니다. 보드에서 보트만
          옮기면 그 차이가 매직 트랜지션으로 재생됩니다.
        </p>
      </div>

      <div>
        <label style={S.label}>오브젝트 추가</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {([
            ["boat", "⛵ 보트"],
            ["mark", "🟠 마크"],
            ["committee", "🚩 본부선"],
            ["pin", "🟡 핀"],
            ["wind", "💨 바람"],
            ["note", "💬 메모"],
          ] as [EntityType, string][]).map(([t, label]) => (
            <button key={t} onClick={() => addEntity(t)} style={{ ...S.btn, ...S.btnSm }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.selBox}>
        <label style={S.label}>선택된 오브젝트</label>
        {!selectedEntity ? (
          <p style={S.tip}>보드에서 오브젝트를 클릭해 선택하세요.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: "var(--chalk-dim)" }}>
              타입: {selectedEntity.type}
            </div>
            {selectedEntity.label !== undefined && (
              <input
                style={S.input}
                value={selectedEntity.label}
                placeholder="라벨"
                onChange={(e) => editEntityLabel(e.target.value)}
              />
            )}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => rotateSelected(-15)} style={{ ...S.btn, ...S.btnSm }}>
                ↺ 회전
              </button>
              <button onClick={() => rotateSelected(15)} style={{ ...S.btn, ...S.btnSm }}>
                회전 ↻
              </button>
              <span style={{ fontSize: 12, color: "var(--chalk-dim)" }}>
                {Math.round(selectedState?.rotation ?? 0)}°
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={toggleVisibleSelected} style={{ ...S.btn, ...S.btnSm, flex: 1 }}>
                {selectedState?.visible ? "👁 숨기기" : "👁 보이기"}
              </button>
              <button
                onClick={deleteSelected}
                style={{ ...S.btn, ...S.btnSm, ...S.btnGhost, flex: 1 }}
              >
                🗑 삭제
              </button>
            </div>
            <p style={S.tip}>드래그해서 위치를 옮길 수 있어요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 스타일 ───────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 18px",
    background: "rgba(8,24,21,0.9)",
    borderBottom: "1px solid rgba(234,243,236,0.1)",
    flexWrap: "wrap",
  },
  logo: { fontSize: 19, fontWeight: 800, letterSpacing: "0.01em" },
  logoSub: { fontSize: 12, color: "var(--chalk-dim)" },
  main: { flex: 1, display: "flex", minHeight: 0 },
  boardWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 18,
    gap: 12,
    minWidth: 0,
  },
  board: {
    position: "relative",
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    background:
      "radial-gradient(120% 100% at 50% 0%, #1b4a42 0%, var(--board-1) 45%, var(--board-2) 100%)",
    border: "10px solid #6b4a2e",
    boxShadow:
      "inset 0 0 80px rgba(0,0,0,0.45), 0 12px 30px rgba(0,0,0,0.4)",
    userSelect: "none",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(234,243,236,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(234,243,236,0.05) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  overlay: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 },
  frameBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--chalk-dim)",
    background: "rgba(8,24,21,0.5)",
    padding: "4px 9px",
    borderRadius: 20,
    zIndex: 40,
    pointerEvents: "none",
  },
  clickHint: {
    position: "absolute",
    bottom: 12,
    right: 14,
    fontSize: 12,
    color: "var(--chalk-faint)",
    zIndex: 40,
    pointerEvents: "none",
    animation: "none",
  },
  filmstrip: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid rgba(234,243,236,0.2)",
    background: "rgba(8,24,21,0.5)",
    color: "var(--chalk-dim)",
    fontWeight: 700,
    fontSize: 13,
  },
  chipActive: {
    background: "var(--hero)",
    color: "#0b1f1c",
    border: "1px solid var(--hero)",
  },
  chipAdd: { border: "1px dashed rgba(234,243,236,0.3)", color: "var(--chalk-dim)" },
  panel: {
    width: 360,
    flexShrink: 0,
    background: "var(--panel)",
    borderLeft: "1px solid rgba(234,243,236,0.1)",
    padding: 22,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  scenarioName: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--hero)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  frameTitle: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1.25,
    margin: "0 0 14px",
  },
  frameDesc: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(234,243,236,0.88)",
    margin: 0,
  },
  navRow: { display: "flex", gap: 10, marginTop: 16 },
  navBtn: {
    flex: 1,
    padding: "11px 14px",
    borderRadius: 9,
    border: "1px solid rgba(234,243,236,0.25)",
    background: "transparent",
    color: "var(--chalk)",
    fontWeight: 700,
    fontSize: 14,
  },
  navBtnPrimary: {
    background: "var(--hero)",
    color: "#0b1f1c",
    border: "1px solid var(--hero)",
  },
  kbdHint: {
    fontSize: 11.5,
    color: "var(--chalk-faint)",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 0,
  },
  select: {
    padding: "8px 10px",
    borderRadius: 8,
    background: "rgba(8,24,21,0.6)",
    color: "var(--chalk)",
    border: "1px solid rgba(234,243,236,0.2)",
    fontSize: 13,
  },
  btn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(234,243,236,0.22)",
    background: "rgba(234,243,236,0.08)",
    color: "var(--chalk)",
    fontWeight: 600,
    fontSize: 13,
  },
  btnSm: { padding: "6px 9px", fontSize: 12 },
  btnActive: { background: "var(--hero)", color: "#0b1f1c", border: "1px solid var(--hero)" },
  btnGhost: { background: "transparent" },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--chalk-dim)",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 8,
    background: "rgba(8,24,21,0.55)",
    color: "var(--chalk)",
    border: "1px solid rgba(234,243,236,0.2)",
    fontSize: 14,
  },
  tip: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--chalk-faint)",
    margin: "6px 0 0",
  },
  selBox: {
    borderTop: "1px solid rgba(234,243,236,0.12)",
    paddingTop: 14,
  },
};
