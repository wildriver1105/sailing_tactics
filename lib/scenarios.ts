import { Scenario } from "./types";

/**
 * 좌표계: x(0=좌, 100=우), y(0=위/풍상, 100=아래/풍하).
 * 바람은 기본적으로 위(북)에서 분다. 풍상 마크는 위쪽, 스타트 라인은 아래쪽.
 * rotation: 0 = 뱃머리 위쪽, 시계방향 +. 클로즈홀드(약 45도 상풍)
 *   - 스타보드 택(우현 풍상): 뱃머리 우상단 → +45
 *   - 포트 택(좌현 풍상): 뱃머리 좌상단 → -45
 */

const HERO = "#ffd54a"; // 우리 보트 (노란 분필)
const RIVAL = "#7fd1ff"; // 경쟁 보트 (파란 분필)
const RIVAL2 = "#ff9a8b"; // 경쟁 보트 2

export const SCENARIOS: Scenario[] = [
  // ──────────────────────────────────────────────────────────────
  {
    id: "start",
    name: "스타트 라인 전략",
    blurb: "유리한 끝단 파악부터 가속·클리어 에어 확보까지",
    entities: [
      { id: "wind", type: "wind", label: "바람" },
      { id: "rc", type: "committee", label: "본부선" },
      { id: "pin", type: "pin", label: "핀" },
      { id: "us", type: "boat", label: "US", color: HERO, hero: true },
      { id: "a", type: "boat", label: "A", color: RIVAL },
      { id: "b", type: "boat", label: "B", color: RIVAL2 },
    ],
    frames: [
      {
        id: "f1",
        title: "스타트 4분 전 — 라인 바이어스 파악",
        description:
          "스타트 라인 위로 바람이 비스듬히 분다. 본부선(우측)과 핀(좌측) 중 어느 쪽이 풍상에 더 가까운지 확인한다. 여기서는 핀 쪽이 약간 풍상 → 핀 끝단이 유리하다. 라인과 직각으로 헤드업해 양 끝단을 가늠하자.",
        states: {
          wind: { x: 50, y: 8, rotation: 180, visible: true },
          rc: { x: 78, y: 80, visible: true },
          pin: { x: 22, y: 76, visible: true },
          us: { x: 55, y: 92, rotation: 0, visible: true },
          a: { x: 40, y: 95, rotation: 20, visible: true },
          b: { x: 68, y: 90, rotation: -20, visible: true },
        },
      },
      {
        id: "f2",
        title: "1분 전 — 포지셔닝 (리워드 갭 확보)",
        description:
          "유리한 핀 끝단 근처에 자리잡되, 풍하(아래) 쪽으로 가속할 '구멍(gap)'을 남긴다. 경쟁 보트보다 살짝 풍상·뒤쪽에 서서 스타트 직전 풀어내며 가속할 공간을 지킨다.",
        states: {
          us: { x: 32, y: 84, rotation: 45 },
          a: { x: 45, y: 86, rotation: 45 },
          b: { x: 60, y: 85, rotation: 45 },
        },
      },
      {
        id: "f3",
        title: "스타트! — 풀 스피드로 라인 통과",
        description:
          "총성과 함께 갭을 닫으며 풀 스피드로 라인을 때린다. 핀 끝단에서 스타보드 택으로 풍상을 향해 가속 — 클리어 에어를 확보한 채 출발한다.",
        states: {
          us: { x: 26, y: 74, rotation: 45 },
          a: { x: 42, y: 78, rotation: 45 },
          b: { x: 58, y: 79, rotation: 45 },
        },
      },
      {
        id: "f4",
        title: "스타트 직후 — 클리어 에어 & 유리한 쪽 선점",
        description:
          "풍상으로 치고 올라가며 경쟁 보트의 더티 에어(바람 그림자)를 벗어난다. 코스 좌측이 유리하다고 판단되면 그대로 좌측 압박, 더티 에어에 걸리면 즉시 태킹해 깨끗한 바람을 찾는다.",
        states: {
          us: { x: 20, y: 58, rotation: 45 },
          a: { x: 40, y: 66, rotation: 45 },
          b: { x: 56, y: 70, rotation: 45 },
        },
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  {
    id: "windward",
    name: "풍상 마크 라운딩 & 레이라인",
    blurb: "오버스탠딩 피하기 · 마크룸 · 베어어웨이",
    entities: [
      { id: "wind", type: "wind", label: "바람" },
      { id: "mark", type: "mark", label: "1번 마크" },
      { id: "lay_s", type: "line", label: "스타보드 레이라인", lineStyle: "divider" },
      { id: "lay_p", type: "line", label: "포트 레이라인", lineStyle: "divider" },
      { id: "us", type: "boat", label: "US", color: HERO, hero: true },
      { id: "r", type: "boat", label: "R", color: RIVAL },
    ],
    frames: [
      {
        id: "f1",
        title: "레이라인 접근 — 오버스탠딩 금물",
        description:
          "마크에서 양쪽으로 뻗는 레이라인(점선). 너무 일찍 레이라인에 붙으면(오버스탠딩) 거리 손해 + 위에서 누르는 보트에 취약하다. 레이라인 아래에서 여유를 두고 접근한다.",
        states: {
          wind: { x: 50, y: 6, rotation: 180, visible: true },
          mark: { x: 52, y: 22, visible: true },
          lay_s: { x: 52, y: 22, x2: 18, y2: 66, visible: true },
          lay_p: { x: 52, y: 22, x2: 86, y2: 66, visible: true },
          us: { x: 30, y: 70, rotation: 45, visible: true },
          r: { x: 44, y: 78, rotation: 45, visible: true },
        },
      },
      {
        id: "f2",
        title: "마지막 태킹 — 레이라인에 정확히 올라타기",
        description:
          "마크를 정확히 fetch할 수 있는 지점에서 스타보드 택으로 태킹. 너무 멀면 오버스탠딩, 너무 가까우면 다시 태킹해야 한다(언더스탠딩). 한 번에 깔끔하게 레이라인에 올라탄다.",
        states: {
          us: { x: 36, y: 52, rotation: 45 },
          r: { x: 40, y: 64, rotation: 45 },
        },
      },
      {
        id: "f3",
        title: "마크 진입 — 인사이드 마크룸 확보",
        description:
          "3보트 길이 존(zone) 진입 시 인사이드(마크 쪽) 보트가 마크룸 권리를 가진다. 안쪽을 점유해 타이트하게 도는 권리를 확보하고, 속도를 유지한 채 베어어웨이를 준비한다.",
        states: {
          us: { x: 47, y: 30, rotation: 30 },
          r: { x: 44, y: 44, rotation: 45 },
        },
      },
      {
        id: "f4",
        title: "라운딩 — '와이드 인, 타이트 아웃'",
        description:
          "넓게 들어가 마크에 바짝 붙여 빠져나온다. 마크를 돌며 풍하로 베어어웨이, 다운윈드 코스로 가속. 라운딩 직후 풍상 위치를 지켜 다음 다리에서 깨끗한 바람을 유지한다.",
        states: {
          us: { x: 60, y: 26, rotation: 130 },
          r: { x: 50, y: 34, rotation: 60 },
          lay_s: { x: 52, y: 22, x2: 18, y2: 66, visible: false },
          lay_p: { x: 52, y: 22, x2: 86, y2: 66, visible: false },
        },
      },
      {
        id: "f5",
        title: "다운윈드 진입 — 분리 & 압박",
        description:
          "라운딩을 마치고 풍하 코스로 전개. 뒤따르는 보트와 분리해 더티 에어를 피하고, 다음 마크를 향한 최적 각도(브로드 리치)로 가속한다.",
        states: {
          us: { x: 70, y: 50, rotation: 150 },
          r: { x: 56, y: 44, rotation: 140 },
        },
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  {
    id: "cross",
    name: "포트-스타보드 크로스 & 리바우",
    blurb: "교차 상황 판단 · 회피 · 리-바우로 압박",
    entities: [
      { id: "wind", type: "wind", label: "바람" },
      { id: "us", type: "boat", label: "US(S)", color: HERO, hero: true },
      { id: "p", type: "boat", label: "P", color: RIVAL },
      { id: "note", type: "note", label: "스타보드 우선!" },
    ],
    frames: [
      {
        id: "f1",
        title: "접근 — 스타보드 vs 포트",
        description:
          "우리는 스타보드 택(US), 상대는 포트 택(P)으로 서로 마주 접근. 규칙상 스타보드 택이 우선권을 가진다. 상대(P)가 회피 의무를 진다.",
        states: {
          wind: { x: 50, y: 6, rotation: 180, visible: true },
          us: { x: 30, y: 62, rotation: 45, visible: true },
          p: { x: 72, y: 58, rotation: -45, visible: true },
          note: { x: 50, y: 24, visible: false },
        },
      },
      {
        id: "f2",
        title: "우선권 행사 — 코스 유지",
        description:
          "스타보드 보트는 코스를 유지한다('hold your course'). 상대가 우리 앞으로 크로스할지, 뒤로 더킹(duck)할지 지켜본다. 일관된 코스를 유지해 상대가 판단할 수 있게 한다.",
        states: {
          us: { x: 40, y: 52, rotation: 45 },
          p: { x: 60, y: 50, rotation: -45 },
          note: { x: 50, y: 22, visible: true },
        },
      },
      {
        id: "f3",
        title: "상대의 더킹 — 우리 뒤로 통과",
        description:
          "P가 우선권을 존중해 우리 뒤(풍하)로 더킹한다. 이 순간이 기회 — 상대는 속도를 잃고 우리 풍하 쪽으로 들어온다.",
        states: {
          us: { x: 48, y: 44, rotation: 45 },
          p: { x: 52, y: 56, rotation: -30 },
          note: { x: 50, y: 20, visible: false },
        },
      },
      {
        id: "f4",
        title: "리-바우 / 태킹으로 압박",
        description:
          "상대가 뒤로 지나간 직후 포트 택으로 태킹해 상대의 풍상·전방('lee-bow' 위치)에 자리잡는다. 우리의 더티 에어가 상대를 덮어 속도를 떨어뜨리고, 우리는 유리한 쪽으로 전개한다.",
        states: {
          us: { x: 56, y: 40, rotation: -45 },
          p: { x: 58, y: 52, rotation: -45 },
        },
      },
    ],
  },
];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
