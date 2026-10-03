import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UnsplashPhoto = {
  id: string;
  urls?: { small?: string; regular?: string };
  alt_description?: string | null;
  user?: { name?: string };
  links?: { html?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!accessKey) {
      return new Response(
        JSON.stringify({ error: "Unsplash is not configured.", images: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const keywords: string[] = Array.isArray(body?.keywords)
      ? body.keywords.filter((k: unknown) => typeof k === "string" && k.trim())
      : [];
    const perQuery = Math.min(Math.max(Number(body?.perQuery) || 3, 1), 5);
    const excludeUrls = new Set(
      Array.isArray(body?.excludeUrls)
        ? body.excludeUrls.filter((u: unknown) => typeof u === "string")
        : [],
    );

    if (!keywords.length) {
      return new Response(
        JSON.stringify({ error: "No keywords provided.", images: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const seen = new Set<string>();
    const images: Array<{
      id: string;
      url: string;
      alt: string;
      credit: string;
      unsplashLink: string;
      source: "unsplash";
    }> = [];

    for (const keyword of keywords.slice(0, 3)) {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", keyword);
      url.searchParams.set("per_page", String(perQuery));
      url.searchParams.set("orientation", "squarish");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${accessKey}` },
      });

      if (!res.ok) {
        console.error("Unsplash error", keyword, res.status, await res.text());
        continue;
      }

      const data = await res.json();
      for (const img of (data.results || []) as UnsplashPhoto[]) {
        const photoUrl = img.urls?.regular || img.urls?.small;
        if (!photoUrl || seen.has(photoUrl) || excludeUrls.has(photoUrl)) continue;
        seen.add(photoUrl);
        images.push({
          id: `unsplash-${img.id}`,
          url: photoUrl,
          alt: img.alt_description || keyword,
          credit: img.user?.name || "Unsplash",
          unsplashLink: img.links?.html || "https://unsplash.com",
          source: "unsplash",
        });
      }
    }

    return new Response(JSON.stringify({ images: images.slice(0, 9) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to fetch images" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
