// Server-backed authentication for Memoir, so the same account works across every device.
// NOTE: There's no session token — the current device just remembers who's logged in
// (like most apps, logging in is still per-device), but the account itself lives in Postgres.

const SESSION_KEY = 'memoir_currentUser'
const KNOWN_USER_KEY = 'memoir_known_username'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function parseJsonResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || 'Something went wrong. Please try again.')
  }
  return body
}

// Local hint only (not authoritative) so the login form can default to the right tab.
export function hasAccount() {
  return Boolean(localStorage.getItem(KNOWN_USER_KEY))
}

export function getCurrentUser() {
  return localStorage.getItem(SESSION_KEY)
}

export async function registerUser(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const { username: registeredUsername } = await parseJsonResponse(response)

  localStorage.setItem(SESSION_KEY, registeredUsername)
  localStorage.setItem(KNOWN_USER_KEY, registeredUsername)
  return registeredUsername
}

export async function loginUser(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const { username: loggedInUsername } = await parseJsonResponse(response)

  localStorage.setItem(SESSION_KEY, loggedInUsername)
  localStorage.setItem(KNOWN_USER_KEY, loggedInUsername)
  return loggedInUsername
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY)
}

