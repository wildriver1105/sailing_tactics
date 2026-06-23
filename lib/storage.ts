/**
 * 시나리오 영속화 추상화.
 *
 * - 네이티브(Tauri) 환경: 파일 시스템에 "시나리오 1개 = JSON 파일 1개"로 저장.
 *   · macOS  → ~/SailingTactics/scenarios/<id>.json  (비샌드박스, Finder에서 보임)
 *   · iOS/iPad → <앱 데이터 디렉토리>/scenarios/<id>.json  (샌드박스 정책상 ~/ 불가)
 * - 일반 브라우저(`next dev`): localStorage 폴백 → 웹에서 그대로 개발 가능.
 *
 * `@tauri-apps/*` 모듈은 전부 동적 import 로만 불러와 브라우저 번들에 포함되지 않게 한다.
 */

import type { Scenario } from "./types";

const LS_KEY = "sailing_tactics_v1";

/** Tauri 웹뷰 내부인지 런타임 감지. 브라우저(next dev)에서는 false. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 파일명으로 안전하지 않은 문자 제거(시나리오 id → 파일명). */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// ── 베이스 디렉토리(플랫폼별) ──────────────────────────────
let baseDirCache: string | null = null;

async function getBaseDir(): Promise<string> {
  if (baseDirCache) return baseDirCache;
  const { homeDir, appDataDir, join } = await import("@tauri-apps/api/path");
  const { platform } = await import("@tauri-apps/plugin-os");
  const os = platform();
  const base =
    os === "macos"
      ? await join(await homeDir(), "SailingTactics", "scenarios")
      : await join(await appDataDir(), "scenarios");
  baseDirCache = base;
  return base;
}

// ── 공개 API ───────────────────────────────────────────────

/** 저장 디렉토리를 보장(없으면 생성). 브라우저에서는 no-op. */
export async function initStorage(): Promise<void> {
  if (!isTauri()) return;
  const { mkdir, exists } = await import("@tauri-apps/plugin-fs");
  const dir = await getBaseDir();
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
}

/** 모든 시나리오 로드. 네이티브: 폴더 내 *.json, 브라우저: localStorage. */
export async function listScenarios(): Promise<Scenario[]> {
  if (!isTauri()) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? (JSON.parse(raw) as Scenario[]) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const dir = await getBaseDir();
  const entries = await readDir(dir);
  const out: Scenario[] = [];
  for (const e of entries) {
    if (!e.isFile || !e.name.endsWith(".json")) continue;
    try {
      const text = await readTextFile(await join(dir, e.name));
      const parsed = JSON.parse(text) as Scenario;
      if (parsed && parsed.id) out.push(parsed);
    } catch {
      /* 손상 파일은 건너뜀 */
    }
  }
  return out;
}

/** 단일 시나리오 로드. */
export async function loadScenario(id: string): Promise<Scenario | null> {
  if (!isTauri()) {
    return (await listScenarios()).find((s) => s.id === id) ?? null;
  }
  const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const path = await join(await getBaseDir(), `${safeId(id)}.json`);
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readTextFile(path)) as Scenario;
  } catch {
    return null;
  }
}

/** 시나리오 저장(생성/갱신). 네이티브: <id>.json, 브라우저: localStorage upsert. */
export async function saveScenario(s: Scenario): Promise<void> {
  if (!isTauri()) {
    const all = await listScenarios();
    const next = all.some((x) => x.id === s.id)
      ? all.map((x) => (x.id === s.id ? s : x))
      : [...all, s];
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return;
  }
  await initStorage();
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const path = await join(await getBaseDir(), `${safeId(s.id)}.json`);
  await writeTextFile(path, JSON.stringify(s, null, 2));
}

/** 시나리오 삭제. */
export async function deleteScenario(id: string): Promise<void> {
  if (!isTauri()) {
    const next = (await listScenarios()).filter((s) => s.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return;
  }
  const { remove, exists } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const path = await join(await getBaseDir(), `${safeId(id)}.json`);
  if (await exists(path)) await remove(path);
}

/** 여러 시나리오 일괄 저장(시드/초기화용). 쓰기는 순차 직렬화. */
export async function saveAll(scenarios: Scenario[]): Promise<void> {
  for (const s of scenarios) await saveScenario(s);
}

// ── 내보내기 / 가져오기 (네이티브 파일 다이얼로그) ────────────

/** 시나리오를 사용자가 고른 경로로 JSON 내보내기. 네이티브 전용. */
export async function exportScenario(s: Scenario): Promise<boolean> {
  if (!isTauri()) return false;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({
    defaultPath: `${safeId(s.id)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return false;
  await writeTextFile(path, JSON.stringify(s, null, 2));
  return true;
}

/** JSON 파일을 선택해 시나리오로 가져오기. 네이티브 전용. */
export async function importScenario(): Promise<Scenario | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const picked = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  const path = typeof picked === "string" ? picked : null;
  if (!path) return null;
  try {
    const parsed = JSON.parse(await readTextFile(path)) as Scenario;
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

/** 디버그/표시용: 현재 저장 폴더 경로. 브라우저면 null. */
export async function storageLocation(): Promise<string | null> {
  if (!isTauri()) return null;
  return getBaseDir();
}
