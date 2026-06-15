export type EntityType =
  | "boat" // 우리 보트 / 경쟁 보트
  | "mark" // 부표
  | "committee" // 본부선 (시작선 우측)
  | "pin" // 핀 엔드 (시작선 좌측)
  | "wind" // 바람 화살표
  | "note"; // 텍스트 라벨

export interface Entity {
  id: string;
  type: EntityType;
  label?: string;
  /** 보트/노트 색상. 미지정 시 타입별 기본값 사용 */
  color?: string;
  /** 우리 팀 보트 여부 (하이라이트) */
  hero?: boolean;
}

export interface EntityState {
  /** 0..100, 보드 너비 기준 퍼센트 */
  x: number;
  /** 0..100, 보드 높이 기준 퍼센트 */
  y: number;
  /** 회전각(도). 0 = 뱃머리가 위(북)를 향함, 시계방향 + */
  rotation?: number;
  /** 표시 여부. 기본 true */
  visible?: boolean;
  /** 크기 배율. 기본 1 */
  scale?: number;
}

export interface Frame {
  id: string;
  title: string;
  description: string;
  /** 이 프레임에서 "변경된" 엔티티 상태만 기록. 나머지는 이전 프레임에서 상속 */
  states: Record<string, EntityState>;
}

export interface Scenario {
  id: string;
  name: string;
  /** 한 줄 설명 */
  blurb: string;
  entities: Entity[];
  frames: Frame[];
}

/**
 * frameIndex 시점의 모든 엔티티 상태를 0번 프레임부터 누적 병합하여 반환.
 * (키노트 매직 무브처럼, 명시하지 않은 엔티티는 직전 위치를 유지)
 */
export function resolveStates(
  scenario: Scenario,
  frameIndex: number
): Record<string, EntityState> {
  const acc: Record<string, EntityState> = {};
  // 기본값: 모든 엔티티는 보이지 않다가 처음 명시될 때 등장
  for (let i = 0; i <= frameIndex && i < scenario.frames.length; i++) {
    const frame = scenario.frames[i];
    for (const [id, st] of Object.entries(frame.states)) {
      acc[id] = { ...acc[id], ...st };
    }
  }
  return acc;
}
