'use client'
import { supabase } from '@/lib/supabase-client'
import { useState } from 'react'

export default function AuthButton() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setLoading(false)
    if (!error) setSent(true)
    else alert(error.message)
  }

  async function signOut() { await supabase.auth.signOut() }

  return (
    <div className="flex items-center gap-2">
      {!sent ? (
        <>
          <input className="border rounded px-2 py-1" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <button onClick={signIn} disabled={loading} className="px-3 py-1 rounded bg-black text-white disabled:opacity-50">{loading?'Отправка…':'Войти'}</button>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-600">Проверь почту для входа</span>
          <button onClick={signOut} className="px-3 py-1 rounded border">Выйти</button>
        </>
      )}
    </div>
  )
}
