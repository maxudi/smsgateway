# SMSMax (Max Netminas) - Gateway SMS multi-chip

Painel web (SaaS) para disparo e recebimento de SMS usando **celulares Android do próprio usuário** como gateway.
O servidor não envia SMS: grava as mensagens no Supabase, e o app Android lê a fila e envia pelos chips
(SIM 0 e SIM 1) de cada aparelho. A entrega final e os créditos do chip são responsabilidade da operadora.

## Stack

- **Frontend:** React 18, Vite, React Router 6, Tailwind CSS (tema escuro), lucide-react. Gráficos em SVG e Tailwind, sem biblioteca.
- **Backend:** Supabase (Postgres com RLS, Auth, Realtime, RPC, Edge Functions em Deno).
- **Pagamento:** Stripe Checkout (assinatura mensal).
- **Deploy:** Dockerfile (build Node, runtime Nginx) para Easypanel.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a anon key do seu projeto Supabase
npm run dev
```

O `.env` precisa **apenas** de:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
```

Nunca coloque `service_role` nem chaves do Stripe em variáveis `VITE_*`: elas vão para o JavaScript do navegador.

## Deploy

**Frontend (Easypanel):** aponte o serviço para este repositório usando o `Dockerfile` da raiz e configure
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` como **Build Args** (o Vite embute os valores no build).
Em Supabase, Authentication, URL Configuration, adicione a URL do Easypanel (Site URL e Redirect URLs).

**Edge Functions:**

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
npx supabase functions deploy create-checkout-session
npx supabase functions deploy stripe-webhook
```

No painel do Stripe, o webhook aponta para `https://api.smsmax.netminas.com/functions/v1/stripe-webhook`
(eventos `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
O Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nas funções.

---

# Prompt para recriar este sistema

Copie o texto abaixo para um assistente de código. Ajuste os nomes de colunas ao seu banco.

## Proposta

Construa um painel web (SaaS) de disparo e recebimento de SMS que usa celulares Android do usuário como gateway,
com rotação entre os dois chips de cada aparelho, agendamento inteligente, webhooks de recebimento, planos
com cobrança via Stripe e um perfil de superadministrador isento de limites. Interface em português do Brasil,
tema escuro (tons de azul e preto, cartões com bordas sutis), componentes `card`, `btn-primary`, `btn-ghost`,
`btn-danger`, `badge`, `input` e `label` definidos em Tailwind.

## Modelo de dados (Supabase)

- `devices` (id TEXT = Android ID, user_id, name, status, last_ping, sim1_operator, sim2_operator). Online = status
  `online` e ping nos últimos 90 s.
- `contacts` (user_id, name, phone só com dígitos e DDI, tipo/origem, opted_out), `contact_groups` (slug `todas`
  entra em qualquer grupo) e `contact_group_members`.
- `campaigns` (title, message_template, status DRAFT/RUNNING/PAUSED/COMPLETED/CANCELLED/SUSPENDED, total_contacts,
  sent_count, failed_count, config JSONB, scheduled_for, interval_seconds, start_hour_allowed, end_hour_allowed,
  target_device_id, sim_slot_preference).
- **Envio em duas filas:**
  - `sms_schedule` (fila fria): campaign_id, user_id, target_device_id, sim_slot, phone, message, scheduled_for,
    status `WAITING`, `PAUSED` ou `CANCELLED`.
  - `sms_queue` (fila quente, em trânsito para o celular): status `PENDING`, `SENT`, `DELIVERED`, `FAILED`,
    `OPTED_OUT`.
  - Um job `pg_cron` promove `sms_schedule` para `sms_queue` quando `scheduled_for` chega, preservando `campaign_id`.
  - `sms_sent` guarda os enviados.
- `sms_inbound` (SMS recebidos), `user_webhooks` (device_id, user_id, events `['sms_received']`, url, secret_key,
  is_active), `webhook_delivery_queue` (webhook_id, payload JSONB com `event`, attempts, max_attempts, status,
  next_retry_at).
- `tenants` (email, plano, max_devices, max_monthly_sms, max_contacts, is_master), `subscription_plans`
  (id FREE/STARTER/PRO/PLUS, name, price_brl, price_usd, limites, allow_scheduling, description, stripe_price_id),
  `user_profiles` (tenant_id) e, como legado, `plans`.
- **RPC `get_dashboard_analytics(p_year)`** retorna `current_month {sent, received}`,
  `monthly_evolution[12] {month, sent, received, failed}` e `by_chip`.
- RLS ligada em todas as tabelas, com políticas de select, insert, update e delete por `user_id = auth.uid()`.
  A coluna `tenants.is_master` não pode ser alterada pelo próprio usuário.

## Frontend

**Autenticação e layout:** login, rotas protegidas, Sidebar (Dashboard, Dispositivos, Contatos, Disparar SMS,
Campanhas, Fila/Histórico, Planos, Perfil / Planos) e Navbar.

- `AuthContext` expõe `session`, `user`, `profile`, `tenant`, `plan`, `isMaster` e `refreshProfile`. O tenant é
  achado por `user_profiles.tenant_id`, depois por `tenants.email`, depois pela RLS. O plano vem de
  `tenants.plano` para `subscription_plans`, com os limites do tenant prevalecendo e fallback para
  `user_profiles.plan_id` para `plans`. `isMaster = !!tenant?.is_master`.
- Navbar: contador "SMS no mês" com seta verde para cima (enviados) e seta azul para baixo (recebidos) via RPC,
  atualizado a cada 30 s, barra de cota e badge do plano. Para o master mostra "Admin Master" e "Ilimitado".

**Dashboard:** cards (aparelhos online, contatos, na fila, enviados, falhas), seletor de ano e gráficos: evolução
mensal em barras (enviados verde, recebidos azul, falhas vermelho), rosca de taxa de entrega e barras por chip.

**Dispositivos:** cards com status online/offline e operadora dos SIMs, vincular e desvincular aparelho, limite de
`max_devices` (ignorado para o master). Cada card tem uma seção colapsável de webhook: URL (`type="url"`, só
http/https), token Bearer com revelar, copiar e "Gerar Token" (`whsec_` + 24 caracteres aleatórios), toggle de
ativo. Salva em `user_webhooks` com update ou insert (sem upsert). "Testar envio" insere em
`webhook_delivery_queue` um payload `{event:'sms.test', device_id, sim_slot:0, from, message, received_at}` com
attempts 0, max_attempts 5, status PENDING e next_retry_at agora, e mostra um toast.

**Contatos:** busca no cliente, filtros por tipo e interesse, carga completa em lotes de 1000 com `.range()`,
paginação de 10/25/50/Mostrar Todos, seleção por checkbox (o cabeçalho seleciona todo o filtro atual), exclusão em
massa em lotes de 100 com `confirm`, cadastro com máscara por país, edição de tipo e interesses, importação de CSV
`Nome,Telefone` sem duplicados.

**Disparar SMS:**
- Destinatários: todos os ativos, por grupo, por tipo/origem, escolher contatos (busca e paginação 50/100/250/todos)
  e envio avulso (números colados, separados por vírgula ou quebra de linha, normalizados com DDI 55 quando vierem
  com 10 ou 11 dígitos). Opt-out sempre excluído.
- Aparelho e chip: todos os cadastrados (mesmo offline, com aviso de que o envio começa quando o app conectar) ou
  um específico; chip alternado ou fixo; rodízio round-robin entre canais (aparelho x slot).
- Mensagem: contador (GSM-7 e Unicode, partes), `{nome}`, prévia. Humanização: espaçamento aleatório e sufixo de
  3 letras maiúsculas e minúsculas único no lote, com margem de 5 caracteres.
- Cadência por chip: intervalo aleatório min/máx (padrão 45 a 90 s) independente em cada chip, janela de horário
  (padrão 08:30 a 18:30), dias da semana (padrão Seg a Sex), limite diário por chip (padrão 30) e estimativa de
  envios por chip/dia, total por dia e dias necessários. Se passar da hora fim, o dia não for válido ou a cota
  acabar, o chip salta para o início da janela do próximo dia válido.
- Início agendado: checkbox e `datetime-local`; a data é a base da linha do tempo.
- Gravação: ao iniciar, insere em lotes de 300 em `sms_schedule` (`WAITING`) e a primeira mensagem de cada chip,
  se já estiver na hora, direto em `sms_queue` (`PENDING`). Com início futuro, tudo vai para `sms_schedule`.
  Rascunho grava `PAUSED`. Todo insert leva `campaign_id`. Falha em campanha nova desfaz tudo.
  Editar regenera a fila não enviada; "Repetir" reaproveita mensagem e números.
- Limites do plano: cota mensal e intervalo mínimo, ignorados para o master.

**Campanhas:** contadores "Fila agendada" (`sms_schedule` WAITING), "Disparando agora" (`sms_queue` PENDING) e
"Enviados" (`sms_queue` SENT/DELIVERED ou `sent_count`, o maior), por Realtime com debounce e polling de
fallback. Se `sent + failed >= total`, mostra "Concluída" em verde. Ações: pausar (WAITING para PAUSED e pendentes
da fila), retomar e iniciar (reagendam por chip a partir de agora, respeitando janela, dias e cota, voltando a
`WAITING`), cancelar (`CANCELLED` e remove pendentes da `sms_queue`), alterar chips/aparelho (um UPDATE por canal,
em lotes, nas duas filas), repetir, gaveta de destinatários unindo as três tabelas ("Agendado para DD/MM HH:mm",
"Na fila de envio", "Enviado") e excluir.

**Planos (`/planos`):** vitrine com uma faixa "Seu plano atual" e 4 cards (Gratuito, Starter, Profissional,
Empresarial), com o Profissional destacado como "Mais popular". Cada card mostra preço em R$ e US$, descrição,
aparelhos, rotação multi-chip (Dual-SIM), disparos por mês, agendamento, contatos e webhooks. O botão
"Assinar Plano" chama a Edge Function `create-checkout-session` e redireciona para `session.url`. Plano atual e
gratuito ficam desabilitados. Aviso fixo: "O envio do SMS é realizado via aparelho e chips do usuário; a entrega
final e créditos do chip são de responsabilidade da operadora de telefonia celular."

**Perfil / Planos (`/perfil`):** dados do usuário, plano atual, cards de uso (aparelhos, SMS/mês via RPC,
contatos) contra os limites do tenant (fallback FREE: 1 aparelho, 300 SMS, 100 contatos) e botão "Ver planos".
Trata `?pagamento=sucesso` ("Pagamento reconhecido! Seus novos limites foram liberados com sucesso.") e
`?pagamento=cancelado`, recarregando os limites.

**Admin Master:** `tenants.is_master` (definido por SQL para o e-mail do dono, nunca por comparação de e-mail no
React). O master ignora limites de aparelhos, cota e intervalo, vê badge "Admin Master", "Ilimitados" nos cards
de uso e o banner "Acesso Total - Admin Master". Na página de planos, os botões viram "Incluso no Admin Master".

## Edge Functions (Deno)

- `create-checkout-session`: exige JWT, confere que o `tenantId` pertence ao usuário, lê o `stripe_price_id` do
  catálogo (ignora preço vindo do cliente) e cria uma sessão `mode: subscription` com `metadata {tenant_id, plan_id}`
  na sessão e na assinatura.
- `stripe-webhook` (`verify_jwt = false`): valida a assinatura com `STRIPE_WEBHOOK_SECRET` sobre o corpo bruto.
  `checkout.session.completed` grava `tenants.plano`; assinatura cancelada, não paga ou deletada volta a `FREE`.
  Usa a service role e responde 500 em erro de banco para o Stripe reenviar.

## Segurança

- Segredos só em `supabase secrets`, nunca no repositório nem no chat. O `.env` fica fora do Git.
- RLS em todas as tabelas. Os limites de plano são validados no frontend; se existirem triggers ou RLS de limites
  no banco, devem consultar a flag de master para isenção.

## Convenções de código

Comentários curtos de uma linha, apenas quando o código não explica sozinho. Inserts em lotes para não sobrecarregar
o payload do Supabase. Consultas que podem passar de 1000 linhas usam paginação com `.range()`.
