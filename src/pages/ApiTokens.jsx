import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Terminal,
  Code2, ShieldCheck, AlertCircle, RefreshCw, Power,
  Cpu, Send, HelpCircle, Layers, CheckCircle2, BookOpen
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Modal from '../components/Modal.jsx';

const ENDPOINT_URL = 'https://api.smsmax.netminas.com/functions/v1/send-sms';

export default function ApiTokens() {
  const { tenant: authTenant } = useAuth();
  const { t, lang } = useLanguage();
  const [tenantId, setTenantId] = useState(authTenant?.id || null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Estados para geração de novo token
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewTokenModal, setShowNewTokenModal] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [revealedIds, setRevealedIds] = useState(new Set());

  // Token selecionado para a documentação
  const [selectedDocTokenId, setSelectedDocTokenId] = useState(null);

  // Copiar para a área de transferência com fallback
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

  // Obtém o tenant_id ativo da sessão ou busca diretamente por e-mail com fallback
  const getActiveTenantId = async () => {
    if (authTenant?.id) {
      setTenantId(authTenant.id);
      return authTenant.id;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Busca na tabela tenants pelo email do usuário logado
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (error || !tenant) {
      return null;
    }

    setTenantId(tenant.id);
    return tenant.id;
  };

  // Carrega os tokens do tenant atual
  const loadTokens = async (overrideTenantId) => {
    setLoading(true);
    setError('');
    try {
      const activeTenantId = overrideTenantId || tenantId || (await getActiveTenantId());
      if (!activeTenantId) {
        setTokens([]);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setTokens(data || []);

      if (data && data.length > 0) {
        const active = data.find((t) => t.is_active);
        if (active) setSelectedDocTokenId(active.id);
        else setSelectedDocTokenId(data[0].id);
      } else {
        setSelectedDocTokenId(null);
      }
    } catch (err) {
      console.error('Erro ao carregar tokens:', err);
      setError(t('tokens.loadError'));
      setTokens([]);
    } finally {
      // Garante em qualquer cenário que a animação/indicador de carregamento é desativada
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens(authTenant?.id);
  }, [authTenant?.id]);

  // Gerar novo token seguro
  const handleGenerateToken = async () => {
    const activeTenantId = tenantId || (await getActiveTenantId());
    if (!activeTenantId) {
      setError(t('tokens.noTenantError'));
      return;
    }
    setIsGenerating(true);
    setError('');
    setSuccessNotice('');

    try {
      // 24 bytes criptograficamente aleatórios = 48 chars hex
      const randomBytes = new Uint8Array(24);
      window.crypto.getRandomValues(randomBytes);
      const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const generatedToken = `smsmax_live_${hex}`;

      const { data, error: insertErr } = await supabase
        .from('api_tokens')
        .insert({
          tenant_id: activeTenantId,
          token: generatedToken,
          is_active: true,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setNewlyCreatedToken(generatedToken);
      setShowNewTokenModal(true);
      await loadTokens(activeTenantId);
      if (data?.id) setSelectedDocTokenId(data.id);
    } catch (err) {
      console.error('Erro ao criar token:', err);
      setError(err?.message || t('tokens.generateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Alternar status ativo/inativo (Revogar / Reativar)
  const handleToggleStatus = async (tokenItem) => {
    try {
      const newStatus = !tokenItem.is_active;
      const { error: updateErr } = await supabase
        .from('api_tokens')
        .update({ is_active: newStatus })
        .eq('id', tokenItem.id);

      if (updateErr) throw updateErr;

      setTokens((prev) =>
        prev.map((t) => (t.id === tokenItem.id ? { ...t, is_active: newStatus } : t))
      );
      setSuccessNotice(
        newStatus ? t('tokens.tokenReactivatedSuccess') : t('tokens.tokenRevokedSuccess')
      );
      setTimeout(() => setSuccessNotice(''), 3000);
    } catch (err) {
      console.error('Erro ao atualizar status do token:', err);
      setError(t('tokens.statusError'));
    }
  };

  // Excluir token permanentemente
  const handleDeleteToken = async (id) => {
    if (!window.confirm(t('tokens.deleteConfirm'))) {
      return;
    }
    try {
      const { error: delErr } = await supabase.from('api_tokens').delete().eq('id', id);
      if (delErr) throw delErr;

      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (selectedDocTokenId === id) {
        const remaining = tokens.filter((t) => t.id !== id && t.is_active);
        setSelectedDocTokenId(remaining.length > 0 ? remaining[0].id : null);
      }
      setSuccessNotice(t('tokens.tokenDeletedSuccess'));
      setTimeout(() => setSuccessNotice(''), 3000);
    } catch (err) {
      console.error('Erro ao excluir token:', err);
      setError(t('tokens.deleteError'));
    }
  };

  // Alternar visibilidade da chave
  const toggleVisibility = (id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Token atualmente selecionado para a documentação
  const activeDocToken = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;
    const found = tokens.find((t) => t.id === selectedDocTokenId);
    if (found && found.is_active) return found.token;
    const anyActive = tokens.find((t) => t.is_active);
    return anyActive ? anyActive.token : null;
  }, [tokens, selectedDocTokenId]);

  const displayToken = activeDocToken || '<SEU_TOKEN_AQUI>';

  // Snippet cURL
  const curlCode = `curl -X POST "${ENDPOINT_URL}" \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+553499999999",
    "message": "${lang === 'pt' ? 'Mensagem de teste' : 'Test message'}",
    "sim_slot": 0,
    "target_device_id": "ALL"
  }'`;

  // Snippet JSON pronto para colar direto no canvas do n8n (Ctrl+V)
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
                  value: `Bearer ${displayToken}`,
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
          name: 'SMS Max - Enviar SMS',
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
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Key size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{t('tokens.headerTitle')}</h1>
              <p className="text-sm text-slate-400">
                {t('tokens.headerDesc')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <Link
            to="/docs"
            className="btn-ghost flex items-center gap-2 text-xs border border-white/10 hover:border-white/20 transition"
          >
            <BookOpen size={15} className="text-accent" />
            <span>{t('tokens.guideBtn')}</span>
          </Link>
          <button
            onClick={handleGenerateToken}
            disabled={isGenerating}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-accent/10"
          >
            {isGenerating ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            <span>{t('tokens.generateBtn')}</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Lista de Tokens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>{t('tokens.tableTitle')}</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
              {tokens.length}
            </span>
          </h2>
          <button
            onClick={loadTokens}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
            title={t('tokens.refreshTooltip')}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{t('tokens.refresh')}</span>
          </button>
        </div>

        {loading ? (
          <div className="card flex items-center justify-center py-12 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3 text-accent" />
            <span>{t('tokens.loading')}</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="card py-12 text-center space-y-3 border-dashed border-white/10">
            <div className="mx-auto h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
              <Key size={24} />
            </div>
            <div>
              <p className="text-white font-medium">{t('tokens.emptyTitle')}</p>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                {t('tokens.emptyDesc')}
              </p>
            </div>
            <button
              onClick={handleGenerateToken}
              disabled={isGenerating}
              className="btn-primary inline-flex items-center gap-2 mt-2"
            >
              <Plus size={16} /> {t('tokens.emptyBtn')}
            </button>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden border border-white/5 shadow-xl bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">{t('tokens.thKey')}</th>
                    <th className="px-5 py-3.5">{t('tokens.thStatus')}</th>
                    <th className="px-5 py-3.5">{t('tokens.thCreated')}</th>
                    <th className="px-5 py-3.5">{t('tokens.thLastUsed')}</th>
                    <th className="px-5 py-3.5 text-right">{t('tokens.thActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {tokens.map((item) => {
                    const isRevealed = revealedIds.has(item.id);
                    const masked = `${item.token.slice(0, 15)}••••••••••••••••${item.token.slice(-4)}`;
                    const isSelectedForDoc = item.id === selectedDocTokenId;

                    return (
                      <tr
                        key={item.id}
                        className={`transition hover:bg-white/[0.02] ${isSelectedForDoc ? 'bg-accent/5' : ''
                          }`}
                      >
                        <td className="px-5 py-4 font-mono font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="select-all">
                              {isRevealed ? item.token : masked}
                            </span>
                            <button
                              onClick={() => toggleVisibility(item.id)}
                              className="p-1 text-slate-400 hover:text-white transition rounded"
                              title={isRevealed ? t('tokens.hideToken') : t('tokens.showToken')}
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(item.token, `token-${item.id}`)}
                              className="p-1 text-slate-400 hover:text-accent transition rounded"
                              title={t('tokens.copyTokenTooltip')}
                            >
                              {copiedKey === `token-${item.id}` ? (
                                <Check size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-sans">
                          {item.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {t('tokens.badgeActive')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              {t('tokens.badgeRevoked')}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-sans text-slate-400">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            : '-'}
                        </td>
                        <td className="px-5 py-4 font-sans text-slate-400">
                          {item.last_used_at ? (
                            <span className="text-slate-300">
                              {new Date(item.last_used_at).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">{t('tokens.neverUsed')}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-sans text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.is_active && (
                              <button
                                onClick={() => setSelectedDocTokenId(item.id)}
                                className={`text-xs px-2.5 py-1 rounded-lg border transition ${isSelectedForDoc
                                  ? 'bg-accent/20 border-accent/40 text-accent font-semibold'
                                  : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                  }`}
                                title="Usar este token nos exemplos da documentação abaixo"
                              >
                                {isSelectedForDoc ? t('tokens.usingInGuide') : t('tokens.useInGuide')}
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`p-1.5 rounded-lg border transition ${item.is_active
                                ? 'border-white/10 text-slate-400 hover:text-amber-400 hover:border-amber-400/30'
                                : 'border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-400/30'
                                }`}
                              title={item.is_active ? t('tokens.revokeTitle') : t('tokens.reactivateTitle')}
                            >
                              <Power size={15} />
                            </button>

                            <button
                              onClick={() => handleDeleteToken(item.id)}
                              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-400/30 transition"
                              title={t('tokens.deleteTitle')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Seção de Documentação & Integração */}
      <div className="space-y-6 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Code2 size={22} className="text-accent" />
              {t('tokens.docsTitle')}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {t('tokens.docsDesc')}
            </p>
          </div>
          {activeDocToken ? (
            <div className="hidden md:flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg">
              <ShieldCheck size={14} />
              <span>{t('tokens.tokenActiveApplied')}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg">
              <AlertCircle size={14} />
              <span>{t('tokens.tokenGeneratePrompt')}</span>
            </div>
          )}
        </div>

        {/* 1. Endpoint Card */}
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
              onClick={() => copyToClipboard(ENDPOINT_URL, 'endpoint')}
              className="btn-ghost text-xs self-start sm:self-auto flex items-center gap-1.5"
            >
              {copiedKey === 'endpoint' ? (
                <>
                  <Check size={14} className="text-emerald-400" /> {t('common.copied')}
                </>
              ) : (
                <>
                  <Copy size={14} /> {t('tokens.copyEndpoint')}
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="bg-bg/60 p-3.5 rounded-lg border border-white/5 space-y-1.5">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">{t('tokens.reqHeaders')}</span>
              <div className="font-mono space-y-1 text-slate-300">
                <div><span className="text-accent">Authorization:</span> Bearer {displayToken}</div>
                <div><span className="text-accent">Content-Type:</span> application/json</div>
              </div>
            </div>
            <div className="bg-bg/60 p-3.5 rounded-lg border border-white/5 space-y-1.5">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">{t('tokens.bodyParams')}</span>
              <div className="font-mono space-y-1 text-slate-300">
                <div><span className="text-white font-semibold">to:</span> {t('tokens.paramTo')}</div>
                <div><span className="text-white font-semibold">message:</span> {t('tokens.paramMessage')}</div>
                <div><span className="text-white font-semibold">sim_slot:</span> {t('tokens.paramSim')}</div>
                <div><span className="text-white font-semibold">target_device_id:</span> {t('tokens.paramTarget')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Exemplo cURL */}
        <div className="card space-y-3 border border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={16} className="text-accent" />
              {t('tokens.curlTitle')}
            </h3>
            <button
              onClick={() => copyToClipboard(curlCode, 'curl')}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              {copiedKey === 'curl' ? (
                <>
                  <Check size={14} className="text-emerald-400" /> {t('common.copied')}
                </>
              ) : (
                <>
                  <Copy size={14} /> {t('tokens.copyCurl')}
                </>
              )}
            </button>
          </div>
          <div className="relative rounded-lg bg-bg p-4 font-mono text-xs text-slate-300 overflow-x-auto border border-white/5 leading-relaxed">
            <pre>{curlCode}</pre>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-bold font-mono">HTTP 200 OK</span>
            <span>{t('tokens.immediateReturn')}</span>
            <code className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded">
              {'{ "success": true, "messageId": "uuid", "status": "enfileirado", "sim_slot": 0, "target_device_id": "ALL" }'}
            </code>
          </div>
        </div>

        {/* 3. Guia de Integração n8n */}
        <div className="card space-y-5 border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-base">
                n8n
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t('tokens.n8nCardTitle')}</h3>
                <p className="text-xs text-slate-400">
                  {t('tokens.n8nCardDesc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(n8nNodeJson, 'n8n-node')}
              className="btn-primary text-xs flex items-center gap-2 self-start sm:self-auto"
              title="Ctrl+V"
            >
              {copiedKey === 'n8n-node' ? (
                <>
                  <Check size={14} className="text-emerald-300" /> {t('tokens.n8nCopied')}
                </>
              ) : (
                <>
                  <Layers size={14} /> {t('tokens.n8nCopyBtn')}
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3 bg-bg/50 p-4 rounded-xl border border-white/5">
              <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                <span className="h-5 w-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs">1</span>
                {t('tokens.n8nManualTitle')}
              </h4>
              <ul className="space-y-2 text-slate-300 leading-relaxed list-disc list-inside">
                <li>Adicione um nó do tipo <strong className="text-white">HTTP Request</strong>.</li>
                <li>Defina o <strong className="text-white">Method</strong> como <code className="text-accent">POST</code>.</li>
                <li>Cole o URL no campo <strong className="text-white">URL</strong>: <br />
                  <code className="text-slate-300 bg-black/40 px-1.5 py-0.5 rounded break-all select-all">{ENDPOINT_URL}</code>
                </li>
                <li>Ative a opção <strong className="text-white">Send Headers</strong> e adicione:
                  <div className="mt-1 ml-4 font-mono text-[11px] bg-black/30 p-2 rounded border border-white/5 space-y-0.5">
                    <div>• Name: <span className="text-white">Authorization</span></div>
                    <div>• Value: <span className="text-accent">Bearer {displayToken}</span></div>
                    <div>• Name: <span className="text-white">Content-Type</span></div>
                    <div>• Value: <span className="text-accent">application/json</span></div>
                  </div>
                </li>
              </ul>
            </div>

            <div className="space-y-3 bg-bg/50 p-4 rounded-xl border border-white/5">
              <h4 className="font-semibold text-white flex items-center gap-2 text-sm">
                <span className="h-5 w-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs">2</span>
                {t('tokens.n8nBodyTitle')}
              </h4>
              <ul className="space-y-2 text-slate-300 leading-relaxed list-disc list-inside">
                <li>No nó do n8n, marque <strong className="text-white">Send Body</strong> como ativado.</li>
                <li>Selecione <strong className="text-white">Body Content Type</strong>: <code className="text-accent">JSON</code> (ou Raw JSON).</li>
                <li>No campo de texto, insira as variáveis dinâmicas do seu fluxo:
                  <div className="mt-1 font-mono text-[11px] bg-black/30 p-2.5 rounded border border-white/5 text-slate-200">
                    <pre>{`{
  "to": "={{ $json.phone }}",
  "message": "={{ $json.message }}",
  "sim_slot": 0,
  "target_device_id": "ALL"
}`}</pre>
                  </div>
                </li>
                <li className="text-slate-400">
                  {t('tokens.n8nQuickTip')}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Sucesso com Novo Token */}
      {showNewTokenModal && newlyCreatedToken && (
        <Modal
          title={t('tokens.modalTitle')}
          onClose={() => {
            setShowNewTokenModal(false);
            setNewlyCreatedToken(null);
          }}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5">
              <ShieldCheck size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{t('tokens.modalAlertTitle')}</p>
                <p className="text-slate-300 mt-0.5">
                  {t('tokens.modalAlertDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label">{t('tokens.modalKeyLabel')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newlyCreatedToken}
                  className="input font-mono text-xs select-all text-accent bg-bg"
                />
                <button
                  onClick={() => copyToClipboard(newlyCreatedToken, 'modal-new-token')}
                  className="btn-primary px-3 text-xs flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey === 'modal-new-token' ? (
                    <>
                      <Check size={14} className="text-emerald-300" /> {t('common.copied')}
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> {t('common.copy')}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowNewTokenModal(false);
                  setNewlyCreatedToken(null);
                }}
                className="btn-ghost text-xs"
              >
                {t('tokens.modalCompleteBtn')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
