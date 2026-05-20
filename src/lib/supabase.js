import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

export const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = cloudEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
