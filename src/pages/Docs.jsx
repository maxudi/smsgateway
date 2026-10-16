import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Terminal, Code2, Copy, Check, Smartphone,
  Layers, HelpCircle, ArrowRight, Shield, Zap,
  CheckCircle2, RefreshCw, Cpu, ExternalLink, Globe, Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const ENDPOINT_URL = 'https://api.smsmax.netminas.com/functions/v1/send-sms';

const i18n = {
  en: {
    badge: 'Official API & Integration Guide',
    title: 'SMSMax Developer Documentation',
    subtitle: 'Connect your applications, webhooks, and automation pipelines to send real SMS text messages through your Android devices.',
    langSwitch: 'Language',
    tokensLink: 'Manage API Tokens',
    backToDashboard: 'Back to Dashboard',
    
    // Overview
    overviewTitle: 'How It Works',
    overviewDesc: 'SMSMax acts as a high-speed queue and middleware between your web systems and your physical Android smartphones. Dispatches use your own carrier SIM cards, avoiding costly third-party SMS aggregator fees.',
    highlights: [
      {
        title: 'Real SIM Routing',
        desc: 'Leverage Dual-SIM smartphones with full control over carrier slots (SIM 1 / SIM 2).',
      },
      {
        title: 'Instant REST API',
        desc: 'Simple JSON POST requests with standard Bearer token authentication.',
      },
      {
        title: 'Persistent Buffer',
        desc: 'Messages are securely queued and dispatched automatically even after temporary disconnects.',
      },
    ],

    // 4 Steps
    stepsTitle: 'Quick Setup in 4 Steps',
    stepsSubtitle: 'Get your gateway up and running in less than 5 minutes.',
    steps: [
      {
        step: '1',
        title: 'Create Account & Generate Token',
        desc: 'Log in to your SMSMax dashboard and navigate to the "API Tokens" section to generate your unique live access token.',
      },
      {
        step: '2',
        title: 'Install Android Gateway APK',
        desc: 'Download and install the official SMSMax APK on an Android smartphone equipped with active SIM cards. Grant SMS and phone permissions.',
      },
      {
        step: '3',
        title: 'Start Service & Optimize Battery',
        desc: 'Launch the app and tap "Start Service" until the indicator turns green (Connected). Disable Android battery optimization so the app runs uninterrupted.',
      },
      {
        step: '4',
        title: 'Send Your First SMS',
        desc: 'Trigger your first test SMS using the cURL command below or import the node directly into your automation platform (such as n8n).',
      },
    ],

    // API Reference
    apiTitle: 'REST API Reference',
    apiSubtitle: 'Standard HTTP POST endpoint for dispatching SMS messages.',
    endpointLabel: 'Live Endpoint URL',
    headersTitle: 'Required Headers',
    authHeaderDesc: 'Your Bearer token generated on the API Tokens page',
    contentTypeDesc: 'Standard JSON content type',
    bodyTitle: 'JSON Body Parameters',
    paramCol: 'Parameter',
    typeCol: 'Type',
    requiredCol: 'Required',
    descCol: 'Description',
    params: [
      {
        name: 'to',
        type: 'string',
        required: 'Required',
        desc: 'Destination phone number including country code and area code (e.g. "+5534988012700").',
      },
      {
        name: 'message',
        type: 'string',
        required: 'Required',
        desc: 'The text message content to be transmitted via SMS.',
      },
      {
        name: 'sim_slot',
        type: 'number',
        required: 'Optional',
        desc: 'SIM card slot index: 0 for SIM 1, 1 for SIM 2. Defaults to 0.',
      },
      {
        name: 'target_device_id',
        type: 'string',
        required: 'Optional',
        desc: 'Specific device ID displayed in the Android app, or "ALL" for any active connected device. Defaults to "ALL".',
      },
    ],
    curlTitle: 'cURL Request Example',
    curlCopy: 'Copy cURL',
    copiedNotice: 'Copied to clipboard!',
    responseTitle: 'Expected Response (HTTP 200 OK)',
    responseDesc: 'Immediate synchronous confirmation once the SMS is safely enqueued:',

    // n8n
    n8nTitle: 'n8n & Webhooks Integration',
    n8nSubtitle: 'Easily trigger SMS within your automated workflows.',
    n8nStep1: 'Add an "HTTP Request" node into your workflow.',
    n8nStep2: 'Set Method to POST and paste the URL:',
    n8nStep3: 'Enable "Send Headers" and add:',
    n8nStep4: 'Enable "Send Body" (JSON) and map dynamic values:',
    n8nCopyBtn: 'Copy Ready-to-Paste n8n Node (Ctrl+V)',
    n8nTip: 'Tip: Click the button above and press Ctrl+V directly on your n8n workflow canvas to import the configured node.',

    // FAQ
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: 'Common questions about gateway behavior, billing, and dual-SIM.',
    faqs: [
      {
        q: 'Does SMSMax charge per SMS sent?',
        a: 'No. SMSMax charges solely for the software platform and queue management. The actual SMS transmission uses the text allowances or prepaid balance of your mobile carrier SIM cards installed in your phone.',
      },
      {
        q: 'How does Dual-SIM routing work?',
        a: 'You can explicitly choose the sending SIM by providing "sim_slot": 0 (SIM 1) or "sim_slot": 1 (SIM 2) in your API request. If not specified, SIM 1 is used by default. Dashboard bulk campaigns also support automated round-robin rotation.',
      },
      {
        q: 'What happens if the phone loses internet or battery?',
        a: 'Your requests will never be lost. When your Android device is offline, messages sent via API are securely held in the queue. As soon as the smartphone reconnects, all pending messages are dispatched in order.',
      },
      {
        q: 'Can I connect multiple Android devices to one account?',
        a: 'Yes. Depending on your active subscription plan, you can connect multiple smartphones. The target_device_id parameter lets you target a specific phone or distribute messages across all online devices.',
      },
    ],
  },

  pt: {
    badge: 'API Oficial & Guia de Integração',
    title: 'Documentação do Desenvolvedor SMSMax',
    subtitle: 'Conecte suas aplicações, webhooks e esteiras de automação para disparar SMS reais através dos seus smartphones Android.',
    langSwitch: 'Idioma',
    tokensLink: 'Gerenciar Tokens de API',
    backToDashboard: 'Voltar ao Painel',

    // Overview
    overviewTitle: 'Como Funciona',
    overviewDesc: 'O SMSMax atua como uma fila inteligente e middleware de alta performance entre seus sistemas web e seus smartphones Android. Os disparos utilizam os próprios chips contratados por você, eliminando intermediários e custos adicionais por mensagem.',
    highlights: [
      {
        title: 'Roteamento por Chip Real',
        desc: 'Aproveite aparelhos Dual-SIM com controle total sobre as operadoras (SIM 1 / SIM 2).',
      },
      {
        title: 'API REST Instantânea',
        desc: 'Requisições JSON POST simples com autenticação padrão via Bearer token.',
      },
      {
        title: 'Fila Resiliente',
        desc: 'Mensagens permanecem protegidas na fila e são enviadas automaticamente após reconexão.',
      },
    ],

    // 4 Steps
    stepsTitle: 'Configuração Rápida em 4 Passos',
    stepsSubtitle: 'Coloque seu gateway em operação em menos de 5 minutos.',
    steps: [
      {
        step: '1',
        title: 'Criar Conta e Gerar Token',
        desc: 'Acesse seu painel SMSMax e entre na aba "Integrações / API" para gerar seu token seguro de acesso.',
      },
      {
        step: '2',
        title: 'Instalar APK no Celular Android',
        desc: 'Baixe e instale o APK oficial do SMSMax Gateway no smartphone com chip(s) ativos. Conceda as permissões de SMS e Telefone solicitadas.',
      },
      {
        step: '3',
        title: 'Iniciar Serviço e Ajustar Bateria',
        desc: 'Abra o app e toque em "Iniciar Serviço" até o indicador exibir "Conectado" em verde. Desative a otimização de bateria do Android para manter o app ativo.',
      },
      {
        step: '4',
        title: 'Realizar Primeiro Disparo de Teste',
        desc: 'Envie seu primeiro SMS de teste usando o comando cURL abaixo ou importe o nó configurado direto na sua ferramenta de automação (como n8n).',
      },
    ],

    // API Reference
    apiTitle: 'Referência Prática da API REST',
    apiSubtitle: 'Endpoint HTTP POST para envio direto de mensagens SMS.',
    endpointLabel: 'URL Oficial do Endpoint',
    headersTitle: 'Headers Requeridos',
    authHeaderDesc: 'Seu token Bearer gerado na tela de Tokens de API',
    contentTypeDesc: 'Definição padrão application/json',
    bodyTitle: 'Parâmetros do Corpo JSON',
    paramCol: 'Parâmetro',
    typeCol: 'Tipo',
    requiredCol: 'Obrigatório',
    descCol: 'Descrição',
    params: [
      {
        name: 'to',
        type: 'string',
        required: 'Obrigatório',
        desc: 'Número de telefone com código do país e DDD (ex: "+5534988012700").',
      },
      {
        name: 'message',
        type: 'string',
        required: 'Obrigatório',
        desc: 'Conteúdo textual da mensagem a ser disparada por SMS.',
      },
      {
        name: 'sim_slot',
        type: 'number',
        required: 'Opcional',
        desc: 'Chip de envio: 0 para o Chip 1, 1 para o Chip 2. Padrão: 0.',
      },
      {
        name: 'target_device_id',
        type: 'string',
        required: 'Opcional',
        desc: 'ID do celular exibido no app Android, ou "ALL" para qualquer aparelho ativo da conta. Padrão: "ALL".',
      },
    ],
    curlTitle: 'Exemplo de Requisição cURL',
    curlCopy: 'Copiar cURL',
    copiedNotice: 'Copiado para a área de transferência!',
    responseTitle: 'Exemplo de Retorno (HTTP 200 OK)',
    responseDesc: 'Confirmação síncrona imediata assim que a mensagem é acolhida na fila:',

    // n8n
    n8nTitle: 'Guia de Integração com n8n e Webhooks',
    n8nSubtitle: 'Como disparar SMS diretamente dentro dos seus fluxos de automação.',
    n8nStep1: 'Adicione um nó do tipo "HTTP Request" no seu fluxo.',
    n8nStep2: 'Defina o Method como POST e insira o URL:',
    n8nStep3: 'Ative "Send Headers" e preencha:',
    n8nStep4: 'Ative "Send Body" (JSON) e mapeie suas variáveis:',
    n8nCopyBtn: 'Copiar Nó Pronto para n8n (Ctrl+V)',
    n8nTip: 'Dica rápida: Clique no botão acima e pressione Ctrl+V direto na tela de edição do seu n8n para colar o nó já montado.',

    // FAQ
    faqTitle: 'Perguntas Frequentes (FAQ)',
    faqSubtitle: 'Tire suas dúvidas sobre funcionamento, custos e contingência.',
    faqs: [
      {
        q: 'O SMSMax cobra por mensagem enviada?',
        a: 'Não. O SMSMax cobra exclusivamente pela plataforma de software e gestão de filas. O custo dos disparos de SMS consome os pacotes ou créditos das operadoras contratadas por você e inseridas no smartphone.',
      },
      {
        q: 'Como funciona o envio Dual-SIM (Dois Chips)?',
        a: 'Você pode indicar explicitamente o chip desejado através do campo "sim_slot": 0 (Chip 1) ou "sim_slot": 1 (Chip 2) na chamada da API. Se omitido, o sistema utilizará o Chip 1. Em campanhas pelo painel, você também pode ativar alternância automática.',
      },
      {
        q: 'O que acontece se o celular ficar sem bateria ou sem internet?',
        a: 'Nenhum envio é perdido. Se o aparelho perder conexão, as mensagens enviadas pela API ficam guardadas na fila com status pendente. Assim que o smartphone reconectar à internet, ele descarrega e envia todas as mensagens pendentes.',
      },
      {
        q: 'Posso usar mais de um celular na mesma conta?',
        a: 'Sim. De acordo com o seu plano contratado, você pode vincular múltiplos smartphones. Você pode direcionar mensagens para um aparelho específico informando o seu ID ou usar "ALL" para distribuir.',
      },
    ],
  },
};

export default function Docs({ standalone = false }) {
  const { session } = useAuth();
  const { lang, setLang } = useLanguage();
  const [copiedKey, setCopiedKey] = useState(null);

  const t = i18n[lang] || i18n.en;

  const copyToClipboard = async (text, key) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const curlCode = `curl -X POST "${ENDPOINT_URL}" \\
  -H "Authorization: Bearer <SEU_API_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+5534988012700",
    "message": "${lang === 'en' ? 'Hello from SMSMax Gateway API!' : 'Ola! Teste de envio de SMS via API do Max Netminas.'}",
    "sim_slot": 0,
    "target_device_id": "ALL"
  }'`;

  const n8nNodeJson = JSON.stringify(
    {
      nodes: [
        {
          parameters: {
            method: 'POST',
            url: ENDPOINT_URL,
            sendHeaders: true,
            headerParameters: {
              parameters: [
                {
                  name: 'Authorization',
                  value: 'Bearer <SEU_API_TOKEN>',
                },
                {
                  name: 'Content-Type',
                  value: 'application/json',
                },
              ],
            },
            sendBody: true,
            contentType: 'raw',
            rawContentType: 'application/json',
            body: '={\n  "to": "{{ $json.phone }}",\n  "message": "{{ $json.message }}",\n  "sim_slot": 0,\n  "target_device_id": "ALL"\n}',
            options: {},
          },
          id: 'smsmax-send-sms-node',
          name: 'SMSMax - Send SMS',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4.2,
          position: [460, 300],
        },
      ],
      connections: {},
    },
    null,
    2
  );

  return (
    <div className={`space-y-10 max-w-5xl mx-auto pb-20 ${standalone ? 'p-6 sm:p-10' : ''}`}>
      {/* 1. Header com Alternador de Idioma */}
      <header className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shadow-lg shadow-accent/5">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white tracking-tight">SMSMax</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-accent/20 text-accent border border-accent/30 uppercase tracking-wider">
                  Docs
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.badge}</p>
            </div>
          </div>
        </div>

        {/* Controles do Cabeçalho */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Seletor de Idioma */}
          <div className="flex items-center bg-surface border border-white/10 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lang === 'en'
                  ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to English"
            >
              <span>🇺🇸</span>
              <span>EN</span>
            </button>
            <button
              type="button"
              onClick={() => setLang('pt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lang === 'pt'
                  ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Alternar para Português do Brasil"
            >
              <span>🇧🇷</span>
              <span>PT-BR</span>
            </button>
          </div>

          {session ? (
            <Link
              to="/api-tokens"
              className="btn-primary text-xs flex items-center gap-1.5 shadow-md shadow-accent/10"
            >
              <Code2 size={15} />
              <span>{t.tokensLink}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="btn-primary text-xs flex items-center gap-1.5 shadow-md shadow-accent/10"
            >
              <span>{lang === 'en' ? 'Sign In / Register' : 'Entrar / Cadastrar'}</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </header>

      {/* Hero da Documentação */}
      <section className="space-y-3">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {t.title}
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
          {t.subtitle}
        </p>
      </section>

      {/* 2. Visão Geral (How It Works) */}
      <section className="card space-y-5 border border-white/10 shadow-xl bg-gradient-to-b from-surface to-surface/80">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-accent" />
            {t.overviewTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {t.overviewDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {t.highlights.map((item, idx) => (
            <div key={idx} className="bg-bg/60 p-4 rounded-xl border border-white/5 space-y-1.5">
              <h3 className="font-semibold text-white text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                {item.title}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Passo a Passo de Configuração (4 Etapas) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone size={22} className="text-accent" />
            {t.stepsTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.stepsSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {t.steps.map((st) => (
            <div
              key={st.step}
              className="card relative flex flex-col justify-between p-5 border border-white/10 hover:border-accent/40 transition group space-y-3"
            >
              <div className="space-y-2">
                <div className="h-8 w-8 rounded-lg bg-accent/15 text-accent font-bold text-sm flex items-center justify-center group-hover:scale-105 transition">
                  {st.step}
                </div>
                <h3 className="font-bold text-white text-sm leading-snug">
                  {st.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {st.desc}
                </p>
                {st.step === '2' && (
                  <div className="pt-2">
                    <a
                      href="https://api.smsmax.netminas.com/storage/v1/object/public/app/app-release.apk"
                      target="_blank"
                      rel="noopener noreferrer"
                      download="smsmax-gateway.apk"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition shadow-sm"
                    >
                      <Download size={13} />
                      <span>{lang === 'en' ? 'Download APK (.apk)' : 'Baixar APK (.apk)'}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Referência Prática da API REST */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal size={22} className="text-accent" />
            {t.apiTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.apiSubtitle}</p>
        </div>

        {/* Endpoint Card */}
        <div className="card space-y-4 border border-white/10 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-accent/20 text-accent border border-accent/30">
                POST
              </span>
              <span className="font-mono text-sm text-white break-all">
                {ENDPOINT_URL}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(ENDPOINT_URL, 'endpoint')}
              className="btn-ghost text-xs self-start sm:self-auto flex items-center gap-1.5"
            >
              {copiedKey === 'endpoint' ? (
                <>
                  <Check size={14} className="text-emerald-400" /> {t.copiedNotice}
                </>
              ) : (
                <>
                  <Copy size={14} /> {lang === 'en' ? 'Copy URL' : 'Copiar URL'}
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="bg-bg/60 p-4 rounded-xl border border-white/5 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[11px]">
                {t.headersTitle}
              </span>
              <div className="font-mono space-y-1 text-slate-300">
                <div>
                  <span className="text-accent">Authorization:</span> Bearer &lt;YOUR_API_TOKEN&gt;
                </div>
                <div className="text-[11px] text-slate-500 pl-4">
                  ↳ {t.authHeaderDesc}
                </div>
                <div className="pt-1">
                  <span className="text-accent">Content-Type:</span> application/json
                </div>
                <div className="text-[11px] text-slate-500 pl-4">
                  ↳ {t.contentTypeDesc}
                </div>
              </div>
            </div>

            <div className="bg-bg/60 p-4 rounded-xl border border-white/5 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[11px]">
                Authentication Note
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'en'
                  ? 'All requests must include your secret API Token in the Authorization header. You can create and revoke tokens anytime in your dashboard.'
                  : 'Todas as requisições devem incluir seu Token de API secreto no cabeçalho Authorization. Você pode gerar e revogar tokens a qualquer momento no seu painel.'}
              </p>
              {session && (
                <Link
                  to="/api-tokens"
                  className="inline-flex items-center gap-1 text-accent text-xs hover:underline pt-1"
                >
                  <span>{t.tokensLink}</span>
                  <ArrowRight size={13} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Parâmetros JSON */}
        <div className="card p-0 overflow-hidden border border-white/10 shadow-lg">
          <div className="p-4 border-b border-white/5 bg-white/[0.01]">
            <h3 className="text-sm font-bold text-white">{t.bodyTitle}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-white/5 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">{t.paramCol}</th>
                  <th className="px-5 py-3.5">{t.typeCol}</th>
                  <th className="px-5 py-3.5">{t.requiredCol}</th>
                  <th className="px-5 py-3.5">{t.descCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {t.params.map((p) => (
                  <tr key={p.name} className="hover:bg-white/[0.01] transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-accent">
                      {p.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      {p.type}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.required === 'Required' || p.required === 'Obrigatório'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        {p.required}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 leading-relaxed">
                      {p.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Snippet cURL */}
        <div className="card space-y-3 border border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={16} className="text-accent" />
              {t.curlTitle}
            </h3>
            <button
              type="button"
              onClick={() => copyToClipboard(curlCode, 'curl')}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              {copiedKey === 'curl' ? (
                <>
                  <Check size={14} className="text-emerald-400" /> {t.copiedNotice}
                </>
              ) : (
                <>
                  <Copy size={14} /> {t.curlCopy}
                </>
              )}
            </button>
          </div>
          <div className="relative rounded-lg bg-bg p-4 font-mono text-xs text-slate-200 overflow-x-auto border border-white/5 leading-relaxed">
            <pre>{curlCode}</pre>
          </div>

          {/* Retorno 200 OK */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400 font-bold font-mono">HTTP 200 OK</span>
              <span className="text-slate-400 text-xs">{t.responseDesc}</span>
            </div>
            <div className="bg-bg/60 p-3.5 rounded-lg border border-white/5 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{`{
  "success": true,
  "messageId": "8c5ae29a-5e19-4790-a662-31e856c28627",
  "status": "enfileirado",
  "sim_slot": 0,
  "target_device_id": "ALL"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Guia de Integração com n8n e Webhooks */}
      <section className="card space-y-5 border border-white/10 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center font-bold text-sm">
              n8n
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t.n8nTitle}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.n8nSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(n8nNodeJson, 'n8n')}
            className="btn-primary text-xs flex items-center gap-2 self-start sm:self-auto shadow-md shadow-accent/10"
          >
            {copiedKey === 'n8n' ? (
              <>
                <Check size={14} className="text-emerald-300" /> {t.copiedNotice}
              </>
            ) : (
              <>
                <Layers size={14} /> {t.n8nCopyBtn}
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3 bg-bg/50 p-4 rounded-xl border border-white/5">
            <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
              <span className="h-5 w-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs">1</span>
              {lang === 'en' ? 'Step-by-step Setup' : 'Configuração do Nó'}
            </h4>
            <ul className="space-y-2 text-slate-300 leading-relaxed list-disc list-inside">
              <li>{t.n8nStep1}</li>
              <li>
                {t.n8nStep2}
                <br />
                <code className="text-slate-300 bg-black/40 px-1.5 py-0.5 rounded break-all select-all font-mono text-[11px]">
                  {ENDPOINT_URL}
                </code>
              </li>
              <li>
                {t.n8nStep3}
                <div className="mt-1 ml-4 font-mono text-[11px] bg-black/30 p-2 rounded border border-white/5 space-y-0.5">
                  <div>• Authorization: <span className="text-accent">Bearer &lt;TOKEN&gt;</span></div>
                  <div>• Content-Type: <span className="text-accent">application/json</span></div>
                </div>
              </li>
            </ul>
          </div>

          <div className="space-y-3 bg-bg/50 p-4 rounded-xl border border-white/5">
            <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
              <span className="h-5 w-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs">2</span>
              {lang === 'en' ? 'JSON Body Payload' : 'Mapeamento do Corpo (Body)'}
            </h4>
            <p className="text-slate-300">{t.n8nStep4}</p>
            <div className="font-mono text-[11px] bg-black/30 p-3 rounded border border-white/5 text-slate-200">
              <pre>{`{
  "to": "={{ $json.phone }}",
  "message": "={{ $json.message }}",
  "sim_slot": 0,
  "target_device_id": "ALL"
}`}</pre>
            </div>
            <p className="text-accent text-[11px] leading-relaxed">
              {t.n8nTip}
            </p>
          </div>
        </div>
      </section>

      {/* 6. Perguntas Frequentes (FAQ) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle size={22} className="text-accent" />
            {t.faqTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.faqSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {t.faqs.map((f, i) => (
            <div
              key={i}
              className="card p-5 border border-white/10 hover:border-white/20 transition space-y-2"
            >
              <h3 className="font-bold text-white text-sm flex items-start gap-2">
                <span className="text-accent font-mono text-xs mt-0.5">Q:</span>
                <span>{f.q}</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed pl-5">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Rodapé da Documentação */}
      <footer className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>SMSMax Platform © {new Date().getFullYear()}</span>
          <span>•</span>
          <span className="text-slate-400">api.smsmax.netminas.com</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/api-tokens" className="hover:text-accent transition">
            {lang === 'en' ? 'API Tokens' : 'Tokens de API'}
          </Link>
          <span>•</span>
          <Link to="/dispositivos" className="hover:text-accent transition">
            {lang === 'en' ? 'Devices' : 'Dispositivos'}
          </Link>
        </div>
      </footer>
    </div>
  );
}
