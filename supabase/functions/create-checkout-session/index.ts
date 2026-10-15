import Stripe from "npm:stripe@14.14.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) throw new Error("STRIPE_SECRET_KEY ausente nos secrets.");

    // Identifica o usuário pelo JWT; as consultas seguem a RLS dele
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);
    const user = userData.user;

    const { planId, tenantId, successUrl, cancelUrl } = await req.json();
    if (!planId || !tenantId || !successUrl || !cancelUrl) return json({ error: "Dados obrigatórios ausentes." }, 400);

    // O tenant precisa ser visível ao usuário e coincidir com o vínculo do perfil, se houver
    const { data: tenant } = await supabase.from("tenants").select("id").eq("id", tenantId).maybeSingle();
    if (!tenant) return json({ error: "Tenant não encontrado ou sem permissão." }, 403);
    const { data: profile } = await supabase.from("user_profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (profile?.tenant_id && profile.tenant_id !== tenantId) return json({ error: "Tenant não pertence ao usuário." }, 403);

    // O preço vem do catálogo no banco, nunca do cliente
    const { data: plan } = await supabase.from("subscription_plans")
      .select("id, stripe_price_id").eq("id", planId).maybeSingle();
    if (!plan?.stripe_price_id) return json({ error: "Plano sem preço configurado no Stripe." }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email,
      client_reference_id: tenantId,
      metadata: { tenant_id: tenantId, plan_id: plan.id },
      subscription_data: { metadata: { tenant_id: tenantId, plan_id: plan.id } },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("Erro no checkout:", (err as Error).message);
    return json({ error: (err as Error).message }, 400);
  }
});
