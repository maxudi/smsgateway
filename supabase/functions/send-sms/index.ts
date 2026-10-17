import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Tratamento de CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido. Utilize POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 1. Validar cabeçalho Authorization
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Cabeçalho Authorization com Bearer token ausente." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace(/^[Bb]earer\s+/, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token de API não fornecido no cabeçalho Authorization." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Inicializar cliente Supabase com Service Role
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
      return new Response(
        JSON.stringify({ error: "Erro de configuração no servidor." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3. Validação do Token via RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("validate_api_token", {
      p_token: token,
    });

    if (rpcError) {
      console.error("Erro na RPC validate_api_token:", rpcError);
      return new Response(
        JSON.stringify({ error: "Erro ao validar token de API.", details: rpcError.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extrair tenant_id do resultado da RPC
    let tenantId: string | null = null;
    if (typeof rpcResult === "string" && rpcResult.trim().length > 0) {
      tenantId = rpcResult.trim();
    } else if (rpcResult && typeof rpcResult === "object") {
      tenantId = (rpcResult as any).tenant_id || (rpcResult as any).id || (Array.isArray(rpcResult) ? (rpcResult[0]?.tenant_id || rpcResult[0]?.id) : null);
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Token de API inválido, inativo ou expirado." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Ler corpo da requisição JSON { to, message, sim_slot, target_device_id }
    let body: any;
    try {
      body = await req.json();
    } catch (_err) {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição deve ser um JSON válido contendo 'to' e 'message'." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rawTo = body?.to ?? body?.phone ?? body?.recipient;
    const message = body?.message;

    // Extração com fallbacks para evitar "sim_slot is not defined"
    const sim_slot = body?.sim_slot !== undefined && body?.sim_slot !== null ? Number(body.sim_slot) : 0;
    const target_device_id = body?.target_device_id ? String(body.target_device_id).trim() : "ALL";

    if (!rawTo || typeof rawTo !== "string" || !rawTo.trim()) {
      return new Response(
        JSON.stringify({ error: "Campo obrigatório 'to' (número do destinatário) ausente ou inválido." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Campo obrigatório 'message' (texto da mensagem) ausente ou vazio." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limpa caracteres especiais mantendo dígitos e sinal de '+' se houver
    const phone = rawTo.replace(/[^\d+]/g, "").trim();

    // 5. Inserir na fila sms_queue
    const { data: queueData, error: insertError } = await supabaseAdmin
      .from("sms_queue")
      .insert({
        tenant_id: tenantId,
        phone: phone,
        message: message.trim(),
        sim_slot: sim_slot,
        target_device_id: target_device_id,
        status: "PENDING",
        created_at: new Date().toISOString(),
      })
      .select("id, sim_slot")
      .single();

    if (insertError) {
      console.error("Erro ao inserir na sms_queue:", insertError);
      return new Response(
        JSON.stringify({ error: "Falha ao enfileirar mensagem SMS.", details: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Atualiza last_used_at na tabela api_tokens em segundo plano
    supabaseAdmin
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token", token)
      .then();

    // 6. Retorno padronizado 200
    return new Response(
      JSON.stringify({
        success: true,
        messageId: queueData.id,
        status: "enfileirado",
        sim_slot: queueData.sim_slot ?? sim_slot,
        target_device_id: target_device_id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Erro inesperado em send-sms:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor.", details: err?.message || String(err) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});