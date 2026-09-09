import { useState } from 'react'
import { hasAccount, loginUser, registerUser } from '../utils/auth'
import './Login.css'

function Login({ onLogin }) {
  const [mode, setMode] = useState(() => (hasAccount() ? 'login' : 'signup'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!username.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)
      const loggedInUser = mode === 'signup'
        ? await registerUser(username.trim(), password)
        : await loginUser(username.trim(), password)
      onLogin(loggedInUser)
    } catch (submitError) {
      setError(submitError.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>📖 Memoir</h1>
        <p className="login-subtitle">
          {mode === 'signup' ? 'Create an account to get started' : 'Welcome back, log in to continue'}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {mode === 'signup' && (
            <>
              <label htmlFor="login-confirm-password">Confirm Password</label>
              <input
                id="login-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
            </>
          )}

          {error && <div className="login-error">⚠️ {error}</div>}

          <button type="submit" className="login-submit-btn" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <button
          type="button"
          className="login-mode-toggle"
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup')
            setError(null)
          }}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}

export default Login
