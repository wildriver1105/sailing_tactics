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
  LineStyle,
  Scenario,
  resolveStates,
} from "@/lib/types";
import { EntityIcon, iconSize } from "./EntityIcon";

const STORAGE_KEY = "sailing_tactics_v1";
const MOVE_TRANSITION = { duration: 0.95, ease: [0.22, 1, 0.36, 1] as const };

/** 라인 스타일별 시각 설정 */
const LINE_STYLES: Record<
  LineStyle,
  { color: string; dash: string; width: number; arrow: "none" | "end" | "both"; ko: string }
> = {
  layline: { color: "#9fe1ff", dash: "9 7", width: 2, arrow: "none", ko: "레이라인" },
  divider: { color: "#ffd54a", dash: "2 8", width: 2, arrow: "none", ko: "구분선" },
  overlap: { color: "#9be7b0", dash: "0", width: 2.5, arrow: "both", ko: "오버랩" },
  plain: { color: "#eaf3ec", dash: "0", width: 2, arrow: "end", ko: "화살표/라인" },
};

function lineCfg(en: Entity) {
  const base = LINE_STYLES[en.lineStyle ?? "plain"];
  return { ...base, color: en.color ?? base.color };
}

// ── 프리젠테이션 주석 (키노트식 펜/지우개/레이저/텍스트) ──────────
type PresentTool = "cursor" | "pen" | "eraser" | "laser" | "text";
interface Stroke {
  id: string;
  color: string;
  width: number; // px
  pts: { x: number; y: number }[]; // 퍼센트 좌표
}
interface TextAnno {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}
const INK_COLORS = ["#ff5a5a", "#ffd54a", "#7fd1ff", "#b9f6ca", "#ffffff"];

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isSelected = (id: string) => selectedIds.includes(id);
  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;
  // 라인 그리기: 장착된 스타일(드래그 대기) + 드래그 중 미리보기 좌표
  const [drawStyle, setDrawStyle] = useState<LineStyle | null>(null);
  const [draft, setDraft] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  // 프리젠테이션 주석 도구
  const [tool, setTool] = useState<PresentTool>("cursor");
  const [penColor, setPenColor] = useState(INK_COLORS[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [texts, setTexts] = useState<TextAnno[]>([]);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);

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
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      // Esc → 삭제 확인창 / 그리기 도구 장착 취소
      if (e.key === "Escape") {
        if (confirmOpen) {
          setConfirmOpen(false);
          return;
        }
        if (drawStyle) {
          setDrawStyle(null);
          setDraft(null);
          return;
        }
        if (!editMode && tool !== "cursor") {
          setTool("cursor");
          return;
        }
      }
      // 삭제 확인창이 열려 있으면 Enter로 확정
      if (confirmOpen) {
        if (e.key === "Enter") {
          e.preventDefault();
          deleteSelectedMany();
        }
        return;
      }
      // 편집 모드 + 선택 있음 + Backspace/Delete → 삭제 확인
      if (
        editMode &&
        !typing &&
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        setConfirmOpen(true);
        return;
      }
      if (editMode || typing) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, editMode, drawStyle, confirmOpen, selectedIds, tool]);

  // 시나리오 변경 시 프레임 초기화
  useEffect(() => {
    setFrameIndex(0);
    setSelectedIds([]);
    setConfirmOpen(false);
    setDrawStyle(null);
    setDraft(null);
  }, [scenarioId]);

  // 주석 모두 지우기
  const clearAnnotations = useCallback(() => {
    strokeRef.current = null;
    erasingRef.current = false;
    setStrokes([]);
    setTexts([]);
    setLiveStroke(null);
    setLaser(null);
    setEditingTextId(null);
  }, []);

  // 프레임 전환 시 주석 자동 정리 (키노트와 동일하게 장면마다 깨끗하게)
  useEffect(() => {
    clearAnnotations();
  }, [frameIndex, scenarioId, clearAnnotations]);

  // 편집 모드로 들어가면 주석/도구 초기화
  useEffect(() => {
    if (editMode) {
      setTool("cursor");
      clearAnnotations();
    }
  }, [editMode, clearAnnotations]);

  // ── 드래그 (편집 모드) ───────────────────────────────────
  // mode: point=일반 오브젝트, lineA/lineB=라인 끝점, lineMove=라인 전체
  type DragState = {
    id: string;
    mode: "point" | "lineA" | "lineB" | "lineMove";
    offX: number;
    offY: number;
    /** lineMove 시 끝점 B - A 벡터 유지 */
    vx?: number;
    vy?: number;
  };
  const dragRef = useRef<DragState | null>(null);
  // 라인 드래그-그리기 중 현재 좌표(state 배칭과 무관하게 항상 최신) / 직후 클릭 억제 플래그
  const drawRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  // 마퀴(드래그) 다중 선택 — 좌표는 ref에 즉시 반영(배칭 무관), 미리보기는 state
  const marqueeRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    shift: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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

  const capture = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* 활성 포인터가 없는 환경에서는 무시 */
    }
  };

  const onEntityPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editMode) return;
    e.stopPropagation();
    // Shift+클릭 → 선택 토글(드래그 안 함)
    if (e.shiftKey) {
      toggleSelect(id);
      suppressClickRef.current = true;
      return;
    }
    // 이미 다중 선택에 포함된 항목이면 선택 유지(그룹 이동), 아니면 단독 선택
    setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
    const cur = states[id] ?? { x: 50, y: 50 };
    const p = pointerToPercent(e.clientX, e.clientY);
    dragRef.current = { id, mode: "point", offX: p.x - cur.x, offY: p.y - cur.y };
    capture(e);
  };

  // 라인 본체 드래그(전체 이동) / 끝점 핸들 드래그
  const onLinePointerDown = (
    e: React.PointerEvent,
    id: string,
    mode: "lineA" | "lineB" | "lineMove"
  ) => {
    if (!editMode) return;
    e.stopPropagation();
    if (e.shiftKey && mode === "lineMove") {
      toggleSelect(id);
      suppressClickRef.current = true;
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
    const cur = states[id] ?? { x: 50, y: 50 };
    const p = pointerToPercent(e.clientX, e.clientY);
    if (mode === "lineB") {
      dragRef.current = {
        id,
        mode,
        offX: p.x - (cur.x2 ?? cur.x),
        offY: p.y - (cur.y2 ?? cur.y),
      };
    } else if (mode === "lineMove") {
      dragRef.current = {
        id,
        mode,
        offX: p.x - cur.x,
        offY: p.y - cur.y,
        vx: (cur.x2 ?? cur.x) - cur.x,
        vy: (cur.y2 ?? cur.y) - cur.y,
      };
    } else {
      dragRef.current = { id, mode, offX: p.x - cur.x, offY: p.y - cur.y };
    }
    capture(e);
  };

  // ── 프리젠테이션 주석 처리 ───────────────────────────────
  const eraseAt = (p: { x: number; y: number }) => {
    const near = (a: { x: number; y: number }) =>
      Math.hypot(a.x - p.x, a.y - p.y) < 3.5;
    setStrokes((prev) => prev.filter((s) => !s.pts.some(near)));
    setTexts((prev) =>
      prev.filter((t) => Math.hypot(t.x - p.x, t.y - p.y) > 5)
    );
  };

  const onPresentPointerDown = (e: React.PointerEvent) => {
    if (tool === "cursor") return; // 클릭→다음 장면은 onBoardClick에서 처리
    const p = pointerToPercent(e.clientX, e.clientY);
    if (tool === "pen") {
      strokeRef.current = { id: uid("st"), color: penColor, width: 3, pts: [p] };
      setLiveStroke({ ...strokeRef.current });
      capture(e);
    } else if (tool === "eraser") {
      erasingRef.current = true;
      eraseAt(p);
      capture(e);
    } else if (tool === "laser") {
      setLaser(p);
      capture(e);
    } else if (tool === "text") {
      const t: TextAnno = { id: uid("tx"), x: p.x, y: p.y, text: "", color: penColor };
      setTexts((prev) => [...prev, t]);
      setEditingTextId(t.id);
    }
  };

  const onPresentPointerMove = (e: React.PointerEvent) => {
    const p = pointerToPercent(e.clientX, e.clientY);
    if (tool === "laser") {
      setLaser(p);
      return;
    }
    if (tool === "pen" && strokeRef.current) {
      strokeRef.current.pts.push(p);
      setLiveStroke({ ...strokeRef.current, pts: [...strokeRef.current.pts] });
      return;
    }
    if (tool === "eraser" && erasingRef.current) eraseAt(p);
  };

  const onPresentPointerUp = () => {
    if (strokeRef.current) {
      const s = strokeRef.current;
      if (s.pts.length > 1) setStrokes((prev) => [...prev, s]);
      strokeRef.current = null;
      setLiveStroke(null);
    }
    erasingRef.current = false;
  };

  // 빈 보드에서 누르기: 그리기 도구가 있으면 라인 그리기, 아니면 마퀴(다중 선택) 시작
  const onBoardPointerDown = (e: React.PointerEvent) => {
    if (!editMode) {
      onPresentPointerDown(e);
      return;
    }
    const p = pointerToPercent(e.clientX, e.clientY);
    if (drawStyle) {
      drawRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
      setDraft({ ...drawRef.current });
      capture(e);
      return;
    }
    // 마퀴 선택 시작
    marqueeRef.current = {
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      shift: e.shiftKey,
    };
    setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    capture(e);
  };

  const onBoardPointerMove = (e: React.PointerEvent) => {
    if (!editMode) {
      onPresentPointerMove(e);
      return;
    }
    const p = pointerToPercent(e.clientX, e.clientY);
    // 드래그-그리기 중 (좌표는 ref에 즉시 반영, 미리보기는 state로)
    if (drawRef.current) {
      drawRef.current.x2 = clamp(p.x);
      drawRef.current.y2 = clamp(p.y);
      setDraft({ ...drawRef.current });
      return;
    }
    // 마퀴 드래그 중
    if (marqueeRef.current) {
      marqueeRef.current.x2 = clamp(p.x);
      marqueeRef.current.y2 = clamp(p.y);
      const { x1, y1, x2, y2 } = marqueeRef.current;
      setMarquee({ x1, y1, x2, y2 });
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "lineB") {
      writeState(d.id, { x2: clamp(p.x - d.offX), y2: clamp(p.y - d.offY) });
    } else if (d.mode === "lineMove") {
      const ax = clamp(p.x - d.offX);
      const ay = clamp(p.y - d.offY);
      writeState(d.id, {
        x: ax,
        y: ay,
        x2: clamp(ax + (d.vx ?? 0)),
        y2: clamp(ay + (d.vy ?? 0)),
      });
    } else {
      // point / lineA → 끝점 A(=x,y) 이동
      writeState(d.id, { x: clamp(p.x - d.offX), y: clamp(p.y - d.offY) });
    }
  };

  const onBoardPointerUp = () => {
    if (!editMode) {
      onPresentPointerUp();
      return;
    }
    // 드래그-그리기 종료 → 일정 길이 이상이면 라인 생성
    const d = drawRef.current;
    if (d && drawStyle) {
      if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= 2.5) {
        addLine(drawStyle, d);
        suppressClickRef.current = true; // 직후 click이 선택을 풀지 않도록
      }
      drawRef.current = null;
      setDraft(null);
      setDrawStyle(null);
    }
    // 마퀴 종료 → 사각형 안의 오브젝트 선택
    const m = marqueeRef.current;
    if (m) {
      const lo = { x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2) };
      const hi = { x: Math.max(m.x1, m.x2), y: Math.max(m.y1, m.y2) };
      const dragged = Math.hypot(m.x2 - m.x1, m.y2 - m.y1) >= 1.5;
      if (dragged) {
        const hits = entitiesInRect(lo, hi);
        setSelectedIds((prev) =>
          m.shift ? Array.from(new Set([...prev, ...hits])) : hits
        );
      } else if (!m.shift) {
        // 거의 클릭 → 빈 곳 클릭으로 간주, 선택 해제
        setSelectedIds([]);
      }
      suppressClickRef.current = true;
      marqueeRef.current = null;
      setMarquee(null);
    }
    dragRef.current = null;
  };

  // 사각형(퍼센트) 안에 들어오는 보이는 오브젝트 id 목록
  const entitiesInRect = (
    lo: { x: number; y: number },
    hi: { x: number; y: number }
  ): string[] => {
    const inRect = (x: number, y: number) =>
      x >= lo.x && x <= hi.x && y >= lo.y && y <= hi.y;
    return scenario.entities
      .filter((en) => {
        const st = states[en.id];
        if (!st || !(st.visible ?? false)) return false;
        if (en.type === "line") {
          // 라인: 중점 기준
          const mx = (st.x + (st.x2 ?? st.x)) / 2;
          const my = (st.y + (st.y2 ?? st.y)) / 2;
          return inRect(mx, my);
        }
        return inRect(st.x, st.y);
      })
      .map((en) => en.id);
  };

  // ── 프레젠트 모드: 보드 클릭 → 다음 프레임 ─────────────────
  const onBoardClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (editMode) {
      setSelectedIds([]);
      return;
    }
    // 주석 도구 사용 중에는 클릭으로 장면을 넘기지 않음 (커서 도구일 때만)
    if (tool !== "cursor") return;
    if (frameIndex < scenario.frames.length - 1) go(1);
  };

  // ── 편집 액션들 ─────────────────────────────────────────
  const updateScenario = (fn: (s: Scenario) => Scenario) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? fn(deepClone(s)) : s))
    );
  };

  const rotateSelected = (delta: number) => {
    if (!primaryId) return;
    const cur = states[primaryId] ?? { x: 50, y: 50 };
    writeState(primaryId, { rotation: (cur.rotation ?? 0) + delta });
  };

  const toggleVisibleSelected = () => {
    if (!primaryId) return;
    const cur = states[primaryId];
    writeState(primaryId, { visible: !(cur?.visible ?? false) });
  };

  // 선택된 모든 오브젝트 삭제
  const deleteSelectedMany = () => {
    if (!selectedIds.length) return;
    const ids = new Set(selectedIds);
    updateScenario((s) => {
      s.entities = s.entities.filter((en) => !ids.has(en.id));
      s.frames = s.frames.map((f) => {
        const st = { ...f.states };
        ids.forEach((id) => delete st[id]);
        return { ...f, states: st };
      });
      return s;
    });
    setSelectedIds([]);
    setConfirmOpen(false);
  };

  const addEntity = (type: EntityType, lineStyle?: LineStyle) => {
    const id = uid(type);
    const colors = ["#ffd54a", "#7fd1ff", "#ff9a8b", "#b9f6ca", "#e0b0ff"];
    const ent: Entity = {
      id,
      type,
      lineStyle: type === "line" ? lineStyle ?? "plain" : undefined,
      label:
        type === "boat"
          ? String.fromCharCode(65 + (scenario.entities.filter((e) => e.type === "boat").length % 26))
          : type === "mark"
          ? "마크"
          : type === "note"
          ? "메모"
          : type === "line"
          ? LINE_STYLES[lineStyle ?? "plain"].ko
          : undefined,
      color:
        type === "boat"
          ? colors[scenario.entities.filter((e) => e.type === "boat").length % colors.length]
          : undefined,
    };
    updateScenario((s) => {
      s.entities.push(ent);
      s.frames[frameIndex].states[id] =
        type === "line"
          ? { x: 35, y: 40, x2: 65, y2: 70, visible: true }
          : { x: 50, y: 50, rotation: type === "wind" ? 180 : 0, visible: true };
      return s;
    });
    setSelectedIds([id]);
  };

  // 드래그-그리기로 라인 생성
  const addLine = (
    style: LineStyle,
    d: { x1: number; y1: number; x2: number; y2: number }
  ) => {
    const id = uid("line");
    const ent: Entity = {
      id,
      type: "line",
      lineStyle: style,
      label: LINE_STYLES[style].ko,
    };
    updateScenario((s) => {
      s.entities.push(ent);
      s.frames[frameIndex].states[id] = {
        x: d.x1,
        y: d.y1,
        x2: d.x2,
        y2: d.y2,
        visible: true,
      };
      return s;
    });
    setSelectedIds([id]);
  };

  // 선택된 라인의 스타일 변경
  const setLineStyle = (style: LineStyle) => {
    if (!primaryId) return;
    updateScenario((s) => {
      const en = s.entities.find((e) => e.id === primaryId);
      if (en && en.type === "line") en.lineStyle = style;
      return s;
    });
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
    if (!primaryId) return;
    updateScenario((s) => {
      const en = s.entities.find((e) => e.id === primaryId);
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
    setSelectedIds([]);
  };

  const selectedEntity = scenario.entities.find((e) => e.id === primaryId);

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
              setSelectedIds([]);
              setConfirmOpen(false);
              setDrawStyle(null);
              setDraft(null);
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
              cursor: drawStyle
                ? "crosshair"
                : editMode
                ? "default"
                : tool === "cursor"
                ? "pointer"
                : tool === "laser"
                ? "none"
                : "crosshair",
            }}
            onClick={onBoardClick}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onBoardPointerMove}
            onPointerUp={onBoardPointerUp}
            onPointerLeave={() => {
              onBoardPointerUp();
              setLaser(null);
            }}
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

            {/* 라인 레이어 (레이라인 / 구분선 / 오버랩 / 화살표) */}
            {size.w > 0 && (
              <svg
                style={{ ...S.overlay, zIndex: 2 }}
                width={size.w}
                height={size.h}
              >
                <defs>
                  <marker
                    id="st-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
                  </marker>
                </defs>
                {scenario.entities
                  .filter((en) => en.type === "line")
                  .map((en) => {
                    const st = states[en.id];
                    if (!st) return null;
                    const cfg = lineCfg(en);
                    const visible = st.visible ?? false;
                    const ax = (st.x / 100) * size.w;
                    const ay = (st.y / 100) * size.h;
                    const bx = ((st.x2 ?? st.x) / 100) * size.w;
                    const by = ((st.y2 ?? st.y) / 100) * size.h;
                    const mx = (ax + bx) / 2;
                    const my = (ay + by) / 2;
                    const dragging = dragRef.current?.id === en.id;
                    const isSel = editMode && isSelected(en.id);
                    const tr = dragging ? { duration: 0 } : MOVE_TRANSITION;
                    const coords = { x1: ax, y1: ay, x2: bx, y2: by };
                    return (
                      <g key={en.id} opacity={visible ? 1 : 0}>
                        {isSel && (
                          <motion.line
                            initial={false}
                            animate={coords}
                            transition={tr}
                            stroke="#ffffff"
                            strokeOpacity={0.25}
                            strokeWidth={cfg.width + 8}
                            strokeLinecap="round"
                          />
                        )}
                        <motion.line
                          initial={false}
                          animate={coords}
                          transition={tr}
                          stroke={cfg.color}
                          strokeWidth={cfg.width}
                          strokeLinecap="round"
                          strokeDasharray={cfg.dash === "0" ? undefined : cfg.dash}
                          markerEnd={
                            cfg.arrow !== "none" ? "url(#st-arrow)" : undefined
                          }
                          markerStart={
                            cfg.arrow === "both" ? "url(#st-arrow)" : undefined
                          }
                        />
                        {en.label && (
                          <motion.text
                            initial={false}
                            animate={{ x: mx, y: my }}
                            transition={tr}
                            dy={-9}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={600}
                            fill={cfg.color}
                            stroke="#0b1f1c"
                            strokeWidth={0.6}
                            style={{ paintOrder: "stroke", pointerEvents: "none" }}
                          >
                            {en.label}
                          </motion.text>
                        )}
                      </g>
                    );
                  })}
              </svg>
            )}

            {/* 라인 상호작용 레이어 (보트 위) — 본체를 잡아 전체 이동/선택 */}
            {editMode && !drawStyle && size.w > 0 && (
              <svg
                style={{ ...S.overlay, zIndex: 20 }}
                width={size.w}
                height={size.h}
              >
                {scenario.entities
                  .filter((en) => en.type === "line")
                  .map((en) => {
                    const st = states[en.id];
                    if (!st || !(st.visible ?? false)) return null;
                    const dragging = dragRef.current?.id === en.id;
                    const tr = dragging ? { duration: 0 } : MOVE_TRANSITION;
                    return (
                      <motion.line
                        key={en.id}
                        initial={false}
                        animate={{
                          x1: (st.x / 100) * size.w,
                          y1: (st.y / 100) * size.h,
                          x2: ((st.x2 ?? st.x) / 100) * size.w,
                          y2: ((st.y2 ?? st.y) / 100) * size.h,
                        }}
                        transition={tr}
                        stroke="transparent"
                        strokeWidth={22}
                        strokeLinecap="round"
                        style={{ pointerEvents: "stroke", cursor: "move" }}
                        onPointerDown={(e) =>
                          onLinePointerDown(e, en.id, "lineMove")
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    );
                  })}
              </svg>
            )}

            {/* 선택된 라인의 끝점 핸들 (보트 위 레이어) */}
            {editMode &&
              !drawStyle &&
              selectedEntity?.type === "line" &&
              size.w > 0 &&
              (() => {
                const st = states[selectedEntity.id];
                if (!st) return null;
                const pts: [("lineA" | "lineB"), number, number][] = [
                  ["lineA", (st.x / 100) * size.w, (st.y / 100) * size.h],
                  [
                    "lineB",
                    ((st.x2 ?? st.x) / 100) * size.w,
                    ((st.y2 ?? st.y) / 100) * size.h,
                  ],
                ];
                const hColor = lineCfg(selectedEntity).color;
                return (
                  <svg
                    style={{ ...S.overlay, zIndex: 36 }}
                    width={size.w}
                    height={size.h}
                  >
                    {pts.map(([mode, cx, cy]) => (
                      <g
                        key={mode}
                        style={{ pointerEvents: "auto", cursor: "grab" }}
                        onPointerDown={(e) =>
                          onLinePointerDown(e, selectedEntity.id, mode)
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 넉넉한 히트 영역 */}
                        <circle cx={cx} cy={cy} r={16} fill="transparent" />
                        {/* 보이는 핸들 */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={7.5}
                          fill="#0b1f1c"
                          stroke={hColor}
                          strokeWidth={3}
                        />
                        <circle cx={cx} cy={cy} r={2} fill={hColor} />
                      </g>
                    ))}
                  </svg>
                );
              })()}

            {/* 드래그-그리기 미리보기 */}
            {draft && drawStyle && size.w > 0 && (
              <svg
                style={{ ...S.overlay, zIndex: 37 }}
                width={size.w}
                height={size.h}
              >
                <line
                  x1={(draft.x1 / 100) * size.w}
                  y1={(draft.y1 / 100) * size.h}
                  x2={(draft.x2 / 100) * size.w}
                  y2={(draft.y2 / 100) * size.h}
                  stroke={LINE_STYLES[drawStyle].color}
                  strokeWidth={LINE_STYLES[drawStyle].width}
                  strokeLinecap="round"
                  strokeDasharray={
                    LINE_STYLES[drawStyle].dash === "0"
                      ? undefined
                      : LINE_STYLES[drawStyle].dash
                  }
                  opacity={0.9}
                  markerEnd={
                    LINE_STYLES[drawStyle].arrow !== "none"
                      ? "url(#st-arrow)"
                      : undefined
                  }
                  markerStart={
                    LINE_STYLES[drawStyle].arrow === "both"
                      ? "url(#st-arrow)"
                      : undefined
                  }
                />
              </svg>
            )}

            {/* 마퀴(드래그) 선택 사각형 */}
            {marquee && size.w > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: (Math.min(marquee.x1, marquee.x2) / 100) * size.w,
                  top: (Math.min(marquee.y1, marquee.y2) / 100) * size.h,
                  width: (Math.abs(marquee.x2 - marquee.x1) / 100) * size.w,
                  height: (Math.abs(marquee.y2 - marquee.y1) / 100) * size.h,
                  border: "1px solid rgba(255,213,74,0.9)",
                  background: "rgba(255,213,74,0.12)",
                  borderRadius: 3,
                  zIndex: 38,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* 엔티티 (라인은 별도 레이어에서 렌더) */}
            {scenario.entities.map((en) => {
              if (en.type === "line") return null;
              const st = states[en.id];
              if (!st) return null;
              const { w, h } = iconSize(en);
              const visible = st.visible ?? false;
              const x = (st.x / 100) * size.w;
              const y = (st.y / 100) * size.h;
              const dragging = dragRef.current?.id === en.id;
              const isSel = editMode && isSelected(en.id);
              return (
                <motion.div
                  key={en.id}
                  data-entity-id={en.id}
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
                  onClick={(e) => {
                    // 편집 모드: 말 클릭이 보드로 전파돼 선택이 풀리는 것을 막음
                    if (editMode) e.stopPropagation();
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: w,
                    height: h,
                    marginLeft: -w / 2,
                    marginTop: -h / 2,
                    pointerEvents:
                      drawStyle || (!editMode && tool !== "cursor")
                        ? "none"
                        : visible || editMode
                        ? "auto"
                        : "none",
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

            {!editMode &&
              tool === "cursor" &&
              frameIndex < scenario.frames.length - 1 && (
                <div style={S.clickHint}>클릭하면 다음 장면 →</div>
              )}

            {drawStyle && (
              <div style={S.drawBanner}>
                🖉 {LINE_STYLES[drawStyle].ko} 그리기 — 보드에서 드래그하세요
                <span style={{ opacity: 0.6 }}> · Esc 취소</span>
              </div>
            )}

            {/* 프리젠테이션 주석 레이어 (펜 자국) */}
            {!editMode && size.w > 0 && (strokes.length > 0 || liveStroke) && (
              <svg
                style={{ ...S.overlay, zIndex: 50 }}
                width={size.w}
                height={size.h}
              >
                {[...strokes, ...(liveStroke ? [liveStroke] : [])].map((s) => (
                  <polyline
                    key={s.id}
                    points={s.pts
                      .map(
                        (pt) =>
                          `${(pt.x / 100) * size.w},${(pt.y / 100) * size.h}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.95}
                  />
                ))}
              </svg>
            )}

            {/* 텍스트 주석 */}
            {!editMode &&
              texts.map((t) => (
                <div
                  key={t.id}
                  style={{
                    position: "absolute",
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    transform: "translate(-2px, -50%)",
                    zIndex: 52,
                    color: t.color,
                  }}
                >
                  {editingTextId === t.id ? (
                    <input
                      autoFocus
                      value={t.text}
                      onChange={(e) =>
                        setTexts((prev) =>
                          prev.map((x) =>
                            x.id === t.id ? { ...x, text: e.target.value } : x
                          )
                        )
                      }
                      onBlur={() => {
                        setEditingTextId(null);
                        setTexts((prev) =>
                          prev.filter((x) => x.text.trim() !== "")
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      placeholder="텍스트…"
                      style={{
                        background: "rgba(8,24,21,0.6)",
                        border: `1px dashed ${t.color}`,
                        borderRadius: 6,
                        color: t.color,
                        fontSize: 18,
                        fontWeight: 700,
                        padding: "2px 8px",
                        outline: "none",
                        minWidth: 80,
                      }}
                    />
                  ) : (
                    <span
                      onPointerDown={(e) => {
                        if (tool === "text") {
                          e.stopPropagation();
                          setEditingTextId(t.id);
                        }
                      }}
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                        pointerEvents: tool === "text" ? "auto" : "none",
                        cursor: tool === "text" ? "text" : "default",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.text}
                    </span>
                  )}
                </div>
              ))}

            {/* 레이저 포인터 */}
            {!editMode && tool === "laser" && laser && size.w > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: (laser.x / 100) * size.w,
                  top: (laser.y / 100) * size.h,
                  width: 18,
                  height: 18,
                  marginLeft: -9,
                  marginTop: -9,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, #ff5b5b 0%, #ff2d2d 45%, rgba(255,45,45,0) 72%)",
                  boxShadow:
                    "0 0 14px 6px rgba(255,45,45,0.55), 0 0 4px 1px rgba(255,120,120,0.9)",
                  zIndex: 55,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* 프리젠테이션 주석 도구 막대 */}
            {!editMode && (
              <div
                style={S.annToolbar}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {([
                  ["cursor", "↖", "커서"],
                  ["pen", "✎", "펜"],
                  ["eraser", "⌫", "지우개"],
                  ["laser", "•", "레이저"],
                  ["text", "T", "텍스트"],
                ] as [PresentTool, string, string][]).map(([t, icon, label]) => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    title={label}
                    style={{
                      ...S.toolBtn,
                      ...(tool === t ? S.toolBtnActive : {}),
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
                    <span style={{ fontSize: 9.5 }}>{label}</span>
                  </button>
                ))}

                {(tool === "pen" || tool === "text") && (
                  <div style={S.toolDivider}>
                    {INK_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        title="색상"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: c,
                          border:
                            penColor === c
                              ? "2px solid #fff"
                              : "2px solid rgba(255,255,255,0.25)",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                )}

                <div style={S.toolDivider}>
                  <button
                    onClick={clearAnnotations}
                    title="모두 지우기"
                    style={{ ...S.toolBtn, color: "#ff9a9a" }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>🗑</span>
                    <span style={{ fontSize: 9.5 }}>전체 지우기</span>
                  </button>
                </div>
              </div>
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
              drawStyle={drawStyle}
              armDraw={(style) => {
                setDraft(null);
                setDrawStyle((cur) => (cur === style ? null : style));
              }}
              setLineStyle={setLineStyle}
              addFrame={addFrame}
              deleteFrame={deleteFrame}
              canDeleteFrame={scenario.frames.length > 1}
              selectedEntity={selectedEntity}
              selectedState={primaryId ? states[primaryId] : undefined}
              selectedCount={selectedIds.length}
              editEntityLabel={editEntityLabel}
              rotateSelected={rotateSelected}
              toggleVisibleSelected={toggleVisibleSelected}
              deleteSelected={deleteSelectedMany}
            />
          )}
        </aside>
      </div>

      {/* 삭제 확인 모달 */}
      {confirmOpen && (
        <div style={S.modalBackdrop} onClick={() => setConfirmOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>오브젝트 삭제</div>
            <p style={S.modalBody}>
              선택한 오브젝트 <b>{selectedIds.length}개</b>를 삭제할까요?
              <br />이 작업은 현재 시나리오의 모든 프레임에서 제거합니다.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{ ...S.navBtn, flex: 1 }}
              >
                취소 (Esc)
              </button>
              <button
                onClick={deleteSelectedMany}
                style={{ ...S.navBtn, ...S.modalDanger, flex: 1 }}
                autoFocus
              >
                삭제 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
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
  drawStyle,
  armDraw,
  setLineStyle,
  addFrame,
  deleteFrame,
  canDeleteFrame,
  selectedEntity,
  selectedState,
  selectedCount,
  editEntityLabel,
  rotateSelected,
  toggleVisibleSelected,
  deleteSelected,
}: {
  frame: Frame;
  editFrameText: (p: Partial<Pick<Frame, "title" | "description">>) => void;
  addEntity: (t: EntityType, lineStyle?: LineStyle) => void;
  drawStyle: LineStyle | null;
  armDraw: (style: LineStyle) => void;
  setLineStyle: (style: LineStyle) => void;
  addFrame: () => void;
  deleteFrame: () => void;
  canDeleteFrame: boolean;
  selectedEntity?: Entity;
  selectedState?: EntityState;
  selectedCount: number;
  editEntityLabel: (s: string) => void;
  rotateSelected: (d: number) => void;
  toggleVisibleSelected: () => void;
  deleteSelected: () => void;
}) {
  const isLine = selectedEntity?.type === "line";
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

      <div>
        <label style={S.label}>라인 그리기</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {([
            ["layline", "┄ 레이라인"],
            ["divider", "┈ 구분선"],
            ["overlap", "↔ 오버랩"],
            ["plain", "→ 화살표"],
          ] as [LineStyle, string][]).map(([style, label]) => (
            <button
              key={style}
              onClick={() => armDraw(style)}
              style={{
                ...S.btn,
                ...S.btnSm,
                ...(drawStyle === style ? S.btnActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p style={S.tip}>
          {drawStyle
            ? "보드에서 시작점부터 끝점까지 드래그해 원하는 길이로 그리세요. (Esc로 취소)"
            : "도구를 고른 뒤 보드에서 드래그하면 그 길이만큼 선이 그려집니다. 그린 뒤엔 끝점(흰 동그라미)이나 선 본체를 드래그해 조정할 수 있고, 끝점 위치는 프레임마다 기록돼 매직 트랜지션으로 이어집니다."}
        </p>
      </div>

      <div style={S.selBox}>
        <label style={S.label}>
          선택된 오브젝트{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </label>
        {selectedCount === 0 ? (
          <p style={S.tip}>
            빈 곳에서 드래그하면 사각형 안의 오브젝트가 한 번에 선택됩니다.
            Shift+클릭으로 하나씩 추가/제외할 수 있어요. 선택 후 Backspace로
            삭제합니다.
          </p>
        ) : selectedEntity ? (
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
            {isLine ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {([
                  ["layline", "레이라인"],
                  ["divider", "구분선"],
                  ["overlap", "오버랩"],
                  ["plain", "화살표"],
                ] as [LineStyle, string][]).map(([style, label]) => (
                  <button
                    key={style}
                    onClick={() => setLineStyle(style)}
                    style={{
                      ...S.btn,
                      ...S.btnSm,
                      ...(selectedEntity.lineStyle === style ? S.btnActive : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
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
            )}
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
            <p style={S.tip}>
              {isLine
                ? "흰 동그라미(끝점)를 드래그하거나, 선을 잡고 통째로 옮기세요."
                : "드래그해서 위치를 옮길 수 있어요."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {selectedCount}개 선택됨
            </div>
            <button
              onClick={deleteSelected}
              style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }}
            >
              🗑 선택 삭제 (Backspace)
            </button>
            <p style={S.tip}>
              Shift+클릭으로 선택을 추가/제외하고, Backspace를 누르면 삭제할지
              확인합니다.
            </p>
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
  drawBanner: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#0b1f1c",
    background: "var(--hero)",
    padding: "6px 14px",
    borderRadius: 20,
    zIndex: 41,
    pointerEvents: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(4,12,11,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    width: 360,
    maxWidth: "90vw",
    background: "#11302b",
    border: "1px solid rgba(234,243,236,0.16)",
    borderRadius: 14,
    padding: 22,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  modalTitle: { fontSize: 17, fontWeight: 800, marginBottom: 10 },
  modalBody: {
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(234,243,236,0.85)",
    margin: 0,
  },
  modalDanger: {
    background: "#ff5a5a",
    color: "#2a0808",
    border: "1px solid #ff5a5a",
    fontWeight: 800,
  },
  annToolbar: {
    position: "absolute",
    bottom: 14,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    background: "rgba(8,24,21,0.86)",
    border: "1px solid rgba(234,243,236,0.16)",
    borderRadius: 14,
    backdropFilter: "blur(8px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    zIndex: 60,
  },
  toolBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    width: 46,
    padding: "6px 4px",
    borderRadius: 9,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--chalk)",
    fontWeight: 600,
  },
  toolBtnActive: {
    background: "var(--hero)",
    color: "#0b1f1c",
    border: "1px solid var(--hero)",
  },
  toolDivider: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    paddingLeft: 8,
    marginLeft: 2,
    borderLeft: "1px solid rgba(234,243,236,0.16)",
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
