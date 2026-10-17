import Stripe from "npm:stripe@14.14.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Service role: o webhook não tem usuário logado e precisa gravar em tenants
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const FREE_PLAN = "FREE";
const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired", "past_due"];

async function setTenantPlan(tenantId: string | undefined, plano: string, subscriptionStatus = "ACTIVE") {
  if (!tenantId) return;
  const { error } = await admin
    .from("tenants")
    .update({ plano, subscription_status: subscriptionStatus })
    .eq("id", tenantId);
  if (error) throw new Error(`Falha ao atualizar tenant ${tenantId}: ${error.message}`);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) return new Response("Assinatura ou segredo ausente.", { status: 400 });

  // A verificação exige o corpo bruto, sem parse prévio
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
  } catch (err) {
    console.error("Assinatura inválida:", (err as Error).message);
    return new Response("Assinatura inválida.", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || session.status === "complete") {
        await setTenantPlan(session.metadata?.tenant_id, session.metadata?.plan_id ?? FREE_PLAN, "ACTIVE");
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const ended = event.type === "customer.subscription.deleted" || ENDED_STATUSES.includes(sub.status);
      // Assinatura encerrada ou inadimplente volta ao plano gratuito automaticamente
      if (ended) {
        const subStatus = sub.status === "past_due" || sub.status === "unpaid" ? "PAST_DUE" : "CANCELED";
        await setTenantPlan(sub.metadata?.tenant_id, FREE_PLAN, subStatus);
      } else if (sub.metadata?.plan_id) {
        await setTenantPlan(sub.metadata.tenant_id, sub.metadata.plan_id, "ACTIVE");
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = (invoice.subscription_details?.metadata as any)?.tenant_id || (invoice.metadata as any)?.tenant_id;
      if (tenantId) {
        await setTenantPlan(tenantId, FREE_PLAN, "PAST_DUE");
      }
    }
  } catch (err) {
    console.error(err);
    // 500 faz o Stripe reenviar o evento
    return new Response((err as Error).message, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
