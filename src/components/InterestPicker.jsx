/** Seleção de interesses (grupos de nicho). "Todas" é exclusivo: marcar limpa os demais e vice-versa. */
export default function InterestPicker({ groups, value, onChange }) {
  const all = groups.find((g) => g.slug === 'todas');

  const toggle = (g) => {
    if (g.slug === 'todas') return onChange(value.includes(g.id) ? [] : [g.id]);
    const without = value.filter((id) => id !== all?.id);
    onChange(without.includes(g.id) ? without.filter((id) => id !== g.id) : [...without, g.id]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => {
        const on = value.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            title={g.description}
            onClick={() => toggle(g)}
            className={`badge border px-3 py-1 transition ${
              on ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
