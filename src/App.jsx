import { useState, useEffect, useRef, useCallback } from "react";
import { PEOPLE, CATEGORIES, CATEGORY_COLORS } from "./lib/constants.js";
import { applyParsedState, initComments, initEmailCounts, initOooStatus } from "./lib/boardState.js";
import { getAccessMode } from "./lib/access.js";
import {
  loadBoard,
  upsertAssignment,
  saveBoardMeta,
  subscribeBoard,
} from "./lib/boardStorage.js";

export default function App() {
  const { canEdit } = getAccessMode();
  const [assignments, setAssignments] = useState(null);
  const [comments, setComments] = useState(null);
  const [emailCounts, setEmailCounts] = useState({});
  const [oooStatus, setOooStatus] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [teamTitle, setTeamTitle] = useState("Inside Sales · Aalborg");
  const [hoveredCell, setHoveredCell] = useState(null);
  const [toast, setToast] = useState(null);
  const savingRef = useRef(false);
  const [workloadColor, setWorkloadColor] = useState("#ef4444");

  function cycleWorkload() {
    setWorkloadColor(prev =>
      prev === "#22c55e" ? "#f59e0b" : prev === "#f59e0b" ? "#ef4444" : "#22c55e"
    );
  }

  const applyState = useCallback((state) => {
    setAssignments(state.assignments);
    setComments(state.comments);
    setTeamTitle(state.title);
    setEmailCounts(state.emailCounts);
    setOooStatus(state.oooStatus);
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
          onMetaChange: ({ title, comments: c, emailCounts: ec, oooStatus: oos }) => {
            if (savingRef.current) return;
            setTeamTitle(title);
            setComments({ ...initComments(), ...(c || {}) });
            setEmailCounts({ ...initEmailCounts(), ...(ec || {}) });
            setOooStatus({ ...initOooStatus(), ...(oos || {}) });
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
    try {
      await saveBoardMeta(titleData, commentsData, emailCounts, oooStatus);
      showToast(toastMsg);
    } catch (err) {
      console.error(err);
      showToast("Save failed — try again");
    } finally {
      savingRef.current = false;
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

  function updateEmailCount(cat, value) {
    if (!canEdit) return;
    const num = Math.max(0, parseInt(value) || 0);
    setEmailCounts(prev => ({ ...prev, [cat]: num }));
  }

  async function saveEmailCounts(newCounts) {
    if (!canEdit) return;
    try {
      await saveBoardMeta(teamTitle, comments, newCounts, oooStatus);
    } catch (err) {
      showToast("Save failed — try again");
    }
  }

    async function resetBoard() {
    if (!window.confirm("Reset all assignments? Comments and OOO status will be kept.")) return;
    const fresh = {};
    for (const person of PEOPLE) {
      fresh[person] = {};
      for (const cat of CATEGORIES) {
        fresh[person][cat] = false;
      }
    }
    setAssignments(fresh);
    for (const person of PEOPLE) {
      for (const cat of CATEGORIES) {
        await upsertAssignment(person, cat, false);
      }
    }
    showToast("Board reset ✓");
  }
  async function toggleOoo(person) {
    if (!canEdit) return;
    const newOoo = { ...oooStatus, [person]: !oooStatus[person] };
    setOooStatus(newOoo);
    try {
      await saveBoardMeta(teamTitle, comments, emailCounts, newOoo);
    } catch (err) {
      setOooStatus(oooStatus);
      showToast("Save failed — try again");
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

  const totalEmails = Object.values(emailCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "16px",
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

      <div style={{ position: "relative", zIndex: 1, maxWidth: "100%", margin: "0 auto" }}>

        <div style={{ marginBottom: 20 }}>
          {loadError && (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 12px 0" }}>{loadError}</p>
          )}
          <div
            onClick={cycleWorkload}
            title="Click to change workload status"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: workloadColor, borderRadius: 8,
              padding: "6px 16px", marginBottom: 16, cursor: "pointer",
              fontWeight: 700, fontSize: 14, color: "#fff",
              boxShadow: `0 0 12px ${workloadColor}80`,
              userSelect: "none",
            }}
          >
            Workload
          </div>

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
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <h1
                onClick={() => canEdit && setEditingTitle(true)}
                style={{
                  color: "#f1f5f9", fontSize: 28, fontWeight: 700, margin: 0,
                  letterSpacing: -0.5, cursor: canEdit ? "pointer" : "default",
                }}
                title={canEdit ? "Click to edit title" : undefined}
              >{teamTitle}</h1>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#1e293b", border: "1px solid #334155",
                borderRadius: 20, padding: "5px 14px",
              }}>
                <span style={{ fontSize: 15 }}>📧</span>
                <span style={{ color: totalEmails > 0 ? "#94a3b8" : "#475569", fontSize: 13, fontWeight: 600 }}>
                  {totalEmails} emails
                </span>
              </div>
              <div
                onClick={cycleWorkload}
                title="Click to change workload status"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: workloadColor, borderRadius: 8,
                  padding: "6px 16px", cursor: "pointer",
                  fontWeight: 700, fontSize: 14, color: "#fff",
                  boxShadow: `0 0 12px ${workloadColor}80`,
                  userSelect: "none",
                }}
              >
                Workload
              </div>
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
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "#0f172a" }}>
                  <th style={{
                    padding: "10px 12px", textAlign: "left", color: "#64748b",
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: "1px solid #334155", width: 140,
                  }}>Team Member</th>
                  {CATEGORIES.map(cat => {
                    const col = CATEGORY_COLORS[cat];
                    const count = getColumnCount(cat);
                    return (
                      <th key={cat} style={{
                        padding: "8px 4px", textAlign: "center",
                        borderBottom: "1px solid #334155",
                      }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                            textTransform: "uppercase", color: col.accent,
                          }}>{cat}</span>
                          <input
                            type="number"
                            min="0"
                            value={emailCounts[cat] ?? 0}
                            onChange={e => updateEmailCount(cat, e.target.value)}
                            onBlur={e => {
                              const newCounts = { ...emailCounts, [cat]: Math.max(0, parseInt(e.target.value) || 0) };
                              saveEmailCounts(newCounts);
                            }}
                            readOnly={!canEdit}
                            title={canEdit ? "Emails in this inbox" : undefined}
                            style={{
                              width: 46, textAlign: "center",
                              background: "transparent",
                              border: "1px solid #334155",
                              borderRadius: 6,
                              color: (emailCounts[cat] ?? 0) > 0 ? "#94a3b8" : "#475569",
                              fontSize: 11, padding: "2px 4px",
                              outline: "none",
                              cursor: canEdit ? "text" : "default",
                            }}
                          />
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
                    padding: "10px 8px", textAlign: "left", color: "#64748b",
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: "1px solid #334155", width: 160,
                  }}>Comment</th>
                  <th style={{
                    padding: "10px 8px", textAlign: "center", color: "#475569",
                    fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: "1px solid #334155",
                  }}>OOO</th>
                </tr>
              </thead>
              <tbody>
                {PEOPLE.map((person, pi) => {
                  const isOoo = oooStatus[person] ?? false;
                  return (
                    <tr
                      key={person}
                      style={{
                        background: isOoo
                          ? "rgba(100,116,139,0.12)"
                          : pi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                        opacity: isOoo ? 0.6 : 1,
                      }}
                    >
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #1e293b", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: `hsl(${(pi * 43) % 360}, 60%, 35%)`,
                            border: `2px solid hsl(${(pi * 43) % 360}, 60%, 50%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                          }}>{person[0]}</div>
                          <span style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 15 }}>{person}</span>
                          {isOoo && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                              color: "#94a3b8", background: "#334155",
                              padding: "2px 5px", borderRadius: 4,
                              textTransform: "uppercase",
                            }}>OOO</span>
                          )}
                        </div>
                      </td>
                      {CATEGORIES.map(cat => {
                        const active = assignments[person][cat];
                        const col = CATEGORY_COLORS[cat];
                        const key = `${person}-${cat}`;
                        const hovered = hoveredCell === key;
                        return (
                          <td key={cat} style={{ padding: "6px 4px", textAlign: "center", borderBottom: "1px solid #1e293b" }}>
                            <button
                              onClick={() => toggle(person, cat)}
                              onMouseEnter={() => setHoveredCell(key)}
                              onMouseLeave={() => setHoveredCell(null)}
                              disabled={!canEdit}
                              title={canEdit ? `${active ? "Remove" : "Assign"} ${person} → ${cat}` : "View only"}
                              style={{
                                width: 28, height: 28, borderRadius: 6,
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
                            width: "100%", minWidth: 100, maxWidth: 160, resize: canEdit ? "vertical" : "none",
                            background: comments[person] ? "#0f172a" : "transparent",
                            border: `1px solid ${comments[person] ? "#3b82f6" : "#334155"}`,
                            borderRadius: 8, color: "#e2e8f0", fontSize: 12, fontFamily: "inherit",
                            padding: "8px 10px", outline: "none", lineHeight: 1.4,
                            cursor: canEdit ? "text" : "default",
                          }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #1e293b" }}>
                        <button
                          onClick={() => toggleOoo(person)}
                          disabled={!canEdit}
                          title={isOoo ? "Mark as available" : "Mark as out of office"}
                          style={{
                            background: "none", border: "none",
                            cursor: canEdit ? "pointer" : "default",
                            fontSize: 18, padding: "4px",
                            opacity: isOoo ? 1 : 0.2,
                            filter: isOoo ? "none" : "grayscale(100%)",
                            transition: "opacity 0.15s, filter 0.15s",
                          }}
                        >✈️</button>
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
              {"Shared board · assign tasks and comments · auto-saves to the cloud"}
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
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
