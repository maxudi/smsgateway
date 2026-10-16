import { useState } from 'react';
import { X, FileText, ShieldCheck, Check, AlertTriangle, Ban } from 'lucide-react';

export default function LegalTermsModal({ isOpen, onClose, onAccept, initialTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="card w-full max-w-2xl max-h-[85vh] flex flex-col p-0 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-surface">
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <ShieldCheck className="text-accent" size={20} />
              Conformidade Legal & LGPD
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Leia atentamente os termos e a política que regem o uso da plataforma SMSMax.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-white/5 bg-black/20 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'terms'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText size={15} />
            <span>Termos de Uso e Serviço</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
              activeTab === 'privacy'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ShieldCheck size={15} />
            <span>Política de Privacidade (LGPD)</span>
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed max-h-[52vh]">
          {activeTab === 'terms' ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">1. Natureza da Plataforma (Objeto)</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O <strong>SMSMax</strong> (Max Netminas) é estritamente uma plataforma de software como serviço (SaaS), atuando como middleware e gestor de filas inteligentes para despacho de SMS através de dispositivos Android Gateway próprios do usuário (via API e Webhooks). O SMSMax <strong>NÃO</strong> é operadora de telecomunicações, concessionária pública nem prestadora de Serviços Móveis Pessoais (SMP) ou agregadora de tráfego de telecomunicações.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">2. Custos Operacionais e Conectividade</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A aquisição de chips (SIM Card físico ou eSIM), aparelhos celulares, planos móveis, pacotes de SMS e tarifas de conexão cobradas pelas operadoras são de <strong>exclusiva responsabilidade e custo do usuário</strong>. O SMSMax não cobra por SMS enviado nem comercializa créditos ou pacotes de mensagens.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <AlertTriangle size={16} /> Isenção Expressa por Bloqueios e Banimentos
                </div>
                <p className="text-slate-300 leading-relaxed">
                  O SMSMax <strong>NÃO</strong> se responsabiliza por bloqueios, cancelamentos de contrato ou banimentos de chips/linhas executados por operadoras de telefonia móvel decorrentes de envio excessivo, denúncias de spam ou violação das políticas internas das referidas operadoras.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">3. Foco em IoT, M2M e Automações</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O sistema foi projetado primariamente para telemetria, Internet das Coisas (IoT), microcontroladores (ESP32/Arduino), alertas de monitoramento e fluxos de automação. Não possui qualquer vínculo societário ou comercial com ferramentas de terceiros (como n8n, Make, Zapier, Typebot) nem com fabricantes de hardware, disponibilizando apenas integrações padronizadas via HTTP/REST e Webhook.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">4. Faturamento e Pagamentos</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Todo o faturamento e cobrança de assinaturas é terceirizado via <strong>Stripe</strong>. Não há retenção ou armazenamento de dados de cartão de crédito no servidor do SMSMax.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/30 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-danger">
                  <Ban size={16} /> Uso Proibido e Rescisão
                </div>
                <p className="text-slate-300 leading-relaxed">
                  É expressamente vetada a utilização para envio de spam em massa não consentido, phishing, fraudes, golpes ou quaisquer práticas ilícitas. A infração enseja <strong>suspensão e banimento imediato da conta sem direito a reembolso</strong>, resguardando-se as comunicações cabíveis às autoridades judiciais.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">1. Minimização de Dados (Art. 6º, III da LGPD - Lei 13.709/2018)</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A coleta de dados é estritamente necessária ao funcionamento técnico do serviço:
                </p>
                <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 pl-1">
                  <li><strong>Para a conta do usuário:</strong> apenas e-mail, nome/razão social e hash criptografado de senha.</li>
                  <li><strong>Para o envio de mensagens:</strong> apenas o número de telefone do destinatário, corpo do SMS e ID do dispositivo Android conectado.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">2. Dados Sensíveis e Financeiros</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Não há coleta de dados bancários ou números de cartão de crédito (geridos integralmente pela Stripe sob certificação PCI-DSS) nem de dados biométricos ou sensíveis. O app Android do SMSMax <strong>não acessa</strong> a agenda de contatos, fotos, mídias ou dados confidenciais do aparelho do usuário.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">3. Bases Legais (Art. 7º da LGPD)</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O tratamento de dados pessoais é fundamentado em:
                </p>
                <ul className="text-xs text-slate-300 list-disc list-inside space-y-1 pl-1">
                  <li><strong>Execução de Contrato (Art. 7º, V):</strong> necessário para o processamento, gestão da fila e roteamento de SMS requisitado pelo titular.</li>
                  <li><strong>Cumprimento de Obrigação Legal (Art. 7º, II):</strong> guarda de registros de conexão e autenticação nos termos do Marco Civil da Internet (Lei nº 12.965/2014).</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-white text-base">4. Direitos do Titular (Art. 18 da LGPD)</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O usuário titular pode, a qualquer momento, solicitar o acesso, confirmação, correção, anonimização, bloqueio ou exclusão total de sua conta e dos registros de histórico de filas de SMS.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-surface border-t border-white/5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            {activeTab === 'terms' ? 'Versão: Termos de Uso v1.0' : 'Versão: Política de Privacidade v1.0'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs px-3.5 py-1.5"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 shadow-md shadow-accent/10"
            >
              <Check size={14} />
              <span>Entendi e Aceito</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
