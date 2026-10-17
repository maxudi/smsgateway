import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone, Cpu, ShieldCheck, Webhook, Layers, ArrowRight, Download,
  BookOpen, Terminal, Check, X, Sparkles, Info, Copy, Radio, Server,
  Users, CalendarClock, Lock, UserPlus, LogIn, Globe, RefreshCw, CheckCircle2,
  MessageSquare, Workflow, BellRing, Gauge
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import LegalTermsModal from '../components/LegalTermsModal.jsx';

const ENDPOINT_URL = 'https://api.smsmax.netminas.com/functions/v1/send-sms';
const APK_URL = 'https://api.smsmax.netminas.com/storage/v1/object/public/app/app-release.apk';

const FALLBACK_PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price_brl: 0,
    price_usd: 0,
    max_devices: 1,
    max_sim_slots: 1,
    max_monthly_sms: 300,
    max_contacts: 100,
    allow_scheduling: false,
  },
  {
    id: 'STARTER',
    name: 'Starter',
    price_brl: 49.9,
    price_usd: 9.9,
    max_devices: 2,
    max_sim_slots: 2,
    max_monthly_sms: 3000,
    max_contacts: 2000,
    allow_scheduling: true,
  },
  {
    id: 'PRO',
    name: 'Professional',
    price_brl: 99.9,
    price_usd: 19.9,
    max_devices: 5,
    max_sim_slots: 2,
    max_monthly_sms: 15000,
    max_contacts: 10000,
    allow_scheduling: true,
  },
  {
    id: 'PLUS',
    name: 'Enterprise',
    price_brl: 199.9,
    price_usd: 39.9,
    max_devices: 10,
    max_sim_slots: 2,
    max_monthly_sms: 50000,
    max_contacts: 50000,
    allow_scheduling: true,
  },
];

const COPY = {
  en: {
    navTag: 'SMS Gateway & IoT',
    navSolutions: 'Automation & IoT',
    navHowItWorks: 'How It Works',
    navApi: 'API & n8n',
    navPlans: 'Pricing',
    navDocs: 'Docs',
    openDashboard: 'Open Dashboard',
    signIn: 'Sign In',
    signUpFree: 'Create Free Account',

    heroBadge: 'Self-Hosted GSM Messaging Infrastructure · IoT · Webhooks · REST API',
    heroTitle1: 'Turn your Android smartphones into an',
    heroTitleHighlight: 'Automation, IoT & Messaging Gateway',
    heroDesc:
      'Connect your applications, n8n workflows, ERPs, and IoT hardware directly to the cellular network using your own Android phones and SIM cards. Dispatch M2M commands, transactional alerts, or scheduled group notifications with Dual-SIM load balancing, smart cadence, and real-time Webhooks.',
    pill1Title: 'IoT & M2M Telemetry:',
    pill1Desc: 'SMS commands for GPS trackers, PLCs & remote sensors',
    pill2Title: 'Full Automation:',
    pill2Desc: 'REST API ready for n8n, Make, Zapier & Webhooks',
    pill3Title: 'Groups & Segments:',
    pill3Desc: 'Scheduled dispatches with {nome} variables & pacing',
    pill4Title: 'Dual-SIM Engineering:',
    pill4Desc: 'Automatic round-robin across SIM slots & devices',
    ctaPrimary: 'Start on the Free Plan',
    ctaDashboard: 'Go to Dashboard',
    ctaApk: 'Download Android APK',
    ctaDocs: 'API & Developer Guide',
    trust1: 'Free forever tier (300 dispatches/mo)',
    trust2: 'Zero per-SMS platform fees (uses your SIM plan)',
    trust3: 'Two-way inbound SMS via Webhooks',

    authCardSubtitleLogged: 'Your session is active',
    authCardSubtitleGuest: 'Sign in to your account or start free in seconds',
    authLoggedBox: 'You are already signed in! Open the control panel to manage your devices, queues, and API tokens.',
    authLoggedBtn: 'Open Control Panel',
    tabLogin: 'Sign In',
    tabSignup: 'New Account',
    nameLabel: 'Your Name or Company',
    namePlaceholder: 'e.g. Acme IoT / John Doe',
    emailLabel: 'Email Address',
    emailPlaceholder: 'you@company.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    termsPrefix: 'I have read and agree to the',
    termsLink1: 'Terms of Use',
    termsAnd: 'and the',
    termsLink2: 'Acceptable Use (Anti-Spam) Policy',
    termsError: 'You must read and accept the Terms of Use and Anti-Spam Policy to create an account.',
    signupSuccess: 'Account created! Please check your email or sign in below to access the dashboard.',
    submitBusy: 'Processing...',
    submitLogin: 'Sign In to Dashboard',
    submitSignup: 'Create Free Account (300 SMS/mo)',
    encryptedBadge: 'Encrypted environment',

    solBadge: 'Communication & Automation Engineering',
    solTitle: 'Far beyond simple texting: a complete dispatch & telemetry hub',
    solSubtitle:
      'Built for developers, automation engineers, ISPs, and businesses that require direct, auditable cellular communication without per-message middlemen.',
    solCards: [
      {
        title: '📡 IoT, GPS Trackers & M2M Telemetry',
        desc: 'Send configuration, reboot, or immobilizer commands to vehicle GPS trackers, Arduino/ESP32 GSM modules, agricultural pumps, and alarm panels. When the hardware replies via SMS, our Webhook delivers structured JSON to your server.',
      },
      {
        title: '🤖 n8n, Make, ERPs & CRM Workflows',
        desc: 'Connect any automation pipeline via HTTP POST in under 2 minutes. Ideal for appointment reminders, invoice/payment alerts, logistics updates, 2FA/OTP verification codes, and server monitoring alerts (Zabbix/Grafana).',
      },
      {
        title: '👥 Contact Groups & Scheduled Broadcasts',
        desc: 'Import your address book via CSV, segment contacts by interest groups or tags, and schedule personalized communications with {nome} variables across hundreds or thousands of recipients with a resilient queue.',
      },
      {
        title: '🔄 Dual-SIM & Multi-Device Rotation',
        desc: 'On paid plans, automatically distribute outbound traffic in Round-Robin mode across SIM 1 & SIM 2 and across multiple Android smartphones linked to your account, multiplying throughput safely.',
      },
      {
        title: '⏱️ Smart Cadence & Delivery Windows',
        desc: 'Configure randomized intervals (min/max seconds) between dispatches, daily caps, allowed weekdays, and business-hour windows. Out-of-window items automatically wait for the next valid window.',
      },
      {
        title: '🛡️ Two-Way Webhooks & Auto Opt-Out',
        desc: 'Monitor incoming SMS in real time and forward payloads to your endpoint with Bearer Token authentication. Replies like STOP or SAIR automatically flag the contact as Opted-Out, protecting your SIM reputation.',
      },
    ],

    howBadge: '5-Minute Deployment',
    howTitle: 'Step-by-Step: From your Android Phone to your Automation',
    howSubtitle: 'See exactly what happens on your Android smartphone and what you configure on the web dashboard.',
    howApkBtn: 'Download Official Android App (.apk)',
    steps: [
      {
        step: '1',
        where: 'phone',
        whereLabel: 'On Android Phone',
        title: 'Download APK & Generate Device ID',
        desc: 'Install the official Max Netminas Gateway APK on an Android phone with an active SIM card. Open the app, grant SMS/Phone permissions, and copy the Device ID shown on screen.',
        hasApk: true,
      },
      {
        step: '2',
        where: 'web',
        whereLabel: 'On Web Dashboard',
        title: 'Create Account, Link Device & Token',
        desc: 'Create your free account on this page, register your phone using the Device ID under "Devices", and generate your secret token under "API Tokens".',
      },
      {
        step: '3',
        where: 'phone',
        whereLabel: 'On Android Phone',
        title: 'Start Service & Battery Settings',
        desc: 'Return to the Android app and tap "Start Service" until the status turns green (Connected). Disable Android battery optimization for 24/7 operation.',
      },
      {
        step: '4',
        where: 'web',
        whereLabel: 'Platform & Automation',
        title: 'First Test & Automation Ready',
        desc: 'Send your first test message directly from the platform ("Send SMS" tab) and you are immediately ready to trigger dispatches via n8n, Make, or HTTP API as shown below.',
      },
    ],

    apiBadge: 'Developer & No-Code Ready',
    apiTitle: 'Instant Integration via HTTP REST or n8n',
    apiSubtitle:
      'Trigger messages from any programming language, monitoring script, or paste our pre-configured node directly onto your n8n canvas.',
    apiDocsBtn: 'Open Full Documentation',
    copyCurl: 'Copy cURL',
    copied: 'Copied!',
    n8nBadge: '1-Click n8n Integration (Ctrl+V)',
    n8nTitle: 'Import the pre-configured node straight into your n8n workflow',
    n8nDesc:
      'No need to manually configure headers or JSON bodies: click the button below to copy the official node and press Ctrl + V directly inside your n8n workflow canvas.',
    n8nBullet1: 'Supports dynamic expressions {{ $json.phone }}',
    n8nBullet2: 'Choose SIM slot (sim_slot: 0) or specific target device',
    n8nBullet3: 'Included even on the Free Plan (SIM 1)',
    n8nBtn: 'Copy Ready-to-Paste n8n Node (Ctrl+V)',
    n8nBtnCopied: 'n8n Node Copied! Press Ctrl+V in n8n',

    plansBadge: 'Scalable Plans',
    plansTitle: 'Start free and scale as your operation grows',
    plansSubtitle:
      'The Free plan already includes 1 Android device, SIM 1 monitoring, 1 Webhook, and HTTP API access. Need Dual-SIM rotation, campaign scheduling, and multiple devices? Pick the plan that fits your volume.',
    popularBadge: 'Most Popular',
    planNames: { FREE: 'Free', STARTER: 'Starter', PRO: 'Professional', PLUS: 'Enterprise' },
    planDescs: {
      FREE: 'Ideal for bench testing, IoT PoCs, and lightweight automation flows.',
      STARTER: 'Perfect for commercial operations, clinics, alerts, and Dual-SIM rotation.',
      PRO: 'High capacity for multiple Android nodes, ERPs, ISPs, and intensive workflows.',
      PLUS: 'Full-scale infrastructure for high-volume dispatch, telemetry, and multi-gateway clusters.',
    },
    freeLabel: 'Free',
    perMonth: '/mo',
    seeNote: '* see note',
    quotaSub: 'Gateway queue quota (via your SIM)',
    planBtnFree: 'Create Free Account',
    planBtnPaid: 'Get Started Now',

    noteTitle: '* How monthly dispatches and your SIM card work',
    note1Strong: '1. About the monthly dispatch quota:',
    note1Body:
      'Max Netminas operates strictly as an automation and queue management gateway and does not sell carrier SMS packages. Each plan’s monthly limit refers to the platform processing capacity. Because messages are transmitted directly through your own connected Android phones and SIM cards, final delivery depends on an active plan or prepaid balance with your mobile carrier.',
    note2Strong: '2. Best practices & carrier policies:',
    note2Body:
      'Message content, recipient consent (opt-in), and sending frequency are defined exclusively by the user. We recommend responsible use (avoiding unsolicited bulk spam), as mobile carriers monitor network traffic and may apply rate limits or SIM blocks outside the platform’s control or liability, as detailed in our',
    noteTermsLink: 'Terms of Use',

    footerTag: '· SMS Automation & IoT Gateway',
    footerDocs: 'API Documentation',
    footerApk: 'Download Android APK',
    footerTerms: 'Terms of Use & Anti-Spam Policy',
    footerLogin: 'Sign In',
  },

  pt: {
    navTag: 'SMS Gateway & IoT',
    navSolutions: 'Automação & IoT',
    navHowItWorks: 'Como Funciona',
    navApi: 'API & n8n',
    navPlans: 'Planos',
    navDocs: 'Documentação',
    openDashboard: 'Acessar Meu Painel',
    signIn: 'Entrar',
    signUpFree: 'Criar Conta Grátis',

    heroBadge: 'Infraestrutura Própria de Comunicação GSM · IoT · Webhooks · API HTTP',
    heroTitle1: 'Transforme seus celulares Android em um',
    heroTitleHighlight: 'Gateway de Automação, IoT e Mensageria',
    heroDesc:
      'Conecte seus sistemas, fluxos n8n, ERPs e dispositivos IoT diretamente à rede celular usando os seus próprios aparelhos e chips. Envie comandos M2M, alertas transacionais ou programe comunicados segmentados para grupos inteiros de contatos com rotação Dual-SIM, controle de cadência e Webhooks em tempo real.',
    pill1Title: 'Telemetria & IoT:',
    pill1Desc: 'Comandos SMS p/ rastreadores, CLPs e sensores',
    pill2Title: 'Automação Total:',
    pill2Desc: 'API REST pronta para n8n, Make, Zapier e Webhooks',
    pill3Title: 'Grupos & Carteiras:',
    pill3Desc: 'Envios programados com variáveis {nome} e cadência',
    pill4Title: 'Engenharia Dual-SIM:',
    pill4Desc: 'Balanceamento automático entre chips e aparelhos',
    ctaPrimary: 'Começar no Plano Grátis',
    ctaDashboard: 'Ir para o Dashboard',
    ctaApk: 'Baixar APK Android',
    ctaDocs: 'Guia & API Docs',
    trust1: 'Plano Grátis vitalício (300 envios/mês)',
    trust2: 'Zero custo por SMS na plataforma (usa seu chip)',
    trust3: 'Recebimento bidirecional (Webhook)',

    authCardSubtitleLogged: 'Sua sessão está ativa',
    authCardSubtitleGuest: 'Acesse sua conta ou comece grátis em segundos',
    authLoggedBox: 'Você já está conectado! Acesse o painel para gerenciar seus aparelhos, filas e integrações.',
    authLoggedBtn: 'Abrir Painel de Controle',
    tabLogin: 'Entrar',
    tabSignup: 'Novo Usuário',
    nameLabel: 'Seu nome ou empresa',
    namePlaceholder: 'Ex.: Max Telecom / João Silva',
    emailLabel: 'E-mail de acesso',
    emailPlaceholder: 'seu@email.com',
    passwordLabel: 'Senha',
    passwordPlaceholder: 'Mínimo de 6 caracteres',
    termsPrefix: 'Li e concordo com os',
    termsLink1: 'Termos de Uso',
    termsAnd: 'e a',
    termsLink2: 'Política de Uso Consciente (Anti-Spam)',
    termsError: 'Você precisa ler e aceitar os Termos de Uso e a Política Anti-Spam para criar sua conta.',
    signupSuccess: 'Conta criada com sucesso! Verifique seu e-mail ou faça login abaixo para acessar o painel.',
    submitBusy: 'Processando...',
    submitLogin: 'Acessar Painel',
    submitSignup: 'Criar Conta Gratuita (300 SMS/mês)',
    encryptedBadge: 'Ambiente criptografado',

    solBadge: 'Engenharia de Comunicação & Automação',
    solTitle: 'Muito além de um simples envio: uma central completa de despacho e telemetria',
    solSubtitle:
      'Projetado para desenvolvedores, integradores de automação, provedores e empresas que precisam de comunicação direta, auditável e independente de intermediários.',
    solCards: [
      {
        title: '📡 IoT, Rastreadores & Telemetria M2M',
        desc: 'Envie comandos de configuração, reboot ou bloqueio para rastreadores veiculares, módulos GSM/Arduino, bombas agrícolas e centrais de alarme. Quando o equipamento responder por SMS, nosso Webhook entrega o dado estruturado em JSON para o seu servidor na hora.',
      },
      {
        title: '🤖 Fluxos n8n, Make, ERPs & CRMs',
        desc: 'Integre qualquer esteira de automação via HTTP POST em menos de 2 minutos. Ideal para lembretes de agendamento, avisos de faturas/PIX, atualizações logísticas, códigos de verificação (2FA/OTP) e alertas internos de sistemas.',
      },
      {
        title: '👥 Gestão de Grupos & Comunicados em Lote',
        desc: 'Importe sua carteira via CSV, organize contatos por grupos de interesse ou perfil e programe comunicados personalizados com {nome} para centenas ou milhares de destinatários de uma só vez, com fila persistente que nunca perde envios.',
      },
      {
        title: '🔄 Rotação Dual-SIM & Multi-Aparelhos',
        desc: 'Nos planos pagos, distribua automaticamente a carga de envios em modo Round-Robin entre o SIM 1 e SIM 2 e entre múltiplos celulares Android conectados à sua conta, multiplicando sua vazão diária com segurança.',
      },
      {
        title: '⏱️ Cadência Inteligente & Janela Horária',
        desc: 'Defina intervalos aleatórios (mínimo e máximo em segundos) entre cada envio, limite diário, dias da semana permitidos e janela de horário comercial. O sistema pausa e retoma a fila automaticamente no próximo horário válido.',
      },
      {
        title: '🛡️ Webhooks Bidirecionais & Opt-Out',
        desc: 'Monitore o recebimento de SMS em tempo real e encaminhe para a sua URL com assinatura Bearer Token. Além disso, respostas como SAIR ou PARAR marcam o contato em Opt-Out automaticamente, protegendo a reputação do seu chip.',
      },
    ],

    howBadge: 'Implantação em 5 Minutos',
    howTitle: 'Passo a Passo: Do Celular para a sua Automação',
    howSubtitle: 'Veja exatamente o que você faz no smartphone Android e o que você configura no painel web.',
    howApkBtn: 'Baixar Aplicativo Oficial (.apk)',
    steps: [
      {
        step: '1',
        where: 'phone',
        whereLabel: 'No Celular',
        title: 'Baixar APK e Gerar Device ID',
        desc: 'Instale o APK oficial do Max Netminas Gateway no celular Android com chip ativo. Abra o app, conceda as permissões de SMS/Telefone e copie o código Device ID exibido na tela.',
        hasApk: true,
      },
      {
        step: '2',
        where: 'web',
        whereLabel: 'No Painel Web',
        title: 'Criar Conta, Vincular Aparelho e Token',
        desc: 'Crie sua conta grátis nesta página, cadastre o código Device ID na aba "Dispositivos" e gere seu token seguro na aba "Tokens de API".',
      },
      {
        step: '3',
        where: 'phone',
        whereLabel: 'No Celular',
        title: 'Iniciar Serviço e Ajustar Bateria',
        desc: 'Volte ao aplicativo Android e toque em "Iniciar Serviço" até o status ficar verde (Conectado). Desative a restrição de bateria para operação contínua 24/7.',
      },
      {
        step: '4',
        where: 'web',
        whereLabel: 'Plataforma & Automação',
        title: 'Primeiro Teste e Automação',
        desc: 'Envie seu primeiro disparo de teste direto pela plataforma (aba "Disparar") e você já estará apto também a disparar via n8n, Make ou API HTTP conforme os exemplos abaixo.',
      },
    ],

    apiBadge: 'Pronto para Desenvolvedores & No-Code',
    apiTitle: 'Integração Instantânea via HTTP REST ou n8n',
    apiSubtitle:
      'Dispare mensagens a partir de qualquer linguagem de programação, script de monitoramento ou cole o nó pronto direto no seu canvas do n8n.',
    apiDocsBtn: 'Abrir Documentação Completa',
    copyCurl: 'Copiar cURL',
    copied: 'Copiado!',
    n8nBadge: 'Integração n8n em 1 Clique (Ctrl+V)',
    n8nTitle: 'Importe o nó configurado direto no seu fluxo do n8n',
    n8nDesc:
      'Não precisa configurar cabeçalhos ou JSON manualmente: clique no botão abaixo para copiar o componente oficial e aperte Ctrl + V dentro do seu workflow no n8n.',
    n8nBullet1: 'Compatível com variáveis dinâmicas {{ $json.phone }}',
    n8nBullet2: 'Seleção de chip (sim_slot: 0) ou aparelho específico',
    n8nBullet3: 'Disponível inclusive no Plano Gratuito (SIM 1)',
    n8nBtn: 'Copiar Nó Pronto para n8n (Ctrl+V)',
    n8nBtnCopied: 'Nó n8n Copiado! Pressione Ctrl+V no n8n',

    plansBadge: 'Planos Escaláveis',
    plansTitle: 'Comece grátis e escale conforme a sua operação cresce',
    plansSubtitle:
      'No plano Gratuito você já conta com 1 aparelho, monitoramento do SIM 1, 1 Webhook e acesso à API HTTP. Precisa de rotação Dual-SIM, agendamento e múltiplos aparelhos? Escolha o plano ideal abaixo.',
    popularBadge: 'Mais Escolhido',
    planNames: { FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Profissional', PLUS: 'Empresarial' },
    planDescs: {
      FREE: 'Ideal para testes de bancada, PoC de IoT e pequenos fluxos de automação.',
      STARTER: 'Perfeito para operações comerciais, clínicas, alertas e rotação Dual-SIM.',
      PRO: 'Alta capacidade para múltiplos nós Android, ERPs, provedores e operações intensivas.',
      PLUS: 'Infraestrutura completa para grandes volumes de despacho, telemetria e múltiplos gateways.',
    },
    freeLabel: 'Grátis',
    perMonth: '/mês',
    seeNote: '* ver nota',
    quotaSub: 'Cota de fila do gateway (via seu chip)',
    planBtnFree: 'Criar Conta Grátis',
    planBtnPaid: 'Começar Agora',

    noteTitle: '* Como funcionam os disparos mensais e o uso do seu chip',
    note1Strong: '1. Sobre a franquia de disparos:',
    note1Body:
      'O Max Netminas atua como um gateway de automação e gerenciamento de filas e não comercializa pacotes de SMS. O limite mensal de cada plano refere-se à capacidade de processamento na plataforma. Como os envios são transmitidos diretamente pelos seus próprios aparelhos e chips conectados, a entrega efetiva depende de um plano ou saldo válido junto à sua operadora de telefonia móvel.',
    note2Strong: '2. Boas práticas e políticas das operadoras:',
    note2Body:
      'O conteúdo das mensagens, a autorização de recebimento dos destinatários (opt-in) e a frequência de disparos são definidos exclusivamente pelo usuário. Recomendamos o uso consciente da ferramenta (evitando práticas de spam), pois as operadoras monitoram o tráfego da rede e podem aplicar bloqueios ou restrições ao chip sem ingerência ou responsabilidade da plataforma, conforme detalhado em nossos',
    noteTermsLink: 'Termos de Uso',

    footerTag: '· Gateway de Automação SMS & IoT',
    footerDocs: 'Documentação da API',
    footerApk: 'Baixar APK Android',
    footerTerms: 'Termos de Uso & Política Anti-Spam',
    footerLogin: 'Entrar no Sistema',
  },
};

export default function LandingPage() {
  const { session } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();

  const c = COPY[lang] || COPY.en;
  const isEn = lang !== 'pt';

  const formatNum = (n) => Number(n ?? 0).toLocaleString(isEn ? 'en-US' : 'pt-BR');
  const formatUsd = (p) => {
    const usd = Number(p.price_usd ?? 0) || Number((Number(p.price_brl ?? 0) / 5).toFixed(2));
    return `US$ ${usd.toFixed(2)}`;
  };
  const formatBrl = (p) =>
    Number(p.price_brl ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Estado do formulário de Login / Cadastro rápido no Hero
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalTab, setTermsModalTab] = useState('terms');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .order('price_brl', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setPlans(data);
      });
  }, []);

  const scrollToAuth = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthNotice('');
    const el = document.getElementById('acesso-conta');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) setAuthError(error.message);
        else navigate('/dashboard', { replace: true });
        return;
      }

      if (!acceptedTerms) {
        setAuthError(c.termsError);
        return;
      }

      const termsAcceptedAt = new Date().toISOString();
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            accepted_terms: true,
            accepted_terms_at: termsAcceptedAt,
          },
        },
      });

      if (error) {
        setAuthError(error.message);
      } else if (data?.session) {
        navigate('/dashboard', { replace: true });
      } else {
        setAuthNotice(c.signupSuccess);
        setAuthMode('login');
        setForm((f) => ({ ...f, password: '' }));
      }
    } catch (err) {
      setAuthError(err?.message ?? 'Error');
    } finally {
      setAuthBusy(false);
    }
  };

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // ignore
    }
  };

  const sampleCurl = `curl -X POST "${ENDPOINT_URL}" \\
  -H "Authorization: Bearer <YOUR_API_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+5534999990000",
    "message": "${isEn ? '[iot-telemetry] Command RESET_NODE confirmed. Status: ONLINE' : '[telemetria-iot] Comando RESET_NODE confirmado. Status: ONLINE'}",
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
                { name: 'Authorization', value: 'Bearer <YOUR_API_TOKEN>' },
                { name: 'Content-Type', value: 'application/json' },
              ],
            },
            sendBody: true,
            contentType: 'raw',
            rawContentType: 'application/json',
            body: '={\n  "to": "{{ $json.phone }}",\n  "message": "{{ $json.message }}",\n  "sim_slot": 0,\n  "target_device_id": "ALL"\n}',
            options: {},
          },
          id: 'smsmax-send-sms-node',
          name: 'Max Netminas - Send SMS',
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

  const planHighlights = (p) => {
    const devs = Number(p.max_devices ?? 1);
    const slots = Number(p.max_sim_slots ?? (p.id === 'FREE' ? 1 : 2));
    if (isEn) {
      return [
        { icon: Smartphone, text: `${formatNum(devs)} connected device${devs === 1 ? '' : 's'}`, ok: true },
        { icon: Layers, text: slots === 1 ? '1 SIM slot monitoring (SIM 1)' : `Dual-SIM monitoring (${slots} SIMs/phone)`, ok: true },
        { icon: RefreshCw, text: 'Multi-SIM Round-Robin rotation', ok: slots > 1 },
        { icon: MessageSquare, text: `${formatNum(p.max_monthly_sms)} dispatches / month`, note: true, ok: true },
        { icon: Webhook, text: devs === 1 ? '1 Webhook + HTTP REST API' : `Up to ${formatNum(devs)} Webhooks + HTTP REST API`, ok: true },
        { icon: CalendarClock, text: 'Campaign scheduling & time windows', ok: !!p.allow_scheduling },
        { icon: Users, text: `Address book up to ${formatNum(p.max_contacts)} contacts`, ok: true },
      ];
    }
    return [
      { icon: Smartphone, text: `${formatNum(devs)} aparelho${devs === 1 ? '' : 's'} conectado${devs === 1 ? '' : 's'}`, ok: true },
      { icon: Layers, text: slots === 1 ? 'Monitoramento de 1 chip (SIM 1)' : `Monitoramento Dual-SIM (${slots} chips/aparelho)`, ok: true },
      { icon: RefreshCw, text: 'Rotação inteligente multi-chip (Dual-SIM)', ok: slots > 1 },
      { icon: MessageSquare, text: `${formatNum(p.max_monthly_sms)} disparos por mês`, note: true, ok: true },
      { icon: Webhook, text: devs === 1 ? '1 Webhook + Envio via API HTTP' : `Até ${formatNum(devs)} Webhooks + Envio via API HTTP`, ok: true },
      { icon: CalendarClock, text: 'Agendamento e janelas de disparo', ok: !!p.allow_scheduling },
      { icon: Users, text: `Agenda para até ${formatNum(p.max_contacts)} contatos`, ok: true },
    ];
  };

  const solIcons = [Cpu, Workflow, Users, Layers, Gauge, BellRing];

  return (
    <div className="min-h-screen bg-bg text-slate-200 selection:bg-accent/30 selection:text-white">
      {/* 1. STICKY TOP NAVBAR (Global Language Switcher + Standard Auth CTAs) */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-icon.png" alt="Max Netminas" className="h-9 w-9 object-contain" />
            <div className="leading-tight">
              <span className="text-lg font-extrabold tracking-tight text-white">
                Max <span className="text-accent">Netminas</span>
              </span>
              <span className="hidden xl:inline-block ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent border border-accent/25">
                {c.navTag}
              </span>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#solutions" className="hover:text-accent transition">{c.navSolutions}</a>
            <a href="#how-it-works" className="hover:text-accent transition">{c.navHowItWorks}</a>
            <a href="#api-n8n" className="hover:text-accent transition">{c.navApi}</a>
            <a href="#pricing" className="hover:text-accent transition">{c.navPlans}</a>
            <Link to="/docs" className="hover:text-accent transition flex items-center gap-1">
              <BookOpen size={13} className="text-accent" /> {c.navDocs}
            </Link>
          </nav>

          {/* Right side: EN / PT-BR Switcher + Sign In / Create Account */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center bg-surface border border-white/10 rounded-xl p-0.5 shadow-inner">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  isEn
                    ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Switch to English"
              >
                <span>🇺🇸</span>
                <span className="font-mono text-[11px]">EN</span>
              </button>
              <button
                type="button"
                onClick={() => setLang('pt')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  !isEn
                    ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mudar para Português (Brasil)"
              >
                <span>🇧🇷</span>
                <span className="font-mono text-[11px]">PT-BR</span>
              </button>
            </div>

            {session ? (
              <Link to="/dashboard" className="btn-primary text-xs px-3.5 py-2 shadow-lg shadow-accent/15">
                {c.openDashboard} <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => scrollToAuth('login')}
                  className="btn-ghost text-xs px-3 py-2 border border-white/10"
                >
                  <LogIn size={14} className="text-accent" /> <span className="hidden sm:inline">{c.signIn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToAuth('signup')}
                  className="btn-primary text-xs px-3.5 py-2 shadow-lg shadow-accent/15"
                >
                  <UserPlus size={14} /> <span className="hidden sm:inline">{c.signUpFree}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION + INTEGRATED SIGN IN / SIGN UP CARD */}
      <section id="top" className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 border-b border-white/5">
        <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left Column: Value Proposition */}
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent">
                <Radio size={14} className="animate-pulse" />
                <span>{c.heroBadge}</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.12]">
                {c.heroTitle1}{' '}
                <span className="bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent">
                  {c.heroTitleHighlight}
                </span>
              </h1>

              <p className="max-w-2xl text-base text-slate-300 leading-relaxed">
                {c.heroDesc}
              </p>

              {/* Feature Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-slate-300">
                <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-surface/70 px-3.5 py-2.5">
                  <Cpu size={17} className="text-accent shrink-0" />
                  <span><strong>{c.pill1Title}</strong> {c.pill1Desc}</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-surface/70 px-3.5 py-2.5">
                  <Workflow size={17} className="text-emerald-400 shrink-0" />
                  <span><strong>{c.pill2Title}</strong> {c.pill2Desc}</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-surface/70 px-3.5 py-2.5">
                  <Users size={17} className="text-accent shrink-0" />
                  <span><strong>{c.pill3Title}</strong> {c.pill3Desc}</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-surface/70 px-3.5 py-2.5">
                  <Layers size={17} className="text-emerald-400 shrink-0" />
                  <span><strong>{c.pill4Title}</strong> {c.pill4Desc}</span>
                </div>
              </div>

              {/* Hero CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {session ? (
                  <Link to="/dashboard" className="btn-primary px-6 py-3 text-sm shadow-xl shadow-accent/20">
                    {c.ctaDashboard} <ArrowRight size={16} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => scrollToAuth('signup')}
                    className="btn-primary px-6 py-3 text-sm shadow-xl shadow-accent/20"
                  >
                    {c.ctaPrimary} <ArrowRight size={16} />
                  </button>
                )}

                <a
                  href={APK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="smsmax-gateway.apk"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 transition"
                >
                  <Download size={16} /> {c.ctaApk}
                </a>

                <Link to="/docs" className="btn-ghost px-4 py-3 text-sm border border-white/10">
                  <BookOpen size={16} className="text-accent" /> {c.ctaDocs}
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> {c.trust1}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> {c.trust2}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> {c.trust3}
                </span>
              </div>
            </div>

            {/* Right Column: Sign In / Create Account Card */}
            <div id="acesso-conta" className="lg:col-span-5">
              <div className="card relative border border-white/10 bg-surface/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
                <div className="flex flex-col items-center justify-center gap-1.5 pb-4 border-b border-white/10">
                  <img
                    src="/logo-icon.png"
                    alt="Max Netminas"
                    className="h-14 w-auto object-contain drop-shadow-[0_4px_16px_rgba(34,211,238,0.25)]"
                  />
                  <div className="text-xl font-extrabold tracking-tight text-white">
                    Max <span className="text-accent font-semibold">Netminas</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {session ? c.authCardSubtitleLogged : c.authCardSubtitleGuest}
                  </p>
                </div>

                {session ? (
                  <div className="space-y-4 pt-5 text-center">
                    <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-xs text-slate-200">
                      {c.authLoggedBox}
                    </div>
                    <Link to="/dashboard" className="btn-primary w-full py-3">
                      {c.authLoggedBtn} <ArrowRight size={16} />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 rounded-xl bg-bg p-1 border border-white/5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => { setAuthMode('login'); setAuthError(''); setAuthNotice(''); }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                          authMode === 'login' ? 'bg-accent text-bg shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <LogIn size={14} /> {c.tabLogin}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthNotice(''); }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                          authMode === 'signup' ? 'bg-accent text-bg shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserPlus size={14} /> {c.tabSignup}
                      </button>
                    </div>

                    <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3.5">
                      {authMode === 'signup' && (
                        <div>
                          <label className="label">{c.nameLabel}</label>
                          <input
                            className="input"
                            required
                            placeholder={c.namePlaceholder}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                          />
                        </div>
                      )}

                      <div>
                        <label className="label">{c.emailLabel}</label>
                        <input
                          type="email"
                          className="input"
                          required
                          placeholder={c.emailPlaceholder}
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="label">{c.passwordLabel}</label>
                        <input
                          type="password"
                          minLength={6}
                          className="input"
                          required
                          placeholder={c.passwordPlaceholder}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                      </div>

                      {authMode === 'signup' && (
                        <div className="rounded-lg border border-white/10 bg-bg/60 p-3 text-xs text-slate-300">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded accent-accent shrink-0"
                              checked={acceptedTerms}
                              onChange={(e) => setAcceptedTerms(e.target.checked)}
                            />
                            <span className="leading-relaxed">
                              {c.termsPrefix}{' '}
                              <button
                                type="button"
                                onClick={() => { setTermsModalTab('terms'); setShowTermsModal(true); }}
                                className="text-accent underline hover:text-accent/80 font-medium"
                              >
                                {c.termsLink1}
                              </button>{' '}
                              {c.termsAnd}{' '}
                              <button
                                type="button"
                                onClick={() => { setTermsModalTab('antispam'); setShowTermsModal(true); }}
                                className="text-accent underline hover:text-accent/80 font-medium"
                              >
                                {c.termsLink2}
                              </button>.
                            </span>
                          </label>
                        </div>
                      )}

                      {authError && (
                        <div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
                          {authError}
                        </div>
                      )}

                      {authNotice && (
                        <div className="rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs text-success">
                          {authNotice}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authBusy || (authMode === 'signup' && !acceptedTerms)}
                        className="btn-primary w-full py-2.5 text-sm shadow-lg shadow-accent/15"
                      >
                        {authBusy
                          ? c.submitBusy
                          : authMode === 'login'
                          ? c.submitLogin
                          : c.submitSignup}
                      </button>
                    </form>

                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Lock size={12} className="text-accent" /> {c.encryptedBadge}
                      </span>
                      <a
                        href={APK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        download="smsmax-gateway.apk"
                        className="text-emerald-400 hover:underline font-medium flex items-center gap-1"
                      >
                        <Download size={12} /> {c.ctaApk}
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SOLUTIONS: AUTOMATION, IOT & QUEUE ORCHESTRATION */}
      <section id="solutions" className="py-16 sm:py-20 border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="badge bg-accent/15 text-accent border border-accent/30 uppercase tracking-wider">
              {c.solBadge}
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white">
              {c.solTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              {c.solSubtitle}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.solCards.map((card, idx) => {
              const Icon = solIcons[idx] || Cpu;
              const isEven = idx % 2 === 1;
              return (
                <div key={card.title} className="card space-y-3 border border-white/10 hover:border-accent/40 transition">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isEven ? 'bg-emerald-500/15 text-emerald-400' : 'bg-accent/15 text-accent'}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{card.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS IN 4 STEPS + APK DOWNLOAD */}
      <section id="how-it-works" className="py-16 sm:py-20 border-b border-white/5 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                {c.howBadge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {c.howTitle}
              </h2>
              <p className="text-sm text-slate-400">
                {c.howSubtitle}
              </p>
            </div>

            <a
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              download="smsmax-gateway.apk"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-3 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 transition self-start md:self-auto"
            >
              <Download size={16} /> {c.howApkBtn}
            </a>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.steps.map((st) => {
              const isPhone = st.where === 'phone';
              return (
                <div key={st.step} className="card flex flex-col justify-between border border-white/10 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 font-extrabold text-accent">
                        {st.step}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          isPhone
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-accent/15 text-accent border-accent/30'
                        }`}
                      >
                        {isPhone ? <Smartphone size={12} /> : <Globe size={12} />}
                        <span>{st.whereLabel}</span>
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base">{st.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{st.desc}</p>
                  </div>

                  {st.hasApk && (
                    <a
                      href={APK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      download="smsmax-gateway.apk"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition"
                    >
                      <Download size={13} /> {c.ctaApk} (.apk)
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. LIVE API EXAMPLE & 1-CLICK N8N NODE */}
      <section id="api-n8n" className="py-16 sm:py-20 border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="badge bg-accent/15 text-accent border border-accent/30 uppercase tracking-wider">
                {c.apiBadge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {c.apiTitle}
              </h2>
              <p className="text-sm text-slate-400">
                {c.apiSubtitle}
              </p>
            </div>

            <Link to="/docs" className="btn-ghost text-xs border border-white/10 self-start md:self-auto">
              <BookOpen size={15} className="text-accent" /> {c.apiDocsBtn} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="card lg:col-span-7 space-y-3 border border-white/10 bg-[#070b19]">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                  <Terminal size={15} className="text-accent" />
                  <span>POST {ENDPOINT_URL}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(sampleCurl, 'curl')}
                  className="btn-ghost py-1 px-2.5 text-xs"
                >
                  {copiedKey === 'curl' ? <><Check size={13} className="text-emerald-400" /> {c.copied}</> : <><Copy size={13} /> {c.copyCurl}</>}
                </button>
              </div>
              <pre className="overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed p-1">
                {sampleCurl}
              </pre>
            </div>

            <div className="card lg:col-span-5 flex flex-col justify-between space-y-4 border border-white/10">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent">
                  <Server size={16} /> {c.n8nBadge}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {c.n8nTitle}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {c.n8nDesc}
                </p>
                <ul className="space-y-1.5 text-xs text-slate-400 pt-1">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" /> {c.n8nBullet1}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" /> {c.n8nBullet2}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" /> {c.n8nBullet3}
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => copyText(n8nNodeJson, 'n8n')}
                className="btn-primary w-full py-3 text-xs"
              >
                {copiedKey === 'n8n' ? (
                  <><Check size={15} /> {c.n8nBtnCopied}</>
                ) : (
                  <><Copy size={15} /> {c.n8nBtn}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PRICING & OPERATIONAL CAPACITY */}
      <section id="pricing" className="py-16 sm:py-20 border-b border-white/5 bg-surface/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="badge bg-accent/15 text-accent border border-accent/30 uppercase tracking-wider">
              {c.plansBadge}
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white">
              {c.plansTitle}
            </h2>
            <p className="text-sm text-slate-400">
              {c.plansSubtitle}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const priceBrl = Number(p.price_brl ?? 0);
              const free = priceBrl === 0;
              const popular = p.id === 'PRO';
              const displayName = c.planNames[p.id] ?? p.name;
              const displayDesc = c.planDescs[p.id] ?? p.description;

              return (
                <div
                  key={p.id}
                  className={`card relative flex flex-col justify-between transition duration-200 hover:-translate-y-1 hover:border-accent/40 ${
                    popular ? 'ring-2 ring-accent shadow-xl shadow-accent/10' : 'border-white/10'
                  }`}
                >
                  <div>
                    {popular && (
                      <span className="badge mb-3 w-fit bg-accent text-bg font-bold">
                        <Sparkles size={12} /> {c.popularBadge}
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-white">{displayName}</h3>
                    {displayDesc && <p className="mt-1 text-xs text-slate-400 leading-relaxed">{displayDesc}</p>}

                    <div className="my-5">
                      <div className="text-3xl font-extrabold text-white">
                        {free ? c.freeLabel : formatUsd(p)}
                        {!free && <span className="text-xs font-normal text-slate-400">{c.perMonth}</span>}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-400">
                        {free ? 'US$ 0.00 · R$ 0,00' : `${formatBrl(p)}${c.perMonth}`}
                      </div>
                    </div>

                    <ul className="space-y-2.5 text-xs">
                      {planHighlights(p).map(({ icon: Icon, text, note, ok }) => (
                        <li key={text} className={`flex items-start gap-2.5 ${ok ? 'text-slate-200' : 'text-slate-500'}`}>
                          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${ok ? 'bg-accent/15 text-accent' : 'bg-white/5 text-slate-600'}`}>
                            <Icon size={13} />
                          </span>
                          <div className="flex-1 leading-snug">
                            {note ? (
                              <a href="#operational-note" className="hover:text-accent transition">
                                {text}{' '}
                                <span className="inline-flex items-center rounded bg-accent/15 px-1 py-0.5 text-[9px] font-semibold text-accent">
                                  {c.seeNote}
                                </span>
                              </a>
                            ) : (
                              text
                            )}
                            {note && (
                              <div className="text-[10px] text-slate-400">
                                {c.quotaSub}
                              </div>
                            )}
                          </div>
                          {ok ? <Check size={14} className="mt-0.5 text-success shrink-0" /> : <X size={14} className="mt-0.5 text-slate-600 shrink-0" />}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => (session ? navigate('/planos') : scrollToAuth('signup'))}
                    className={`mt-6 w-full ${popular || !free ? 'btn-primary' : 'btn-ghost border border-white/10'}`}
                  >
                    {free ? c.planBtnFree : c.planBtnPaid}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Operational & Carrier Best Practices Disclaimer */}
          <div id="operational-note" className="card border-slate-800 bg-surface/70 space-y-2.5 text-xs text-slate-400 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-slate-200 text-sm">
              <Info size={16} className="text-accent shrink-0" />
              <span>{c.noteTitle}</span>
            </div>
            <p>
              <strong className="text-slate-300">{c.note1Strong}</strong> {c.note1Body}
            </p>
            <p>
              <strong className="text-slate-300">{c.note2Strong}</strong> {c.note2Body}{' '}
              <Link to="/termos" className="text-accent hover:underline">{c.noteTermsLink}</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-10 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="Max Netminas" className="h-7 w-7 object-contain" />
            <span className="font-bold text-white">Max <span className="text-accent">Netminas</span></span>
            <span className="text-slate-500">{c.footerTag}</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <Link to="/docs" className="hover:text-white transition">{c.footerDocs}</Link>
            <a href={APK_URL} target="_blank" rel="noopener noreferrer" download="smsmax-gateway.apk" className="hover:text-emerald-400 transition">
              {c.footerApk}
            </a>
            <Link to="/termos" className="hover:text-white transition">{c.footerTerms}</Link>
            {!session && (
              <button type="button" onClick={() => scrollToAuth('login')} className="text-accent hover:underline font-semibold">
                {c.footerLogin}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Terms of Use & Anti-Spam Modal */}
      <LegalTermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        initialTab={termsModalTab}
        onAccept={() => {
          setAcceptedTerms(true);
          setShowTermsModal(false);
        }}
      />
    </div>
  );
}
