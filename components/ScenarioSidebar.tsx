"use client";

import { useMemo, useState } from "react";
import { Scenario } from "@/lib/types";

const UNGROUPED = "그룹 없음";

export default function ScenarioSidebar({
  scenarios,
  currentId,
  open,
  mobile,
  isNative,
  storagePath,
  onClose,
  onOpenScenario,
  onCreate,
  onRename,
  onSetGroup,
  onDuplicate,
  onDelete,
  onExport,
  onImport,
}: {
  scenarios: Scenario[];
  currentId: string;
  open: boolean;
  mobile: boolean;
  isNative: boolean;
  storagePath: string | null;
  onClose: () => void;
  onOpenScenario: (id: string) => void;
  onCreate: (group?: string) => void;
  onRename: (id: string, name: string) => void;
  onSetGroup: (id: string, group: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [groupDraft, setGroupDraft] = useState("");

  const groups = useMemo(() => {
    const m = new Map<string, Scenario[]>();
    for (const s of scenarios) {
      const g = (s.group && s.group.trim()) || UNGROUPED;
      const arr = m.get(g);
      if (arr) arr.push(s);
      else m.set(g, [s]);
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === UNGROUPED ? 1 : b[0] === UNGROUPED ? -1 : a[0].localeCompare(b[0])
    );
  }, [scenarios]);

  const groupNames = useMemo(
    () =>
      [
        ...new Set(
          scenarios.map((s) => s.group?.trim()).filter(Boolean) as string[]
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [scenarios]
  );

  const toggleGroup = (g: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });

  const startEdit = (s: Scenario) => {
    setEditingId(s.id);
    setNameDraft(s.name);
    setGroupDraft(s.group ?? "");
  };
  const commitEdit = () => {
    if (editingId) {
      onRename(editingId, nameDraft.trim() || "이름 없음");
      onSetGroup(editingId, groupDraft.trim());
    }
    setEditingId(null);
  };

  if (!open) return null;

  const inner = (
    <div style={S.inner}>
      <div style={S.header}>
        <span style={S.title}>📁 시나리오</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={S.headBtn}
            title="새 시나리오"
            onClick={() => onCreate()}
          >
            ＋ 새로
          </button>
          {mobile && (
            <button style={S.headBtn} title="닫기" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={S.list}>
        {groups.map(([g, items]) => {
          const isCollapsed = collapsed.has(g);
          return (
            <div key={g} style={{ marginBottom: 6 }}>
              <div style={S.groupRow}>
                <button
                  style={S.groupToggle}
                  onClick={() => toggleGroup(g)}
                  title={isCollapsed ? "펼치기" : "접기"}
                >
                  <span style={{ width: 12, display: "inline-block" }}>
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  {g}
                  <span style={S.count}>{items.length}</span>
                </button>
                <button
                  style={S.groupAdd}
                  title={`"${g}" 그룹에 새 시나리오`}
                  onClick={() => onCreate(g === UNGROUPED ? "" : g)}
                >
                  ＋
                </button>
              </div>

              {!isCollapsed &&
                items.map((s) => {
                  const active = s.id === currentId;
                  const editing = editingId === s.id;
                  if (editing) {
                    return (
                      <div key={s.id} style={S.editBox}>
                        <input
                          autoFocus
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          placeholder="시나리오 이름"
                          style={S.editInput}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <input
                          list="sidebar-groups"
                          value={groupDraft}
                          onChange={(e) => setGroupDraft(e.target.value)}
                          placeholder="그룹(주제) — 비우면 그룹 없음"
                          style={S.editInput}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            style={{ ...S.miniBtn, ...S.miniPrimary, flex: 1 }}
                            onClick={commitEdit}
                          >
                            저장
                          </button>
                          <button
                            style={{ ...S.miniBtn, flex: 1 }}
                            onClick={() => setEditingId(null)}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={s.id}
                      style={{ ...S.item, ...(active ? S.itemActive : {}) }}
                    >
                      <button
                        style={S.itemName}
                        title={s.blurb || s.name}
                        onClick={() => onOpenScenario(s.id)}
                      >
                        <span
                          style={{
                            ...S.dot,
                            background: active
                              ? "var(--hero)"
                              : "rgba(234,243,236,0.3)",
                          }}
                        />
                        <span style={S.nameText}>{s.name}</span>
                      </button>
                      <div style={S.actions}>
                        <button
                          style={S.iconBtn}
                          title="이름·그룹 편집"
                          onClick={() => startEdit(s)}
                        >
                          ✎
                        </button>
                        <button
                          style={S.iconBtn}
                          title="복제"
                          onClick={() => onDuplicate(s.id)}
                        >
                          ⧉
                        </button>
                        {isNative && (
                          <button
                            style={S.iconBtn}
                            title="JSON 내보내기"
                            onClick={() => onExport(s.id)}
                          >
                            ⤓
                          </button>
                        )}
                        <button
                          style={{ ...S.iconBtn, color: "#ff9a9a" }}
                          title="삭제"
                          onClick={() => onDelete(s.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      <datalist id="sidebar-groups">
        {groupNames.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div style={S.footer}>
        <button style={S.footBtn} onClick={onImport}>
          ⤒ JSON 가져오기
        </button>
        <p style={S.loc}>
          {isNative
            ? `저장 위치: ${storagePath ?? "…"}`
            : "브라우저 로컬 저장(localStorage) · 데스크톱 앱에서는 파일로 저장됩니다"}
        </p>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <>
        <div style={S.backdrop} onClick={onClose} />
        <div style={{ ...S.drawer }}>{inner}</div>
      </>
    );
  }
  return <div style={S.docked}>{inner}</div>;
}

const PANEL_BG = "rgba(8,24,21,0.96)";
const S: Record<string, React.CSSProperties> = {
  docked: {
    width: 280,
    flexShrink: 0,
    borderRight: "1px solid rgba(234,243,236,0.12)",
    background: PANEL_BG,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 90,
  },
  drawer: {
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    width: "84%",
    maxWidth: 340,
    background: PANEL_BG,
    borderRight: "1px solid rgba(234,243,236,0.15)",
    zIndex: 91,
    display: "flex",
    flexDirection: "column",
    boxShadow: "6px 0 24px rgba(0,0,0,0.45)",
  },
  inner: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 12px",
    borderBottom: "1px solid rgba(234,243,236,0.1)",
  },
  title: { fontSize: 14, fontWeight: 800, color: "var(--chalk)" },
  headBtn: {
    padding: "5px 9px",
    borderRadius: 8,
    border: "1px solid rgba(234,243,236,0.22)",
    background: "rgba(234,243,236,0.08)",
    color: "var(--chalk)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  list: { flex: 1, overflowY: "auto", padding: "10px 8px", minHeight: 0 },
  groupRow: { display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
  groupToggle: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 6px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--chalk-dim)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.02em",
    textAlign: "left",
    cursor: "pointer",
  },
  count: {
    marginLeft: "auto",
    fontSize: 11,
    color: "var(--chalk-faint)",
    fontWeight: 600,
  },
  groupAdd: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "1px solid rgba(234,243,236,0.18)",
    background: "transparent",
    color: "var(--chalk-dim)",
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    borderRadius: 8,
    marginLeft: 12,
    paddingRight: 4,
  },
  itemActive: { background: "rgba(255,213,74,0.12)" },
  itemName: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 8px",
    border: "none",
    background: "transparent",
    color: "var(--chalk)",
    fontSize: 13,
    textAlign: "left",
    cursor: "pointer",
    minWidth: 0,
  },
  dot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  nameText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: 1, flexShrink: 0 },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: "var(--chalk-dim)",
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
  },
  editBox: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 8,
    background: "rgba(8,24,21,0.6)",
    border: "1px solid rgba(234,243,236,0.18)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  editInput: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    background: "rgba(8,24,21,0.6)",
    color: "var(--chalk)",
    border: "1px solid rgba(234,243,236,0.22)",
    fontSize: 12.5,
  },
  miniBtn: {
    padding: "5px 8px",
    borderRadius: 6,
    border: "1px solid rgba(234,243,236,0.22)",
    background: "transparent",
    color: "var(--chalk)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  miniPrimary: {
    background: "var(--hero)",
    color: "#0b1f1c",
    border: "1px solid var(--hero)",
  },
  footer: {
    borderTop: "1px solid rgba(234,243,236,0.1)",
    padding: "10px 12px",
  },
  footBtn: {
    width: "100%",
    padding: "8px",
    borderRadius: 8,
    border: "1px solid rgba(234,243,236,0.22)",
    background: "rgba(234,243,236,0.06)",
    color: "var(--chalk)",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  loc: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "var(--chalk-faint)",
    margin: "8px 0 0",
    wordBreak: "break-all",
  },
};
