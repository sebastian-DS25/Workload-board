import { STORAGE_KEY } from "./constants.js";
import {
  initAssignments,
  initComments,
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
    supabase.from("board_meta").select("title, comments").eq("id", META_ID).maybeSingle(),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (metaRes.error) throw metaRes.error;

  return {
    assignments: rowsToAssignments(assignmentsRes.data),
    title: metaRes.data?.title ?? defaultBoardPayload().title,
    comments: { ...initComments(), ...(metaRes.data?.comments || {}) },
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

export async function saveBoardMeta(title, comments) {
  const payload = { assignments: null, title, comments };

  if (!supabase) {
    const state = loadLocal();
    saveLocal({ ...state, title, comments });
    return;
  }

  const { error } = await supabase.from("board_meta").upsert({
    id: META_ID,
    title,
    comments,
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
    .channel("workload-board-realtime")
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
        if (meta) onMetaChange({ title: meta.title, comments: meta.comments });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
