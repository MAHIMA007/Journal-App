// Generic best-effort background sync between localStorage and the server's per-user data store.
// Reads/writes always go through localStorage first so the UI never blocks on the network;
// the server call happens in the background and merely reconciles state across devices.
import { getCurrentUser } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function pushUserData(key, value) {
  const username = getCurrentUser()
  if (!username) return
  try {
    await fetch(`${API_BASE_URL}/user-data/${encodeURIComponent(username)}/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  } catch {
    // Offline or server unreachable; the local copy is already saved and will resync on the next save.
  }
}

export async function pullUserData(key) {
  const username = getCurrentUser()
  if (!username) return null
  try {
    const response = await fetch(`${API_BASE_URL}/user-data/${encodeURIComponent(username)}/${key}`)
    if (!response.ok) return null
    const body = await response.json()
    return body.value ?? null
  } catch {
    return null
  }
}
