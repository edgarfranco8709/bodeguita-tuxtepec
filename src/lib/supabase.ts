import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wdftiprhjhdeipughiay.supabase.co";
const supabaseAnonKey = "sb_publishable_J8__UVY9apDmSET8Pc7Irg_LU9Bdp-u"; // sb_publishable_J8__UVY9apDmSET8Pc7Irg_LU9Bdp-u

export const supabase = createClient(supabaseUrl, supabaseAnonKey);