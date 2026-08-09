import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

async function readFunctionError(error) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return body?.error || error.message;
    } catch {
      /* ignore */
    }
  }
  return error?.message || "Request failed.";
}

/**
 * Create a walk-in guest session from a name only and establish a local auth session.
 */
export async function startGuestSession({ fullName }) {
  const { data, error } = await supabase.functions.invoke("create-guest-session", {
    body: { full_name: fullName },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data?.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data?.error || "Could not start quick session.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) throw sessionError;

  return data;
}

export function guestDaysRemaining(guestExpiresAt) {
  if (!guestExpiresAt) return null;
  const ms = new Date(guestExpiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
