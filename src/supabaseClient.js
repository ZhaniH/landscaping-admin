import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://osbnojtqcccsstcmukeg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8WkrLeZG3sWcu3ZeDADvbQ_Fu01B9VR";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
