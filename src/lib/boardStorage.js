import { createClient } from "@supabase/supabase-js";
import { BOARD_ID, STORAGE_KEY } from "./constants.js";
import { applyParsedState, defaultBoardPayload } from "./boardState.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const cloudEnabled = Boolean(supabaseUrl && supabaseKey);

const supabase = cloudEnabled
  ? createClient(supabaseUrl, supabaseKey)
  : null;

function loadLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return applyParsedState(JSON.parse(stored));
  } catch {
    /* use defaults */
  }
  return applyParsedState(defaultBoardPayload());
}

export async function loadBoard() {
  if (!supabase) return loadLocal();

  const { data, error } = await supabase
    .from("boards")
    .select("data")
    .eq("id", BOARD_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data?.data) return applyParsedState(defaultBoardPayload());
  return applyParsedState(data.data);
}

export async function saveBoard(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  if (!supabase) return;

  const { error } = await supabase.from("boards").upsert({
    id: BOARD_ID,
    data: payload,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export function subscribeBoard(onRemoteUpdate) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`board-${BOARD_ID}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "boards",
        filter: `id=eq.${BOARD_ID}`,
      },
      (payload) => {
        if (payload.new?.data) onRemoteUpdate(applyParsedState(payload.new.data));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
