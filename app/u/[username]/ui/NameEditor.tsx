// aiflix/app/u/[username]/ui/NameEditor.tsx
'use client';
import { useState } from 'react';

export default function NameEditor({ initialFirst, initialLast }:{
  initialFirst: string; initialLast: string;
}) {
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/name', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ first_name: first, last_name: last }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ошибка сохранения');
    } catch (e:any) {
      alert(e?.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-medium">Настройка публичного профиля</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded-md border px-3 py-2" placeholder="Имя"
               value={first} onChange={(e)=>setFirst(e.target.value)} />
        <input className="rounded-md border px-3 py-2" placeholder="Фамилия"
               value={last} onChange={(e)=>setLast(e.target.value)} />
      </div>
      <div className="mt-3">
        <button onClick={save} disabled={saving}
                className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60">
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
