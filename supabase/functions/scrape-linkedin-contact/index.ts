import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const linkedinUrl: unknown = body?.linkedin_url;
    if (typeof linkedinUrl !== "string" || !linkedinUrl.includes("linkedin.com/")) {
      return new Response(JSON.stringify({ error: "linkedin_url inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: linkedinUrl,
        onlyMainContent: true,
        formats: [
          {
            type: "json",
            prompt:
              "Extract the person's full name and their current job title (role) at their current company from this LinkedIn profile. Return only name and role.",
            schema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Full name of the person" },
                role: { type: "string", description: "Current job title / role" },
              },
              required: ["name"],
            },
          },
        ],
      }),
    });

    const fcData = await fcRes.json();
    if (!fcRes.ok) {
      console.error("Firecrawl error", fcRes.status, fcData);
      return new Response(
        JSON.stringify({ error: `Firecrawl ${fcRes.status}: ${fcData?.error ?? "unknown"}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Firecrawl v2 returns { success, data: { json: {...}, metadata: {...} } }
    const extracted = fcData?.data?.json ?? fcData?.json ?? {};
    const name = typeof extracted.name === "string" ? extracted.name : "";
    const role = typeof extracted.role === "string" ? extracted.role : "";

    return new Response(JSON.stringify({ name, role }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("scrape-linkedin-contact error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
