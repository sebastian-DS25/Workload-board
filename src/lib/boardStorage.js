import { STORAGE_KEY, PEOPLE, CATEGORIES } from "./constants.js";
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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getNextCoordinator(current, oooStatus) {
  const index = PEOPLE.indexOf(current);
  for (let i = 1; i <= PEOPLE.length; i++) {
    const next = PEOPLE[(index + i) % PEOPLE.length];
    if (!oooStatus?.[next]) return next;
  }
  return current;
}

function loadLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return applyParsedState(JSON.parse(stored));
  } catch { /* use defaults */ }
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
      .select("title, comments, email_counts, ooo_status, workload_color, coordinator, coordinator_date")
      .eq("id", META_ID)
      .maybeSingle(),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (metaRes.error) throw metaRes.error;

  const today = todayString();
  const oooStatus = metaRes.data?.ooo_status || {};
  let coordinator = metaRes.data?.coordinator ?? PEOPLE[0];
  let coordinatorDate = metaRes.data?.coordinator_date ?? "";
  let assignments = rowsToAssignments(assignmentsRes.data);
  let emailCounts = { ...initEmailCounts(), ...(metaRes.data?.email_counts || {}) };

  // If the date has changed since last check, rotate coordinator AND reset the board
  if (coordinatorDate !== today) {
    coordinator = getNextCoordinator(coordinator, oooStatus);
    coordinatorDate = today;

    // Reset all assignments to false
    assignments = initAssignments();
    await Promise.all(
      PEOPLE.flatMap(person =>
        CATEGORIES.map(cat =>
          supabase.from("assignments").upsert({
            id: assignmentId(person, cat),
            person,
            category: cat,
            active: false,
            updated_at: new Date().toISOString(),
          })
        )
      )
    );

    // Reset email counts to 0
    emailCounts = initEmailCounts();

    await supabase.from("board_meta").upsert({
      id: META_ID,
      coordinator,
      coordinator_date: coordinatorDate,
      email_counts: emailCounts,
      updated_at: new Date().toISOString(),
    });
  }

  return {
    assignments,
    title: metaRes.data?.title ?? defaultBoardPayload().title,
    comments: { ...initComments(), ...(metaRes.data?.comments || {}) },
    emailCounts,
    oooStatus,
    workloadColor: metaRes.data?.workload_color ?? "#ef4444",
    coordinator,
  };
}

export async function upsertAssignment(person, category, active) {
  const id = assignmentId(person, category);
  const row = {
    id, person, category, active,
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

export async function saveBoardMeta(title, comments, emailCounts, oooStatus, workloadColor, coordinator) {
  if (!supabase) {
    const state = loadLocal();
    saveLocal({ ...state, title, comments, emailCounts, oooStatus, workloadColor, coordinator });
    return;
  }

  const { error } = await supabase.from("board_meta").upsert({
    id: META_ID,
    title,
    comments,
    email_counts: emailCounts,
    ooo_status: oooStatus,
    workload_color: workloadColor,
    coordinator,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
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
          comments: meta.comments,
          emailCounts: meta.email_counts,
          oooStatus: meta.ooo_status,
          workloadColor: meta.workload_color,
          coordinator: meta.coordinator,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}