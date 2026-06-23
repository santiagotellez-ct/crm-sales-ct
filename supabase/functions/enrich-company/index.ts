import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const domain: unknown = body?.domain;
    const companyName: unknown = body?.company_name;
    if (typeof domain !== "string" || !domain.trim()) {
      return new Response(JSON.stringify({ error: "domain requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Devuelves datos firmográficos de empresas en JSON. Si no sabes algo, usa null." },
          { role: "user", content: `Empresa: ${companyName ?? domain}\nDominio: ${domain}\nDevuelve country (string, país en español), size (uno de: SMB para <250 empleados, MID para 250-5000, ENTERPRISE para >5000), industry (string en español, ej. SaaS, Fintech, Logística).` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "set_firmographics",
            description: "Set company firmographic data",
            parameters: {
              type: "object",
              properties: {
                country: { type: "string" },
                size: { type: "string", enum: ["SMB", "MID", "ENTERPRISE"] },
                industry: { type: "string" },
              },
              required: ["country", "size", "industry"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_firmographics" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: text }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});