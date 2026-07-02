import { supabase } from "./supabase";

let channelSeq = 0;

/** Unique channel per subscriber — avoids Supabase "after subscribe()" errors */
export function subscribeTableChanges(table, onChange) {
  const channelName = `${table}_${++channelSeq}_${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
