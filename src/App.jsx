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
  const [hoveredCell, setHoveredCell] = useState(null);
  const [toast, setToast] = useState(null);
  const [workloadColor, setWorkloadColor] = useState("#ef4444");
  const [darkMode, setDarkMode] = useState(true);
  const savingRef = useRef(false);

  const t = darkMode ? {
    pageBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    tableBg: "#1e293b",
    tableHeader: "#0f172a",
    border: "#334155",
    borderLight: "#1e293b",
    text: "#e2e8f0",
    textMuted: "#64748b",
    textFaint: "#475569",
    textDim: "#334155",
    inputBg: "transparent",
    inputColor: "#94a3b8",
    cellHover: "#1e293b",
    dotInactive: "#334155",
    dotHover: "#475569",
    commentBg: "#0f172a",
    toastBg: "#22c55e",
    badgeBg: "#1e293b",
    badgeText: "#94a3b8",
    oooBg: "rgba(100,116,139,0.12)",
    rowAlt: "rgba(255,255,255,0.015)",
    rowHover: "rgba(255,255,255,0.03)",
    footerText: "#475569",
    warningBg: "#fef3c720",
    warningBorder: "#f59e0b40",
    warningText: "#fbbf24",
    toggleBg: "#334155",
    toggleText: "#94a3b8",
  } : {
    pageBg: "linear-gradient(135deg, #f1f5f9 0%, #ffffff 50%, #f1f5f9 100%)",
    tableBg: "#ffffff",
    tableHeader: "#f8fafc",
    border: "#cbd5e1",
    borderLight: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#334155",
    textFaint: "#64748b",
    textDim: "#cbd5e1",
    inputBg: "#f8fafc",
    inputColor: "#0f172a",
    cellHover: "#f1f5f9",
    dotInactive: "#cbd5e1",
    dotHover: "#94a3b8",
    commentBg: "#f8fafc",
    toastBg: "#22c55e",
    badgeBg: "#f1f5f9",
    badgeText: "#334155",
    oooBg: "rgba(100,116,139,0.08)",
    rowAlt: "rgba(0,0,0,0.015)",
    rowHover: "rgba(0,0,0,0.03)",
    footerText: "#64748b",
    warningBg: "#fef9c3",
    warningBorder: "#fde047",
    warningText: "#854d0e",
    toggleBg: "#e2e8f0",
    toggleText: "#334155",
  };

  const applyState = useCallback((state) => {
    setAssignments(state.assignments);
    setComments(state.comments);
    setEmailCounts(state.emailCounts || {});
    setOooStatus(state.oooStatus || {});
    if (state.workloadColor) setWorkloadColor(state.workloadColor);
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
          onMetaChange: ({ comments: c, emailCounts: ec, oooStatus: oos, workloadColor: wc }) => {
            if (savingRef.current) return;
            setComments({ ...initComments(), ...(c || {}) });
            setEmailCounts({ ...initEmailCounts(), ...(ec || {}) });
            setOooStatus({ ...initOooStatus(), ...(oos || {}) });
            if (wc) setWorkloadColor(wc);
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

  async function saveMeta(commentsData, toastMsg = "Saved ✓") {
    if (!canEdit) return;
    savingRef.current = true;
    try {
      await saveBoardMeta("Inside Sales · Aalborg", commentsData, emailCounts, oooStatus, workloadColor);
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
    saveMeta(comments);
  }

  function updateEmailCount(cat, value) {
    if (!canEdit) return;
    const num = Math.max(0, parseInt(value) || 0);
    setEmailCounts(prev => ({ ...prev, [cat]: num }));
  }

  async function saveEmailCounts(newCounts) {
    if (!canEdit) return;
    try {
      await saveBoardMeta("Inside Sales · Aalborg", comments, newCounts, oooStatus, workloadColor);
    } catch (err) {
      showToast("Save failed — try again");
    }
  }

  async function toggleOoo(person) {
    if (!canEdit) return;
    const newOoo = { ...oooStatus, [person]: !oooStatus[person] };
    setOooStatus(newOoo);
    try {
      await saveBoardMeta("Inside Sales · Aalborg", comments, emailCounts, newOoo, workloadColor);
    } catch (err) {
      setOooStatus(oooStatus);
      showToast("Save failed — try again");
    }
  }

  async function cycleWorkload() {
    const next = workloadColor === "#22c55e" ? "#f59e0b" : workloadColor === "#f59e0b" ? "#ef4444" : "#22c55e";
    setWorkloadColor(next);
    try {
      await saveBoardMeta("Inside Sales · Aalborg", comments, emailCounts, oooStatus, next);
    } catch (err) {
      showToast("Save failed — try again");
    }
  }

  async function resetBoard() {
    if (!window.confirm("Reset all assignments and email counts? Comments and OOO status will be kept.")) return;
    const fresh = {};
    for (const person of PEOPLE) {
      fresh[person] = {};
      for (const cat of CATEGORIES) {
        fresh[person][cat] = false;
      }
    }
    setAssignments(fresh);
    const freshCounts = {};
    for (const cat of CATEGORIES) freshCounts[cat] = 0;
    setEmailCounts(freshCounts);
    for (const person of PEOPLE) {
      for (const cat of CATEGORIES) {
        await upsertAssignment(person, cat, false);
      }
    }
    await saveBoardMeta("Inside Sales · Aalborg", comments, freshCounts, oooStatus, workloadColor);
    showToast("Board reset ✓");
  }

  function getColumnCount(cat) {
    return PEOPLE.filter(p => assignments?.[p]?.[cat]).length;
  }

  function getRowCount(person) {
    return CATEGORIES.filter(c => assignments?.[person]?.[c]).length;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: darkMode ? "#0f172a" : "#f1f5f9" }}>
        <div style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 14, letterSpacing: 3 }}>LOADING…</div>
      </div>
    );
  }

  const totalEmails = Object.values(emailCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: t.pageBg,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "16px",
      position: "relative",
      boxSizing: "border-box",
      width: "100%",
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(${darkMode ? "rgba(148,163,184,0.03)" : "rgba(0,0,0,0.03)"} 1px, transparent 1px), linear-gradient(90deg, ${darkMode ? "rgba(148,163,184,0.03)" : "rgba(0,0,0,0.03)"} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 100,
          background: t.toastBg, color: "#fff", fontWeight: 600,
          padding: "10px 20px", borderRadius: 10, fontSize: 13,
          boxShadow: "0 8px 32px rgba(34,197,94,0.3)",
        }}>{toast}</div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: "100%", margin: "0 auto" }}>

        <div style={{ marginBottom: 20 }}>
          {loadError && (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 12px 0" }}>{loadError}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: t.badgeBg, border: `1px solid ${t.border}`,
              borderRadius: 20, padding: "5px 14px",
            }}>
              <span style={{ fontSize: 15 }}>📧</span>
              <span style={{ color: totalEmails > 0 ? t.inputColor : t.textFaint, fontSize: 13, fontWeight: 600 }}>
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
            <div
              onClick={resetBoard}
              title="Reset all assignments and email counts"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: t.badgeBg, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: "6px 16px", cursor: "pointer",
                fontWeight: 700, fontSize: 14, color: t.badgeText,
                userSelect: "none",
              }}
            >
              🔄 Reset
            </div>
            <div
              onClick={() => setDarkMode(prev => !prev)}
              title="Toggle light/dark mode"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: t.toggleBg, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: "6px 16px", cursor: "pointer",
                fontWeight: 700, fontSize: 14, color: t.toggleText,
                userSelect: "none",
              }}
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </div>
          </div>
        </div>

        <div style={{
          background: t.tableBg,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          overflow: "hidden",
          boxShadow: darkMode ? "0 24px 80px rgba(0,0,0,0.5)" : "0 4px 32px rgba(0,0,0,0.08)",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: t.tableHeader }}>
                  <th style={{
                    padding: "10px 12px", textAlign: "left", color: t.textMuted,
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: `1px solid ${t.border}`, width: 140,
                  }}>Team Member</th>
                  {CATEGORIES.map(cat => {
                    const col = CATEGORY_COLORS[cat];
                    const count = getColumnCount(cat);
                    return (
                      <th key={cat} style={{
                        padding: "8px 4px", textAlign: "center",
                        borderBottom: `1px solid ${t.border}`,
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
                              background: t.inputBg,
                              border: `1px solid ${t.border}`,
                              borderRadius: 6,
                              color: (emailCounts[cat] ?? 0) > 0 ? t.inputColor : t.textFaint,
                              fontSize: 11, padding: "2px 4px",
                              outline: "none",
                              cursor: canEdit ? "text" : "default",
                            }}
                          />
                          <span style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: count > 0 ? col.accent : t.badgeBg,
                            color: count > 0 ? "#fff" : t.textFaint,
                            fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `1px solid ${count > 0 ? col.accent : t.border}`,
                          }}>{count}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{
                    padding: "10px 8px", textAlign: "left", color: t.textMuted,
                    fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: `1px solid ${t.border}`, width: 160,
                  }}>Comment</th>
                  <th style={{
                    padding: "10px 8px", textAlign: "center", color: t.textFaint,
                    fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
                    borderBottom: `1px solid ${t.border}`, width: 50,
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
                        background: isOoo ? t.oooBg : pi % 2 === 0 ? "transparent" : t.rowAlt,
                        opacity: isOoo ? 0.6 : 1,
                      }}
                    >
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${t.borderLight}`, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: `hsl(${(pi * 43) % 360}, 60%, ${darkMode ? "35%" : "45%"})`,
                            border: `2px solid hsl(${(pi * 43) % 360}, 60%, ${darkMode ? "50%" : "60%"})`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                          }}>{person[0]}</div>
                          <span style={{ color: t.text, fontWeight: 600, fontSize: 15 }}>{person}</span>
                          {isOoo && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                              color: t.textFaint, background: t.border,
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
                          <td key={cat} style={{ padding: "6px 4px", textAlign: "center", borderBottom: `1px solid ${t.borderLight}` }}>
                            <button
                              onClick={() => toggle(person, cat)}
                              onMouseEnter={() => setHoveredCell(key)}
                              onMouseLeave={() => setHoveredCell(null)}
                              disabled={!canEdit}
                              title={canEdit ? `${active ? "Remove" : "Assign"} ${person} → ${cat}` : "View only"}
                              style={{
                                width: 28, height: 28, borderRadius: 6,
                                border: active ? `2px solid ${col.accent}` : `1.5px solid ${t.border}`,
                                background: active ? col.bg : (hovered && canEdit ? t.cellHover : "transparent"),
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
                                  background: hovered && canEdit ? t.dotHover : t.dotInactive,
                                }} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${t.borderLight}`, verticalAlign: "middle" }}>
                        <textarea
                          value={comments[person] || ""}
                          onChange={e => updateComment(person, e.target.value)}
                          onBlur={() => saveComment()}
                          readOnly={!canEdit}
                          placeholder={canEdit ? "Add a note…" : "—"}
                          rows={2}
                          style={{
                            width: "100%", minWidth: 100, maxWidth: 160, resize: canEdit ? "vertical" : "none",
                            background: comments[person] ? t.commentBg : "transparent",
                            border: `1px solid ${comments[person] ? "#3b82f6" : t.border}`,
                            borderRadius: 8, color: t.text, fontSize: 12, fontFamily: "inherit",
                            padding: "8px 10px", outline: "none", lineHeight: 1.4,
                            cursor: canEdit ? "text" : "default",
                          }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: `1px solid ${t.borderLight}` }}>
                        <button
                          onClick={() => toggleOoo(person)}
                          disabled={!canEdit}
                          title={isOoo ? "Mark as available" : "Mark as out of office"}
                          style={{
                            background: isOoo ? "#ef444420" : "none",
                            border: isOoo ? "2px solid #ef4444" : `2px solid ${t.border}`,
                            borderRadius: 8,
                            cursor: canEdit ? "pointer" : "default",
                            fontSize: 18, padding: "6px 8px",
                            opacity: canEdit ? 1 : 0.7,
                            transition: "all 0.2s",
                            boxShadow: isOoo ? "0 0 12px #ef444460" : "none",
                            transform: isOoo ? "scale(1.2)" : "scale(1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
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
            padding: "12px 20px", borderTop: `1px solid ${t.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          }}>
            <span style={{ color: t.footerText, fontSize: 11 }}>
              Shared board · assign tasks and comments · auto-saves to the cloud
            </span>
            <span style={{ color: t.textDim, fontSize: 11 }}>
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
              background: t.warningBg, border: `1px solid ${t.warningBorder}`,
              color: t.warningText, fontSize: 12, display: "flex", alignItems: "center", gap: 8,
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
        tbody tr:hover { background: ${t.rowHover} !important; }
        button:disabled { opacity: 0.7; }
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
