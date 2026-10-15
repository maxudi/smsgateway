import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Upload, Ban, Trash2, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import InterestPicker from '../components/InterestPicker.jsx';
import { fetchAll } from '../lib/campaigns.js';

const ORIGENS = ['Agenda pessoal', 'Automação', 'Importação CSV', 'Site', 'Indicação'];
const PAGE_SIZES = [10, 25, 50, 'ALL'];
const DELETE_CHUNK = 100; // limita o tamanho da URL do .in()

/** Normaliza para apenas dígitos, mantendo "+" inicial se existir. */
export const normalizePhone = (v = '') => {
  const s = String(v).trim();
  return (s.startsWith('+') ? '+' : '') + s.replace(/\D/g, '');
};

/** Parser CSV simples (Nome,Telefone) — aceita , ou ; e cabeçalho opcional. */
function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[;,]/).map((c) => c.replace(/^"|"$/g, '').trim()))
    .filter(([name, phone]) => phone && /\d{8,}/.test(phone.replace(/\D/g, '')) && name !== undefined)
    .map(([name, phone]) => ({ name, phone: normalizePhone(phone) }));
}

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', tipo: '', valid: false, groups: [] });
  const [msg, setMsg] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [editing, setEditing] = useState(null); // { id, name, tipo, groups }
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 'ALL' = mostrar todos
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    supabase.from('contact_groups').select('*').order('sort_order')
      .then(({ data }) => setGroups(data ?? []));
  }, []);

  const load = useCallback(async () => {
    try {
      // Lotes de 1000 com .range() até trazer todos; id desempata a ordenação por nome
      const data = await fetchAll(() => supabase.from('contacts')
        .select('*, contact_group_members!contact_group_members_contact_id_fkey(group_id)').eq('user_id', user.id)
        .order('name').order('id'));
      setContacts(data);
    } catch (error) {
      console.error('contacts load:', error);
      setMsg(`Erro ao carregar contatos: ${error.message}`);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.valid) return setMsg('Telefone incompleto para o país selecionado.');
    const { data: created, error } = await supabase.from('contacts').insert({
      user_id: user.id, name: form.name.trim(), phone: form.phone, tipo: form.tipo.trim() || null,
    }).select('id').single();
    if (error) return setMsg(error.code === '23505' ? 'Este telefone já está cadastrado.' : error.message); 
    const err2 = await saveInterests(created.id, form.groups);
    if (err2) return setMsg(err2.message);
    setForm({ name: '', phone: '', tipo: '', valid: false, groups: [] }); setOpen(false); setMsg('');
    load();
  };

  // Substitui os interesses do contato pelo conjunto informado
  const saveInterests = async (contactId, groupIds) => {
    const { error: delErr } = await supabase.from('contact_group_members').delete().eq('contact_id', contactId);
    if (delErr) return delErr;
    if (!groupIds.length) return null;
    const { error } = await supabase.from('contact_group_members')
      .insert(groupIds.map((group_id) => ({ contact_id: contactId, group_id })));
    return error;
  };

  const updateInterests = async () => {
    const { error: tErr } = await supabase.from('contacts')
      .update({ tipo: editing.tipo.trim() || null }).eq('id', editing.id);
    if (tErr) return setMsg(tErr.message);
    const err = await saveInterests(editing.id, editing.groups);
    if (err) return setMsg(err.message);
    setEditing(null); setMsg('');
    load();
  };

  const importCsv = async (file) => {
    if (!file) return;
    const rows = parseCsv(await file.text()).map((r) => ({ ...r, tipo: 'Importação CSV', user_id: user.id }));
    if (!rows.length) return setMsg('Nenhum contato válido encontrado no CSV.');
    // Evita duplicados já existentes
    const existing = new Set(contacts.map((c) => c.phone));
    const fresh = rows.filter((r) => !existing.has(r.phone));
    const { error } = await supabase.from('contacts').insert(fresh);
    setMsg(error ? error.message : `${fresh.length} contato(s) importado(s); ${rows.length - fresh.length} ignorado(s) por duplicidade.`);
    fileRef.current.value = '';
    load();
  };

  const remove = async (id) => {
    await supabase.from('contacts').delete().eq('id', id);
    load();
  };

  const removeSelected = async () => {
    if (!confirm(`Tem certeza que deseja excluir permanentemente ${selectedIds.size} contatos?`)) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const { error } = await supabase.from('contacts').delete().in('id', ids.slice(i, i + DELETE_CHUNK));
      if (error) {
        setMsg(`Erro ao excluir: ${error.message}`);
        setDeleting(false);
        load();
        return;
      }
    }
    setSelectedIds(new Set());
    setMsg(`${ids.length} contato(s) excluído(s).`);
    setDeleting(false);
    load();
  };

  const toggleOne = (id) => setSelectedIds((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const groupIdsOf = (c) => (c.contact_group_members ?? []).map((m) => m.group_id);
  const allGroupId = groups.find((g) => g.slug === 'todas')?.id;

  // Sugestões de origem + valores já usados; o campo continua texto livre
  const tipoOptions = [...new Set([...ORIGENS, ...contacts.map((c) => c.tipo).filter(Boolean)])];
  const usedTipos = [...new Set(contacts.map((c) => c.tipo).filter(Boolean))].sort();

  // Contato com interesse em "Todas" aparece em qualquer filtro de grupo
  const filtered = contacts.filter((c) =>
    `${c.name} ${c.phone} ${c.tipo ?? ''}`.toLowerCase().includes(search.toLowerCase()) &&
    (!tipoFilter || c.tipo === tipoFilter) &&
    (!groupFilter || groupIdsOf(c).some((id) => id === groupFilter || id === allGroupId)));

  const showAll = pageSize === 'ALL';
  const totalPages = showAll ? 1 : Math.ceil(filtered.length / pageSize) || 1;
  const paginatedContacts = showAll
    ? filtered
    : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const toggleAll = () => setSelectedIds(allFilteredSelected ? new Set() : new Set(filtered.map((c) => c.id)));

  // A seleção não sobrevive a mudança de filtro, para não excluir contatos que saíram da visão
  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [search, tipoFilter, groupFilter]);
  useEffect(() => { setCurrentPage(1); }, [pageSize]);
  // Volta uma página se a atual deixar de existir (ex.: último contato da página excluído)
  useEffect(() => { setCurrentPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  const pageBtn = 'btn-ghost px-2 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Contatos</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => fileRef.current.click()}><Upload size={16} /> Importar CSV</button>
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Novo contato</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importCsv(e.target.files[0])} />
        </div>
      </div>

      <div className="card border-dashed text-sm text-slate-400">
        Formato do CSV: uma linha por contato — <code className="text-accent">Nome,Telefone</code> (ex.: <code>Maria,5511999998888</code>).
      </div>
      {msg && <p className="text-sm text-accent">{msg}</p>}

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-sm" placeholder="Buscar por nome, telefone ou tipo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-xs" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
          <option value="">Todos os tipos</option>
          {usedTipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input max-w-xs" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">Todos os interesses</option>
          {groups.filter((g) => g.slug !== 'todas').map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-danger/30 text-sm">
          <span className="text-slate-300">{selectedIds.size} contato(s) selecionado(s)</span>
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={deleting} onClick={() => setSelectedIds(new Set())}>Limpar seleção</button>
            <button className="btn-danger" disabled={deleting} onClick={removeSelected}>
              <Trash2 size={14} /> {deleting ? 'Excluindo...' : 'Excluir Selecionados'}
            </button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400 border-b border-white/5">
            <tr>
              <th className="p-3 w-8">
                <input type="checkbox" className="accent-accent" title="Selecionar todos do filtro atual"
                  checked={allFilteredSelected} disabled={!filtered.length} onChange={toggleAll} />
              </th>
              <th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Tipo</th><th className="p-3">Interesses</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {paginatedContacts.map((c) => (
              <tr key={c.id} className="border-b border-white/5 last:border-0">
                <td className="p-3">
                  <input type="checkbox" className="accent-accent" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} />
                </td>
                <td className="p-3">{c.name}</td>
                <td className="p-3 font-mono">{c.phone}</td>
                <td className="p-3">{c.tipo || <span className="text-slate-600">—</span>}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {groupIdsOf(c).map((id) => (
                      <span key={id} className="badge bg-accent/15 text-accent">{groups.find((g) => g.id === id)?.name}</span>
                    ))}
                    <button title="Editar interesses" className="text-slate-500 hover:text-accent"
                      onClick={() => setEditing({ id: c.id, name: c.name, tipo: c.tipo ?? '', groups: groupIdsOf(c) })}>
                      <Pencil size={14} />
                    </button>
                  </div>
                </td>
                <td className="p-3">
                  {c.opted_out
                    ? <span className="badge bg-danger/15 text-danger"><Ban size={12} /> Opt-out (SAIR)</span>
                    : <span className="badge bg-success/15 text-success">Ativo</span>}
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(c.id)} className="text-slate-500 hover:text-danger"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum contato.</td></tr>}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 p-3 text-sm text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>Mostrando {paginatedContacts.length} de {filtered.length} contatos</span>
            <select className="input w-auto py-1 text-xs" value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n === 'ALL' ? 'Mostrar Todos' : `${n} por página`}</option>)}
            </select>
          </div>
          {!showAll && totalPages > 1 && (
            <div className="flex items-center gap-2">
            <button className={pageBtn} title="Primeira" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
              <ChevronsLeft size={16} />
            </button>
            <button className={pageBtn} title="Anterior" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-slate-300">Página {currentPage} de {totalPages}</span>
            <button className={pageBtn} title="Próxima" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight size={16} />
            </button>
            <button className={pageBtn} title="Última" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
              <ChevronsRight size={16} />
            </button>
          </div>
          )}
        </div>
      </div>

      <datalist id="tipos-list">
        {tipoOptions.map((t) => <option key={t} value={t} />)}
      </datalist>

      {open && (
        <Modal title="Novo contato" onClose={() => setOpen(false)}>
          <form onSubmit={add} className="space-y-4">
            <div><label className="label">Nome</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Telefone</label>
              <PhoneInput onChange={(phone, valid) => setForm((f) => ({ ...f, phone, valid }))} /></div>
            <div><label className="label">Tipo (origem do contato)</label>
              <input className="input" list="tipos-list" value={form.tipo} placeholder="Ex.: Agenda pessoal, Automação"
                onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></div>
            <div><label className="label">Interesses</label>
              <InterestPicker groups={groups} value={form.groups} onChange={(g) => setForm((f) => ({ ...f, groups: g }))} /></div>
            {msg && <p className="text-sm text-danger">{msg}</p>}
            <button className="btn-primary w-full">Salvar</button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div><label className="label">Tipo (origem do contato)</label>
              <input className="input" list="tipos-list" value={editing.tipo} placeholder="Ex.: Agenda pessoal, Automação"
                onChange={(e) => setEditing({ ...editing, tipo: e.target.value })} /></div>
            <div><label className="label">Interesses</label>
              <InterestPicker groups={groups} value={editing.groups} onChange={(g) => setEditing({ ...editing, groups: g })} /></div>
            <button className="btn-primary w-full" onClick={updateInterests}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
