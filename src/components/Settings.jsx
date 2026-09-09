import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import './Settings.css'
import { pullUserData, pushUserData } from '../utils/syncedStore'

const PROFILE_KEY = 'memoir_profile'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_AVATAR = { type: 'builder', skin: '#e9ae83', hair: 'long', hairColor: '#4a2c24', eyes: 'round', outfit: '#e65d78', backdrop: '#fde2e8' }
const AVATAR_OPTIONS = {
  skin: [{ label: 'Light', value: '#f8d0b2' }, { label: 'Warm', value: '#e9ae83' }, { label: 'Brown', value: '#b97855' }, { label: 'Deep', value: '#70452f' }],
  hairColor: [{ label: 'Black', value: '#1f2937' }, { label: 'Brown', value: '#4a2c24' }, { label: 'Blonde', value: '#d6a756' }, { label: 'Red', value: '#a84e3f' }],
  outfit: [{ label: 'Rose', value: '#e65d78' }, { label: 'Blue', value: '#4f78c5' }, { label: 'Green', value: '#479976' }, { label: 'Gold', value: '#d49a31' }],
  backdrop: [{ label: 'Pink', value: '#fde2e8' }, { label: 'Lavender', value: '#e7e2ff' }, { label: 'Mint', value: '#d9f3e6' }, { label: 'Sky', value: '#dceeff' }]
}

function loadProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY)
    return stored ? JSON.parse(stored) : { weight: '', height: '', goals: [], avatar: DEFAULT_AVATAR }
  } catch {
    return { weight: '', height: '', goals: [], avatar: DEFAULT_AVATAR }
  }
}

function Settings({ background, onBackgroundChange }) {
  const [profile, setProfile] = useState(loadProfile)
  const [newGoal, setNewGoal] = useState('')
  const [imageError, setImageError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    window.dispatchEvent(new Event('memoir-profile-change'))
    pushUserData('profile', profile)
  }, [profile])

  // Pull the latest profile from the server on mount (e.g. saved on another device).
  useEffect(() => {
    pullUserData('profile').then((serverProfile) => {
      if (serverProfile && typeof serverProfile === 'object') {
        setProfile(serverProfile)
      }
    })
  }, [])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [saved])

  const flashSaved = () => setSaved(true)

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    setImageError(null)
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Image is too large. Please choose one under 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      onBackgroundChange(reader.result)
      flashSaved()
    }
    reader.onerror = () => setImageError('Failed to read image. Please try again.')
    reader.readAsDataURL(file)
  }

  const handleRemoveBackground = () => {
    onBackgroundChange(null)
    flashSaved()
  }

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0]
    setImageError(null)
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Image is too large. Please choose one under 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setProfile((prev) => ({ ...prev, avatar: reader.result }))
      flashSaved()
    }
    reader.onerror = () => setImageError('Failed to read image. Please try again.')
    reader.readAsDataURL(file)
  }

  const updateAvatar = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      avatar: { ...DEFAULT_AVATAR, ...(prev.avatar?.type === 'builder' ? prev.avatar : {}), [field]: value }
    }))
    flashSaved()
  }

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddGoal = (e) => {
    e.preventDefault()
    const trimmed = newGoal.trim()
    if (!trimmed) return
    setProfile((prev) => ({ ...prev, goals: [...(prev.goals || []), trimmed] }))
    setNewGoal('')
    flashSaved()
  }

  const handleRemoveGoal = (index) => {
    setProfile((prev) => ({ ...prev, goals: prev.goals.filter((_, i) => i !== index) }))
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <h2>⚙️ Settings</h2>
        <p>Customize your Memoir experience.</p>
        {saved && <span className="settings-saved-badge">✓ Saved</span>}
      </div>

      <div className="settings-card">
        <h3>🖼️ Background</h3>
        <p className="settings-card-hint">Upload a photo to use as your app background.</p>

        {background && (
          <div className="settings-bg-preview" style={{ backgroundImage: `url(${background})` }} />
        )}

        <div className="settings-bg-actions">
          <label className="settings-upload-btn">
            Upload Photo
            <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
          </label>
          {background && (
            <button type="button" className="settings-remove-btn" onClick={handleRemoveBackground}>
              Remove Background
            </button>
          )}
        </div>

        {imageError && <div className="settings-error">⚠️ {imageError}</div>}
      </div>

      <div className="settings-card">
        <h3>👤 Personal Avatar</h3>
        <p className="settings-card-hint">Create an illustrated version of you, or upload a photo. It stays on this device.</p>

        <div className="profile-picture-preview" aria-label="Current profile picture">
          <Avatar avatar={profile.avatar} size="large" />
        </div>

        <div className="avatar-builder" aria-label="Customize your avatar">
          <div className="avatar-builder-row">
            <span>Skin tone</span>
            <div>{AVATAR_OPTIONS.skin.map((option) => <button key={option.label} type="button" className="avatar-swatch" style={{ '--swatch': option.value }} onClick={() => updateAvatar('skin', option.value)} aria-label={option.label} />)}</div>
          </div>
          <div className="avatar-builder-row">
            <span>Hair</span>
            <div className="avatar-text-options">{['short', 'long', 'tied', 'curls'].map((style) => <button key={style} type="button" className={profile.avatar?.hair === style ? 'selected' : ''} onClick={() => updateAvatar('hair', style)}>{style}</button>)}</div>
          </div>
          <div className="avatar-builder-row">
            <span>Hair color</span>
            <div>{AVATAR_OPTIONS.hairColor.map((option) => <button key={option.label} type="button" className="avatar-swatch" style={{ '--swatch': option.value }} onClick={() => updateAvatar('hairColor', option.value)} aria-label={option.label} />)}</div>
          </div>
          <div className="avatar-builder-row">
            <span>Eyes</span>
            <div className="avatar-text-options">{['round', 'happy', 'sparkle'].map((eyes) => <button key={eyes} type="button" className={profile.avatar?.eyes === eyes ? 'selected' : ''} onClick={() => updateAvatar('eyes', eyes)}>{eyes}</button>)}</div>
          </div>
          <div className="avatar-builder-row">
            <span>Outfit</span>
            <div>{AVATAR_OPTIONS.outfit.map((option) => <button key={option.label} type="button" className="avatar-swatch" style={{ '--swatch': option.value }} onClick={() => updateAvatar('outfit', option.value)} aria-label={option.label} />)}</div>
          </div>
        </div>

        <div className="settings-bg-actions">
          <label className="settings-upload-btn">
            Upload Photo
            <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
          </label>
          {profile.avatar && (
            <button type="button" className="settings-remove-btn" onClick={() => setProfile((prev) => ({ ...prev, avatar: DEFAULT_AVATAR }))}>
              Remove Picture
            </button>
          )}
        </div>
      </div>

      <div className="settings-card">
        <h3>📏 Weight / Height</h3>
        <div className="settings-form-row">
          <label htmlFor="settings-weight">Weight (kg)</label>
          <input
            id="settings-weight"
            type="number"
            min="0"
            step="0.1"
            value={profile.weight}
            onChange={(e) => handleProfileChange('weight', e.target.value)}
            onBlur={flashSaved}
            placeholder="e.g. 68"
          />
        </div>
        <div className="settings-form-row">
          <label htmlFor="settings-height">Height (cm)</label>
          <input
            id="settings-height"
            type="number"
            min="0"
            step="0.1"
            value={profile.height}
            onChange={(e) => handleProfileChange('height', e.target.value)}
            onBlur={flashSaved}
            placeholder="e.g. 170"
          />
        </div>
      </div>

      <div className="settings-card">
        <h3>🎯 Goals</h3>
        <form className="settings-goal-form" onSubmit={handleAddGoal}>
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Add a new goal…"
          />
          <button type="submit">Add</button>
        </form>

        {profile.goals && profile.goals.length > 0 ? (
          <ul className="settings-goal-list">
            {profile.goals.map((goal, index) => (
              <li key={`${goal}-${index}`}>
                <span>{goal}</span>
                <button type="button" onClick={() => handleRemoveGoal(index)} aria-label={`Remove goal: ${goal}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-card-hint">No goals yet. Add one above.</p>
        )}
      </div>
    </section>
  )
}

export default Settings
