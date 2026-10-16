import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, FileText, Scale, ArrowLeft,
  AlertTriangle, Ban, Lock, CheckCircle2, MessageSquare
} from 'lucide-react';

export default function Terms() {
  const [activeTab, setActiveTab] = useState('terms');

  return (
    <div className="min-h-screen bg-bg text-slate-200">
      {/* Barra Superior / Header */}
      <header className="border-b border-white/5 bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-90 transition">
              <div className="h-8 w-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <MessageSquare size={18} />
              </div>
              <span>Max <span className="text-accent">Netminas</span></span>
            </Link>
            <span className="hidden sm:inline text-xs text-slate-500">•</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-medium">
              Conformidade Legal & LGPD
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              to="/docs"
              className="text-slate-400 hover:text-white transition hidden md:inline"
            >
              Documentação
            </Link>
            <Link
              to="/login"
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="btn-primary text-xs px-3.5 py-1.5 shadow-md shadow-accent/10"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Cabeçalho da Página */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">
            <Scale size={14} />
            <span>Documentação Jurídica Oficial</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Termos de Uso e Política de Privacidade
          </h1>
          <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
            Transparência total sobre a operação da plataforma SMSMax, responsabilidades de conectividade móvel, conformidade rigorosa com a LGPD (Lei nº 13.709/2018) e proteção de dados.
          </p>
          <p className="text-xs text-slate-500">
            Última atualização: 16 de outubro de 2026 • Versão 1.0
          </p>
        </div>

        {/* Abas de Navegação */}
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition border-b-2 whitespace-nowrap ${
              activeTab === 'terms'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText size={16} />
            <span>Termos de Uso e Serviço</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition border-b-2 whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Política de Privacidade (LGPD)</span>
          </button>
        </div>

        {/* Documentos */}
        <div className="card border border-white/10 shadow-xl bg-surface p-6 sm:p-8 space-y-8">
          {activeTab === 'terms' ? (
            <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">1.</span> Natureza da Plataforma e Objeto
                </h2>
                <p>
                  O <strong>SMSMax</strong> (desenvolvido e operado pela Max Netminas) é uma plataforma de software como serviço (SaaS) que atua exclusivamente como <strong>middleware de mensageria e gerenciador inteligente de filas</strong>. Sua função técnica restringe-se a despachar mensagens fornecidas pelo usuário para o aplicativo Android Gateway instalado nos aparelhos celulares do próprio cliente.
                </p>
                <p className="text-slate-400 text-xs">
                  O SMSMax <strong>NÃO</strong> é operadora de telefonia celular, nem concessionária ou permissionária de Serviços Móveis Pessoais (SMP), tampouco agregadora ou intermediária de tráfego de telecomunicações.
                </p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">2.</span> Custos Operacionais, Chips e Conectividade
                </h2>
                <p>
                  A aquisição de chips telefônicos (SIM Card físico ou eSIM), aparelhos smartphones Android, planos móveis, pacotes de SMS e tarifas de conexão cobradas pelas operadoras de telefonia são de <strong>exclusiva responsabilidade operacional e financeira do usuário</strong>.
                </p>
                <p>
                  O SMSMax não cobra qualquer valor por SMS enviado, limitando sua cobrança à taxa de subscrição de uso da infraestrutura de software.
                </p>
              </section>

              <section className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-amber-200 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-100 text-sm">
                  <AlertTriangle size={18} className="text-amber-400" />
                  3. Isenção Total por Bloqueios e Banimentos de Linhas
                </div>
                <p className="leading-relaxed text-slate-300">
                  O usuário declara estar plenamente ciente de que o envio abusivo, a frequência desproporcional ou o disparo de mensagens para destinatários não consentidos podem violar as políticas de uso aceitável das operadoras móveis.
                </p>
                <p className="leading-relaxed text-slate-300">
                  O SMSMax <strong>NÃO se responsabiliza</strong> por bloqueios de IMEI, suspensão preventiva de serviços, cancelamento de planos ou banimento de chips executados pelas operadoras de telefonia decorrentes de denúncias de spam ou violação de contrato com a sua respectiva operadora.
                </p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">4.</span> Foco em IoT, M2M e Automações Legítimas
                </h2>
                <p>
                  O sistema foi projetado primariamente para telemetria, Internet das Coisas (IoT), microcontroladores (ESP32/Arduino), alertas corporativos e fluxos de automação de processos.
                </p>
                <p>
                  O SMSMax disponibiliza integrações neutras baseadas em padrões abertos (HTTP/REST e Webhooks), não possuindo vínculo comercial, técnico ou societário com plataformas de automação terceiras (como n8n, Make, Zapier ou Typebot) nem com fabricantes de hardware.
                </p>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">5.</span> Faturamento e Pagamentos Seguros
                </h2>
                <p>
                  O processamento de assinaturas e cobrança mensal é 100% terceirizado e executado pela processadora de pagamentos internacional <strong>Stripe</strong>.
                </p>
                <p className="text-slate-400 text-xs">
                  O SMSMax não processa, não armazena e não tem acesso aos dados de cartão de crédito dos usuários em seus servidores, operando em conformidade com o padrão internacional de segurança PCI-DSS.
                </p>
              </section>

              <section className="p-4 rounded-xl bg-danger/10 border border-danger/30 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-danger text-sm">
                  <Ban size={18} />
                  6. Veto Expressivo e Práticas Proibidas
                </div>
                <p className="leading-relaxed text-slate-300">
                  É expressamente vedada a utilização do SMSMax para envio de SPAM em massa não solicitado, esquemas fraudulentos, golpes financeiros, disseminação de malware, campanhas de phishing ou qualquer atividade ilícita prevista na legislação brasileira.
                </p>
                <p className="leading-relaxed text-slate-300 font-semibold text-rose-300">
                  A infração a esta cláusula resultará no banimento imediato e irrevogável da conta, sem direito a qualquer reembolso de valores pagos, além da cooperação irrestrita com autoridades policiais e judiciais mediante solicitação formal.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">1.</span> Princípio da Minimização de Dados (Art. 6º, III da LGPD)
                </h2>
                <p>
                  Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018)</strong>, a coleta e o processamento de informações no SMSMax obedecem ao princípio da necessidade estrita:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300 text-xs">
                  <li><strong>Dados cadastrais da conta:</strong> Nome ou Razão Social, endereço de e-mail e hash criptografado da senha.</li>
                  <li><strong>Dados de fila e roteamento de SMS:</strong> Número de telefone do destinatário com DDI/DDD, texto da mensagem transmitida e identificador técnico (Android ID) do dispositivo móvel autorizado.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">2.</span> Dados Sensíveis e Proteção ao Dispositivo
                </h2>
                <p>
                  O SMSMax <strong>NÃO</strong> coleta nem trata dados pessoais sensíveis (tais como raça, etnia, filiação partidária, convicção religiosa ou dados biométricos/genéticos, conforme o Art. 5º, II da LGPD).
                </p>
                <div className="p-4 rounded-xl bg-bg/70 border border-white/5 space-y-1 text-xs text-slate-300">
                  <span className="font-bold text-white block">Privacidade no Smartphone Android:</span>
                  O aplicativo móvel SMSMax Gateway utiliza apenas as permissões de envio e leitura de status de SMS solicitadas em primeiro plano. O aplicativo <strong>não acessa</strong> a agenda de contatos pessoais do usuário, fotos, mídias privadas, microfone, histórico de chamadas ou geolocalização.
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">3.</span> Bases Legais de Tratamento (Art. 7º da LGPD)
                </h2>
                <p>
                  As operações de tratamento de dados pessoais no SMSMax apoiam-se estritamente nas seguintes hipóteses legais:
                </p>
                <ul className="list-disc list-inside space-y-2 pl-2 text-xs">
                  <li>
                    <strong className="text-white">Execução de Contrato (Art. 7º, V):</strong> O processamento do conteúdo da mensagem e do número destinatário é indispensável para o cumprimento do serviço contratado pelo usuário (gestão e encaminhamento da fila de SMS ao aparelho).
                  </li>
                  <li>
                    <strong className="text-white">Cumprimento de Obrigação Legal (Art. 7º, II):</strong> A retenção de logs de conexão e endereços IP ocorre nos termos exigidos pelo Art. 15 da Lei Federal nº 12.965/2014 (Marco Civil da Internet).
                  </li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">4.</span> Direitos do Titular de Dados (Art. 18 da LGPD)
                </h2>
                <p>
                  O titular dos dados pessoais pode exercer, a qualquer tempo e sem qualquer custo, os seus direitos previstos em lei:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-bg/60 p-3 rounded-lg border border-white/5 space-y-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" /> Acesso e Confirmação
                    </span>
                    <span className="text-slate-400">Direito de consultar e exportar todos os dados associados à sua conta.</span>
                  </div>
                  <div className="bg-bg/60 p-3 rounded-lg border border-white/5 space-y-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" /> Correção de Dados
                    </span>
                    <span className="text-slate-400">Atualizar dados incompletos, inexatos ou desatualizados no perfil.</span>
                  </div>
                  <div className="bg-bg/60 p-3 rounded-lg border border-white/5 space-y-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" /> Anonimização e Exclusão
                    </span>
                    <span className="text-slate-400">Solicitar a remoção definitiva de sua conta e dos históricos de SMS.</span>
                  </div>
                  <div className="bg-bg/60 p-3 rounded-lg border border-white/5 space-y-1">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" /> Revogação de Consentimento
                    </span>
                    <span className="text-slate-400">Encerramento da prestação de serviço com expurgo dos registros pertinentes.</span>
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-accent">5.</span> Segurança da Informação e Criptografia
                </h2>
                <p className="text-xs text-slate-300">
                  Todas as comunicações entre suas aplicações, o painel web e o aplicativo Android Gateway são criptografadas em trânsito através de protocolos HTTPS/TLS com certificados de segurança de chave forte. O acesso às APIs exige tokens Bearer individuais e revogáveis.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5 text-xs text-slate-400">
          <Link
            to="/register"
            className="flex items-center gap-1.5 text-accent hover:underline font-medium"
          >
            <ArrowLeft size={14} />
            <span>Retornar ao Cadastro</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/docs" className="hover:text-white transition">
              Guia da API
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-white transition">
              Acesso ao Painel
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
