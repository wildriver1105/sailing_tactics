"use client";

import { Entity } from "@/lib/types";

/**
 * 엔티티 1개를 그리는 SVG. 부모(motion.div)가 위치/회전을 담당하므로
 * 여기서는 "위를 향한 기본 자세"의 모양만 그린다.
 */
export function EntityIcon({
  entity,
  selected,
}: {
  entity: Entity;
  selected?: boolean;
}) {
  switch (entity.type) {
    case "boat":
      return <BoatIcon entity={entity} selected={selected} />;
    case "mark":
      return <MarkIcon label={entity.label} selected={selected} />;
    case "committee":
      return <CommitteeIcon label={entity.label} selected={selected} />;
    case "pin":
      return <PinIcon label={entity.label} selected={selected} />;
    case "wind":
      return <WindIcon label={entity.label} />;
    case "note":
      return <NoteIcon label={entity.label} selected={selected} />;
    default:
      return null;
  }
}

function BoatIcon({ entity, selected }: { entity: Entity; selected?: boolean }) {
  const color = entity.color ?? "#eaf3ec";
  return (
    <svg viewBox="-30 -36 60 72" width="100%" height="100%" overflow="visible">
      {selected && (
        <circle r="32" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
      )}
      {entity.hero && (
        <circle r="30" fill={color} opacity="0.12" />
      )}
      {/* 선체 (위를 향한 뾰족한 헐) */}
      <path
        d="M0,-32 C10,-14 11,14 7,30 L-7,30 C-11,14 -10,-14 0,-32 Z"
        fill="rgba(8,24,21,0.55)"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* 메인세일 (우현으로 부푼 돛) */}
      <path
        d="M0,-26 C16,-16 18,6 4,22 L0,20 Z"
        fill={color}
        opacity="0.85"
      />
      {/* 마스트 라인 */}
      <line x1="0" y1="-28" x2="0" y2="24" stroke={color} strokeWidth="1.6" />
      {entity.label && (
        <text
          x="0"
          y="3"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#0b1f1c"
          style={{ paintOrder: "stroke" }}
          stroke={color}
          strokeWidth="0.5"
        >
          {entity.label}
        </text>
      )}
    </svg>
  );
}

function MarkIcon({ label, selected }: { label?: string; selected?: boolean }) {
  return (
    <svg viewBox="-26 -34 52 68" width="100%" height="100%" overflow="visible">
      {selected && (
        <circle cy="6" r="26" fill="none" stroke="#ff8c42" strokeWidth="1.5" strokeDasharray="4 4" />
      )}
      {/* 부표(원통형) */}
      <path
        d="M-12,8 C-12,-10 12,-10 12,8 L9,22 C9,30 -9,30 -9,22 Z"
        fill="#ff8c42"
        stroke="#ffd0a8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="0" cy="-2" rx="12" ry="5" fill="#ffb074" />
      {label && (
        <text x="0" y="46" textAnchor="middle" fontSize="11" fontWeight="600" fill="#ffd0a8">
          {label}
        </text>
      )}
    </svg>
  );
}

function CommitteeIcon({ label, selected }: { label?: string; selected?: boolean }) {
  return (
    <svg viewBox="-40 -28 80 70" width="100%" height="100%" overflow="visible">
      {selected && (
        <rect x="-36" y="-12" width="72" height="40" rx="6" fill="none" stroke="#eaf3ec" strokeWidth="1.5" strokeDasharray="4 4" />
      )}
      {/* 본부선 (가로로 긴 보트) */}
      <path
        d="M-32,0 L28,0 C34,0 34,16 28,16 L-26,16 C-32,16 -34,6 -32,0 Z"
        fill="rgba(8,24,21,0.6)"
        stroke="#eaf3ec"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* 깃발 */}
      <line x1="14" y1="0" x2="14" y2="-22" stroke="#eaf3ec" strokeWidth="1.8" />
      <path d="M14,-22 L30,-17 L14,-12 Z" fill="#ff5a5a" />
      {label && (
        <text x="-4" y="32" textAnchor="middle" fontSize="11" fontWeight="600" fill="#eaf3ec">
          {label}
        </text>
      )}
    </svg>
  );
}

function PinIcon({ label, selected }: { label?: string; selected?: boolean }) {
  return (
    <svg viewBox="-22 -30 44 64" width="100%" height="100%" overflow="visible">
      {selected && (
        <circle cy="4" r="22" fill="none" stroke="#ffd54a" strokeWidth="1.5" strokeDasharray="4 4" />
      )}
      {/* 핀 부표 (작은 원형) */}
      <circle cx="0" cy="4" r="11" fill="#ffd54a" stroke="#fff1c4" strokeWidth="2" />
      <circle cx="0" cy="4" r="4" fill="#0b1f1c" opacity="0.4" />
      {label && (
        <text x="0" y="34" textAnchor="middle" fontSize="11" fontWeight="600" fill="#ffe9a8">
          {label}
        </text>
      )}
    </svg>
  );
}

function WindIcon({ label }: { label?: string }) {
  // 기본 자세: 위를 향한 화살표. rotation=180이면 아래(남)로 부는 바람을 의미.
  return (
    <svg viewBox="-26 -40 52 90" width="100%" height="100%" overflow="visible">
      <defs>
        <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe9ff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7fd1ff" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <line x1="0" y1="-34" x2="0" y2="38" stroke="url(#windGrad)" strokeWidth="4" strokeLinecap="round" />
      <path d="M0,-38 L12,-18 L-12,-18 Z" fill="#bfe9ff" />
      {label && (
        <text
          x="0"
          y="-44"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="#bfe9ff"
          transform="rotate(180 0 -44)"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

function NoteIcon({ label, selected }: { label?: string; selected?: boolean }) {
  const w = Math.max(60, (label?.length ?? 4) * 11 + 24);
  return (
    <svg viewBox={`${-w / 2} -20 ${w} 40`} width={w} height="40" overflow="visible">
      <rect
        x={-w / 2 + 2}
        y="-16"
        width={w - 4}
        height="32"
        rx="8"
        fill="rgba(255,213,74,0.12)"
        stroke={selected ? "#ffd54a" : "rgba(255,213,74,0.6)"}
        strokeWidth={selected ? "2" : "1.5"}
        strokeDasharray={selected ? "4 4" : undefined}
      />
      <text x="0" y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffe9a8">
        {label}
      </text>
    </svg>
  );
}

/** 엔티티 기본 픽셀 크기 (정사각 기준). 노트는 가변. */
export function iconSize(entity: Entity): { w: number; h: number } {
  switch (entity.type) {
    case "boat":
      return { w: 50, h: 60 };
    case "mark":
      return { w: 46, h: 60 };
    case "committee":
      return { w: 84, h: 64 };
    case "pin":
      return { w: 40, h: 56 };
    case "wind":
      return { w: 46, h: 84 };
    case "note": {
      const w = Math.max(60, (entity.label?.length ?? 4) * 11 + 24);
      return { w, h: 40 };
    }
    default:
      return { w: 48, h: 48 };
  }
}
