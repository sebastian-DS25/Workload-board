import { useState, useEffect, useRef, useCallback } from "react";
import { PEOPLE, CATEGORIES, CATEGORY_COLORS } from "./lib/constants.js";
import { applyParsedState } from "./lib/boardState.js";
import { getAccessMode, buildShareUrls, copyText } from "./lib/access.js";
import {
  cloudEnabled,
  loadBoard,
  upsertAssignment,
  saveBoardMeta,
  subscribeBoard,
} from "./lib/boardStorage.js";
import { initComments } from "./lib/boardState.js";

export default function App() {
  const { isView, canEdit } = getAccessMode();
  const [assignments, setAssignments] = useState(null);
  const [comments, setComments] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [teamTitle, setTeamTitle] = useState("Inside Sales · Aalborg");
  const [hoveredCell, setHoveredCell] = useState(null);
  const [toast, setToast] = useState(null);
  const savingRef = useRef(false);

  const applyState = useCallback((state) => {
    setAssignments(state.assignments);
    setComments(state.comments);
    setTeamTitle(state.title);
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};

    async function init() {
      try {
        const state = await loadBoard();
        applyState(state);
        setLoadError(null);

        unsubscribe = subscribeBoard({
          onAssignmentChange: ({ person, category, active }) => {
            if (savingRef.current) return;
            setAssignments(prev => ({
              ...prev,
              [person]: { ...prev[person], [category]: active },
            }));
          },
          onMetaChange: ({ title, comments }) => {
            if (savingRef.current) return;
            setTeamTitle(title);
            setComments({ ...initComments(), ...(comments || {}) });
          },
        });
      } catch (err) {
        console.error(err);
        setLoadError("Could not load the shared board. Check your connection and refresh.");
        applyState(applyParsedState(null));
      } finally {
        setLoaded(true);
      }
    }

    init();
    return () => unsubscribe();
  }, [applyState]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function saveMeta(titleData, commentsData, toastMsg = "Saved ✓") {
    if (!canEdit) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveBoardMeta(titleData, commentsData);
      showToast(toastMsg);
    } catch (err) {
      console.error(err);
      showToast("Save failed — try again");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function toggle(person, cat) {
    if (!canEdit) return;
    const active = !assignments[person][cat];
    setAssignments(prev => ({
      ...prev,
      [person]: { ...prev[person], [cat]: active },
    }));
    savingRef.current = true;
    setSaving(true);
    try {
      await upsertAssignment(person, cat, active);
    } catch (err) {
      console.error(err);
      setAssignments(prev => ({
        ...prev,
        [person]: { ...prev[person], [cat]: !active },
      }));
      showToast("Save failed — try again");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function updateComment(person, text) {
    if (!canEdit) return;
    setComments({ ...comments, [person]: text });
  }

  function saveComment() {
    if (!canEdit) return;
    saveMeta(teamTitle, comments);
  }

  async function copyLink(kind) {
    const { viewUrl, editUrl } = buildShareUrls();
    const url = kind === "view" ? viewUrl : editUrl;
    try {
      await copyText(url);
      showToast(kind === "view" ? "View link copied ✓" : "Edit link copied ✓");
    } catch {
      showToast("Copy failed");
    }
  }

  function getColumnCount(cat) {
    return PEOPLE.filter(p => assignments?.[p]?.[cat]).length;
  }

  function getRowCount(person) {
    return CATEGORIES.filter(c => assignments?.[person]?.[c]).length;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <div style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 14, letterSpacing: 3 }}>LOADING…</div>
      </div>
    );
  }

  const statusColor = loadError ? "#ef4444" : isView ? "#f59e0b" : cloudEnabled ? "#22c55e" : "#64748b";
  const statusText = loadError
    ? "Offline / load error"
    : isView
      ? "View only — changes disabled"
      : canEdit
        ? cloudEnabled
          ? "Live shared board — changes sync instantly for everyone"
          : "Local mode — add Supabase keys to .env (see DEPLOY.md)"
        : "View only — use the edit link to make changes";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "32px 24px",
      position: "relative",
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 100,
          background: "#22c55e", color: "#fff", fontWeight: 600,
          padding: "10px 20px", borderRadius: 10, fontSize: 13,
          boxShadow: "0 8px 32px rgba(34,197,94,0.3)",
        }}>{toast}</div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
            }} />
            <span style={{ color: "#64748b", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
              Workload Board
            </span>
            {saving && <span style={{ color: "#475569", fontSize: 11 }}>saving…</span>}
          </div>

          <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 12px 0" }}>{statusText}</p>

          {loadError && (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 12px 0" }}>{loadError}</p>
          )}

          {editingTitle && canEdit ? (
            <input
              autoFocus
              value={teamTitle}
              onChange={e => setTeamTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); saveMeta(teamTitle, comments); }}
              onKeyDown={e => { if (e.key === "Enter") { setEditingTitle(false); saveMeta(teamTitle, comments); } }}
              style={{
                background: "transparent", border: "none", borderBottom: "2px solid #3b82f6",
                color: "#f1f5f9", fontSize: 28, fontWeight: 700, letterSpacing: -0.5,
                outline: "none", width: "100%", padding: "4px 0",
              }}
            />
          ) : (
            <h1
              onClick={() => canEdit && setEditingTitle(true)}
              style={{
                color: "#f1f5f9", fontSize: 28, fontWeight: 700, margin: 0,
                letterSpacing: -0.5, cursor: canEdit ? "pointer" : "default",
              }}
              title={canEdit ? "Click to edit title" : undefined}
            >{teamTitle}</h1>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => copyLink("view")}
              style={{
                background: "#334155",
                color: "#e2e8f0",
                border: "1px solid #475569",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Copy view link
            </button>
            {canEdit && (
              <button
                onClick={() => copyLink("edit")}
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
                }}
              >
                Copy edit link
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          {CATEGORIES.map(cat => {
            const count = getColumnCount(cat);
            const col = CATEGORY_COLORS[cat];
            return (
              <div key={cat} style={{
                background: count > 0 ? col.accent : "#1e293b",
                color: count > 0 ? "#fff" : "#475569",
                border: `1px solid ${count > 0 ? col.accent : "#334155"}`,
                borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>{cat}</span>
                {count > 0 && (
                  <span style={{
                    background: "rgba(255,255,255,0.25)", borderRadius: 10,
                    padding: "0px 6px", fontSize: 11,
                  }}>{count}</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          background: "#1e293b",
          borderRadius: 16,
          border: "1px solid #334155",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          opacity: canEdit ? 1 : 0.92,
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr style={{ background: "#0f172a" }}>
                  <th style={{
                    padding: "16px 20px", textAlign: "left", color: "#64748b",
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: "1px solid #334155", minWidth: 120,
                  }}>Team Member</th>
                  {CATEGORIES.map(cat => {
                    const col = CATEGORY_COLORS[cat];
                    const count = getColumnCount(cat);
                    return (
                      <th key={cat} style={{
                        padding: "16px 8px", textAlign: "center",
                        borderBottom: "1px solid #334155", minWidth: 72,
                      }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                            textTransform: "uppercase", color: col.accent,
                          }}>{cat}</span>
                          <span style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: count > 0 ? col.accent : "#1e293b",
                            color: count > 0 ? "#fff" : "#475569",
                            fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `1px solid ${count > 0 ? col.accent : "#334155"}`,
                          }}>{count}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{
                    padding: "16px 12px", textAlign: "left", color: "#64748b",
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: "1px solid #334155", minWidth: 180,
                  }}>Comment</th>
                  <th style={{
                    padding: "16px 12px", textAlign: "center", color: "#475569",
                    fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: "1px solid #334155",
                  }}>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {PEOPLE.map((person, pi) => {
                  const rowCount = getRowCount(person);
                  return (
                    <tr
                      key={person}
                      style={{ background: pi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}
                    >
                      <td style={{ padding: "14px 20px", borderBottom: "1px solid #1e293b", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: `hsl(${(pi * 43) % 360}, 60%, 35%)`,
                            border: `2px solid hsl(${(pi * 43) % 360}, 60%, 50%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
                          }}>{person[0]}</div>
                          <span style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 14 }}>{person}</span>
                        </div>
                      </td>
                      {CATEGORIES.map(cat => {
                        const active = assignments[person][cat];
                        const col = CATEGORY_COLORS[cat];
                        const key = `${person}-${cat}`;
                        const hovered = hoveredCell === key;
                        return (
                          <td key={cat} style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid #1e293b" }}>
                            <button
                              onClick={() => toggle(person, cat)}
                              onMouseEnter={() => setHoveredCell(key)}
                              onMouseLeave={() => setHoveredCell(null)}
                              disabled={!canEdit}
                              title={canEdit ? `${active ? "Remove" : "Assign"} ${person} → ${cat}` : "View only"}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                border: active ? `2px solid ${col.accent}` : "1.5px solid #334155",
                                background: active ? col.bg : (hovered && canEdit ? "#1e293b" : "transparent"),
                                cursor: canEdit ? "pointer" : "default",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto",
                                opacity: canEdit ? 1 : 0.85,
                                transform: hovered && !active && canEdit ? "scale(1.15)" : active ? "scale(1.05)" : "scale(1)",
                                boxShadow: active ? `0 0 12px ${col.accent}40` : "none",
                              }}
                            >
                              {active ? (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path d="M2 7L6 11L12 3" stroke={col.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                <div style={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  background: hovered && canEdit ? "#475569" : "#334155",
                                }} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #1e293b", verticalAlign: "middle" }}>
                        <textarea
                          value={comments[person] || ""}
                          onChange={e => updateComment(person, e.target.value)}
                          onBlur={() => saveComment()}
                          readOnly={!canEdit}
                          placeholder={canEdit ? "Add a note…" : "—"}
                          rows={2}
                          style={{
                            width: "100%", minWidth: 160, maxWidth: 220, resize: canEdit ? "vertical" : "none",
                            background: comments[person] ? "#0f172a" : "transparent",
                            border: `1px solid ${comments[person] ? "#3b82f6" : "#334155"}`,
                            borderRadius: 8, color: "#e2e8f0", fontSize: 12, fontFamily: "inherit",
                            padding: "8px 10px", outline: "none", lineHeight: 1.4,
                            cursor: canEdit ? "text" : "default",
                          }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #1e293b" }}>
                        <span style={{
                          background: rowCount > 0 ? "#3b82f620" : "transparent",
                          color: rowCount > 0 ? "#60a5fa" : "#475569",
                          border: `1px solid ${rowCount > 0 ? "#3b82f6" : "#334155"}`,
                          borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700,
                          display: "inline-block", minWidth: 28,
                        }}>{rowCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{
            padding: "12px 20px", borderTop: "1px solid #334155",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          }}>
            <span style={{ color: "#475569", fontSize: 11 }}>
              {canEdit
                ? "Shared board · assign tasks and comments · auto-saves to the cloud"
                : "View-only link · share the edit link with teammates who should change the board"}
            </span>
            <span style={{ color: "#334155", fontSize: 11 }}>
              {PEOPLE.length} members · {CATEGORIES.length} categories
            </span>
          </div>
        </div>

        {(() => {
          const unassigned = PEOPLE.filter(p => getRowCount(p) === 0);
          if (unassigned.length === 0) return null;
          return (
            <div style={{
              marginTop: 20, padding: "12px 18px", borderRadius: 10,
              background: "#fef3c720", border: "1px solid #f59e0b40",
              color: "#fbbf24", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>⚠️</span>
              <span>No tasks assigned yet to: <strong>{unassigned.join(", ")}</strong></span>
            </div>
          );
        })()}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        tbody tr:hover { background: rgba(255,255,255,0.03) !important; }
        button:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
