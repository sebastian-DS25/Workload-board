import { STORAGE_KEY, PEOPLE } from "./constants.js";
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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getNextCoordinator(current) {
  const index = PEOPLE.indexOf(current);
  const nextIndex = (index === -1 ? 0 : index + 1) % PEOPLE.length;
  return PEOPLE[nextIndex];
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
    supabase
      .from("board_meta")
      .select("title, comments, workload_color, coordinator, coordinator_date")
      .eq("id", META_ID)
      .maybeSingle(),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (metaRes.error) throw metaRes.error;

  const today = todayString();
  const storedDate = metaRes.data?.coordinator_date ?? null;
  let coordinator = metaRes.data?.coordinator ?? PEOPLE[0];
  let coordinatorDate = storedDate;

  if (storedDate && storedDate < today) {
    coordinator = getNextCoordinator(coordinator);
    coordinatorDate = today;
    await supabase.from("board_meta").upsert({
      id: META_ID,
      coordinator,
      coordinator_date: coordinatorDate,
      updated_at: new Date().toISOString(),
    });
  }

  if (!storedDate) {
    coordinatorDate = today;
    await supabase.from("board_meta").upsert({
      id: META_ID,
      coordinator,
      coordinator_date: coordinatorDate,
      updated_at: new Date().toISOString(),
    });
  }

  return {
    assignments: rowsToAssignments(assignmentsRes.data),
    title: metaRes.data?.title ?? defaultBoardPayload().title,
    comments: { ...initComments(), ...(metaRes.data?.comments || {}) },
    workloadColor: metaRes.data?.workload_color ?? "#ef4444",
    coordinator,
    coordinatorDate,
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

export async function saveBoardMeta(title, comments, workloadColor, coordinator) {
  const today = todayString();

  if (!supabase) {
    const state = loadLocal();
    saveLocal({ ...state, title, comments, workloadColor, coordinator, coordinatorDate: today });
    return;
  }

  const { error } = await supabase.from("board_meta").upsert({
    id: META_ID,
    title,
    comments,
    workload_color: workloadColor,
    coordinator,
    coordinator_date: today,
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
  await saveBoardMeta(payload.title, payload.comments, payload.workloadColor, payload.coordinator);
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
        if (meta) onMetaChange({
          title: meta.title,
          comments: meta.comments,
          workloadColor: meta.workload_color,
          coordinator: meta.coordinator,
          coordinatorDate: meta.coordinator_date,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}