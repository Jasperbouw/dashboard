/**
 * Simple key-value store backed by Supabase.
 * localStorage is kept as a fast cache / offline fallback.
 *
 * Supabase table:
 *   kv_store (key text primary key, value jsonb, updated_at timestamptz)
 */

import { supabase } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

// ── Read ────────────────────────────────────────────────────────────────────
export async function dbGet(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) throw error
    return data?.value ?? null
  } catch {
    // Fall back to localStorage cache
    try {
      const cached = localStorage.getItem(key)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  }
}

// ── Write ───────────────────────────────────────────────────────────────────
export function dbSet(key: string, value: any): void {
  // Write localStorage immediately (fast / offline)
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  // Write Supabase async (no await — fire and forget)
  supabase
    .from('kv_store')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .then(({ error }) => { if (error) console.warn('dbSet error', key, error.message) })
}

// ── Realtime subscription ────────────────────────────────────────────────────
export function dbSubscribe(
  keys: string[],
  callback: (key: string, value: any) => void
): RealtimeChannel {
  const channel = supabase.channel('kv_sync_' + keys.join('_'))
  keys.forEach(key => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kv_store', filter: `key=eq.${key}` },
      (payload: any) => {
        const val = payload.new?.value
        if (val !== undefined) {
          try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
          callback(key, val)
        }
      }
    )
  })
  channel.subscribe()
  return channel
}
