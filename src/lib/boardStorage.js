import { STORAGE_KEY } from "./constants.js";
import {
  initAssignments,
  initComments,
  initEmailCounts,
  initOooStatus,
  defaultBoardPayload,
  applyParsedState,
} from "./boardState.js";
import { supabase, cloudEnabled } from "./supabase.js";

export { cloudEnabled };

const META_ID = "default";

export function assignmentId(person, category) {
  return `${person}-${category}`;
}

function rowsToAssignments(rows) {
  const assignments = initAssignments();
  for (const row of rows || []) {
    if (assignments[row.person] && row.category in assignments[row.person]) {
      assignments[row.person][row.category] = Boolean(row.active);
    }
  }
  return assignments;
}

function loadLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return applyParsedState(JSON.parse(stored));
  } catch {
    /* use defaults */
  }
  return applyParsedState(defaultBoardPayload());
}

function saveLocal(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function loadBoard() {
  if (!supabase) return loadLocal();

  const [assignmentsRes, metaRes] = await Promise.all([
    supabase.from("assignments").select("person, category, active"),
    supabase.from("board_meta").select("*").eq("id", META_ID).maybeSingle(),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (metaRes.error) throw metaRes.error;

  return {
    assignments: rowsToAssignments(assignmentsRes.data),
    title: metaRes.data?.title ?? defaultBoardPayload().title,
    comments: { ...initComments(), ...(metaRes.data?.comments || {}) },
    emailCounts: { ...initEmailCounts(), ...(metaRes.data?.email_counts || {}) },
    oooStatus: { ...initOooStatus(), ...(metaRes.data?.ooo_status || {}) },
    coordinator: metaRes.data?.coordinator ?? null,
    lastReset: metaRes.data?.last_reset ?? null,
  };
}

export async function upsertAssignment(person, category, active) {
  const id = assignmentId(person, category);
  const row = {
    id,
    person,
    category,
    active,
    updated_at: new Date().toISOString(),
  };

  if (!supabase) {
    const state = loadLocal();
    state.assignments[person][category] = active;
    saveLocal(state);
    return;
  }

  const { error } = await supabase.from("assignments").upsert(row);
  if (error) throw error;
}

export async function saveBoardMeta(title, comments, emailCounts, oooStatus, coordinator = null, lastReset = null) {
  if (!supabase) {
    const state = loadLocal();
    saveLocal({ ...state, title, comments, emailCounts, oooStatus, coordinator, lastReset });
    return;
  }

  const { error } = await supabase.from("board_meta").upsert({
    id: META_ID,
    title,
    comments,
    email_counts: emailCounts,
    ooo_status: oooStatus,
    coordinator,
    last_reset: lastReset,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

/** @deprecated Use upsertAssignment / saveBoardMeta */
export async function saveBoard(payload) {
  if (!supabase) {
    saveLocal(payload);
    return;
  }
  await saveBoardMeta(payload.title, payload.comments);
}

export function subscribeBoard({ onAssignmentChange, onMetaChange }) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`workload-board-realtime-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assignments" },
      (payload) => {
        const row = payload.new ?? payload.old;
        if (!row?.person || !row?.category) return;

        onAssignmentChange({
          person: row.person,
          category: row.category,
          active: payload.eventType === "DELETE" ? false : Boolean(payload.new?.active),
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "board_meta", filter: `id=eq.${META_ID}` },
      (payload) => {
        const meta = payload.new;
        if (meta) onMetaChange({
          title: meta.title,
          comments: meta.comments,
          emailCounts: meta.email_counts,
          oooStatus: meta.ooo_status,
          coordinator: meta.coordinator ?? null,
          lastReset: meta.last_reset ?? null,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
