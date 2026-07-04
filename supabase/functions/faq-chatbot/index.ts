import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: entries } = await supabase.from("faq_entries").select("*");
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    let best = null;
    let bestScore = 0;

    for (const entry of entries ?? []) {
      let score = 0;
      for (const word of words) {
        if (entry.question.toLowerCase().includes(word)) score += 2;
        if (entry.answer.toLowerCase().includes(word)) score += 1;
        if (entry.keywords?.some((k: string) => k.includes(word) || word.includes(k))) score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    const contactFallback =
      "I'm not sure about that. Please contact Studio 8Teen about your question.\n\nPhone: 0906 208 7291 (09062087291)\nEmail: studiobook12@gmail.com\nFacebook: facebook.com/profile.php?id=61556578913301";

    const answer =
      bestScore < 5
        ? contactFallback
        : best.answer;

    return new Response(
      JSON.stringify({
        answer: bestScore >= 5 && best?.question ? `${best.question}\n\n${answer}` : answer,
        matched: bestScore >= 5,
        question: best?.question,
      }),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
