import { useState, useEffect } from 'react'
import './App.css'
import JournalEntry from './components/JournalEntry'
import EntryForm from './components/EntryForm'
import SearchBar from './components/SearchBar'
import EntryList from './components/EntryList'
import HabitCalendar from './components/HabitCalendar'
import FileUpload from './components/FileUpload'
import AudioRecorder from './components/AudioRecorder'
import StructuredJournal from './components/StructuredJournal'
import ReflectionsPanel from './components/ReflectionsPanel'
import apiService from './services/apiService'

function parsePath(pathname) {
  if (pathname === '/' || pathname === '') {
    return { section: 'home' }
  }

  if (pathname === '/journal') {
    return { section: 'journal', journalView: 'chooser' }
  }

  if (pathname === '/journal/dump') {
    return { section: 'journal', journalView: 'dump', view: 'list' }
  }

  if (pathname === '/journal/dump/new') {
    return { section: 'journal', journalView: 'dump', view: 'new' }
  }

  if (pathname === '/journal/dump/entries') {
    return { section: 'journal', journalView: 'dump', view: 'all-entries' }
  }

  if (pathname === '/journal/structured') {
    return { section: 'journal', journalView: 'structured' }
  }

  if (pathname === '/journal/structured/entries') {
    return { section: 'journal', journalView: 'structured', view: 'all-entries' }
  }

  const entryMatch = pathname.match(/^\/journal\/dump\/entry\/([^/]+)$/)
  if (entryMatch) {
    return {
      section: 'journal',
      journalView: 'dump',
      view: 'entry',
      entryId: decodeURIComponent(entryMatch[1]),
    }
  }

  return { section: 'home' }
}

// Helper function to detect if entry is from Structured mode
function isStructuredEntry(entry) {
  // Check content first - "Focus Area:" is the clearest indicator
  if (entry.content && entry.content.toLowerCase().includes('focus area:')) {
    return true
  }
  
  // Check title for "Structured:" prefix
  if (entry.title && entry.title.toLowerCase().includes('structured:')) {
    return true
  }

  // Check tags for structured-related tags
  if (entry.tags && Array.isArray(entry.tags)) {
    const structuredTags = ['structured', 'ai-prompts', 'guided-entry']
    if (entry.tags.some(tag => structuredTags.includes(tag.toLowerCase()))) {
      return true
    }
  }

  return false
}

function App() {
  const [entries, setEntries] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [currentSection, setCurrentSection] = useState(() => parsePath(window.location.pathname).section)
  const [currentJournalView, setCurrentJournalView] = useState(() => parsePath(window.location.pathname).journalView || 'chooser')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load entries from API on component mount
  useEffect(() => {
    loadEntries()
  }, [])

  useEffect(() => {
    const applyRoute = (route) => {
      setCurrentSection(route.section)
      setCurrentJournalView(route.journalView || 'chooser')

      if (route.section === 'home') {
        setSelectedEntry(null)
        setIsCreating(false)
        return
      }

      if (route.journalView !== 'dump') {
        setSelectedEntry(null)
        setIsCreating(false)
        return
      }

      if (route.view === 'new') {
        setSelectedEntry(null)
        setIsCreating(true)
        return
      }

      if (route.view === 'all-entries') {
        setSelectedEntry(null)
        setIsCreating(false)
        return
      }

      if (route.view === 'entry') {
        const matchingEntry = entries.find((entry) => entry.id === route.entryId)
        setSelectedEntry(matchingEntry || null)
        setIsCreating(false)
        return
      }

      setSelectedEntry(null)
      setIsCreating(false)
    }

    const applyRouteFromLocation = () => {
      const route = parsePath(window.location.pathname)
      applyRoute(route)
    }

    applyRouteFromLocation()
    window.addEventListener('popstate', applyRouteFromLocation)

    return () => {
      window.removeEventListener('popstate', applyRouteFromLocation)
    }
  }, [entries])

  const navigateTo = (path, replace = false) => {
    const route = parsePath(path)

    if (window.location.pathname === path) {
      setCurrentSection(route.section)
      setCurrentJournalView(route.journalView || 'chooser')
      return
    }

    if (replace) {
      window.history.replaceState({}, '', path)
    } else {
      window.history.pushState({}, '', path)
    }

    setCurrentSection(route.section)
    setCurrentJournalView(route.journalView || 'chooser')

    if (route.section === 'home') {
      setSelectedEntry(null)
      setIsCreating(false)
      return
    }

    if (route.journalView !== 'dump') {
      setSelectedEntry(null)
      setIsCreating(false)
      return
    }

    if (route.view === 'new') {
      setSelectedEntry(null)
      setIsCreating(true)
      return
    }

    if (route.view === 'all-entries') {
      setSelectedEntry(null)
      setIsCreating(false)
      return
    }

    if (route.view === 'entry') {
      const matchingEntry = entries.find((entry) => entry.id === route.entryId)
      setSelectedEntry(matchingEntry || null)
      setIsCreating(false)
      return
    }

    setSelectedEntry(null)
    setIsCreating(false)
  }

  const loadEntries = async () => {
    try {
      setLoading(true)
      setError(null)
      const fetchedEntries = await apiService.getEntries()
      setEntries(fetchedEntries)
    } catch (error) {
      console.error('Failed to load entries:', error)
      setError('Failed to load entries. Please make sure the server is running.')
      // Fallback to localStorage if API fails
      const savedEntries = localStorage.getItem('lifelogEntries')
      if (savedEntries) {
        setEntries(JSON.parse(savedEntries))
      }
    } finally {
      setLoading(false)
    }
  }

  const createEntry = async (entryData) => {
    try {
      const newEntry = await apiService.createEntry(entryData)
      setEntries([newEntry, ...entries])
      setIsCreating(false)
      navigateTo('/journal/dump')
      setError(null)
    } catch (error) {
      console.error('Failed to create entry:', error)
      setError('Failed to create entry. Please try again.')
    }
  }

  const updateEntry = async (entryId, updatedData) => {
    try {
      const updatedEntry = await apiService.updateEntry(entryId, updatedData)
      setEntries(entries.map(entry => 
        entry.id === entryId ? updatedEntry : entry
      ))
      setSelectedEntry(null)
      navigateTo('/journal/dump')
      setError(null)
    } catch (error) {
      console.error('Failed to update entry:', error)
      setError('Failed to update entry. Please try again.')
    }
  }

  const deleteEntry = async (entryId) => {
    try {
      await apiService.deleteEntry(entryId)
      setEntries(entries.filter(entry => entry.id !== entryId))
      setSelectedEntry(null)
      navigateTo('/journal/dump')
      setError(null)
    } catch (error) {
      console.error('Failed to delete entry:', error)
      setError('Failed to delete entry. Please try again.')
    }
  }

  const filteredEntries = entries.filter(entry => {
    // Filter by search term
    const matchesSearch = entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))

    // Filter by selected date
    if (selectedDate) {
      const entryDate = new Date(entry.createdAt).toISOString().split('T')[0]
      const selectedDateStr = selectedDate.toISOString().split('T')[0]
      return matchesSearch && entryDate === selectedDateStr
    }

    return matchesSearch
  })

  const handleDateClick = (date) => {
    setSelectedDate(prevDate => {
      const newDate = date.toISOString().split('T')[0]
      const prevDateStr = prevDate ? prevDate.toISOString().split('T')[0] : null
      return newDate === prevDateStr ? null : date
    })
  }

  const openCreateEntry = () => {
    setSelectedEntry(null)
    setIsCreating(true)
    navigateTo('/journal/dump/new')
  }

  const openEntryDetails = (entry) => {
    setSelectedEntry(entry)
    setIsCreating(false)
    navigateTo(`/journal/dump/entry/${entry.id}`)
  }

  const backToEntries = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    navigateTo('/journal/dump')
  }

  const openJournalHome = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    setSelectedDate(null)
    navigateTo('/journal')
  }

  const openDumpJournal = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    setSelectedDate(null)
    navigateTo('/journal/dump')
  }

  const openStructuredJournal = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    setSelectedDate(null)
    navigateTo('/journal/structured')
  }

  const openDumpEntriesView = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    navigateTo('/journal/dump/entries')
  }

  const openStructuredEntriesView = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    navigateTo('/journal/structured/entries')
  }

  const goToLanding = () => {
    setSelectedEntry(null)
    setIsCreating(false)
    navigateTo('/')
  }

  const handleFileUpload = (uploadedEntries) => {
    setEntries([...uploadedEntries, ...entries])
    setError(null)
  }

  const handleAudioTranscription = async (transcriptionData) => {
    try {
      const newEntry = await apiService.createEntry(transcriptionData)
      setEntries([newEntry, ...entries])
      setError(null)
      // Show success message
      console.log('Audio entry created successfully')
    } catch (error) {
      console.error('Failed to create audio entry:', error)
      setError('Failed to save audio entry. Please try again.')
    }
  }

  const handleStructuredDraftSave = async (draftEntry) => {
    try {
      const newEntry = await apiService.createEntry(draftEntry)
      setEntries([newEntry, ...entries])
      setError(null)
      return newEntry
    } catch (saveError) {
      console.error('Failed to save structured draft:', saveError)
      setError('Failed to save structured draft. Please try again.')
      throw saveError
    }
  }

  const handleStructuredUpload = (uploadedEntries) => {
    setEntries([...uploadedEntries, ...entries])
    setError(null)
  }

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>📖 LifeLog</h1>
          <p>Your personal digital journal</p>
        </header>
        <main className="app-main">
          <div className="loading-state">
            <div className="loading-spinner">⏳</div>
            <h3>Loading your entries...</h3>
            <p>Please wait while we fetch your journal entries.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📖 LifeLog</h1>
        <p>{currentSection === 'home' ? 'Choose your workspace' : 'Your personal digital journal'}</p>
        {currentSection === 'journal' && (
          <div className="section-switch-group">
            <button className="section-switch-btn" onClick={goToLanding}>
              ← Back to Spaces
            </button>
            {currentJournalView !== 'chooser' && (
              <button className="section-switch-btn section-switch-btn-secondary" onClick={openJournalHome}>
                ← Journal Spaces
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={loadEntries} className="retry-btn">Retry</button>
          </div>
        )}
      </header>

      <main className="app-main">
        {currentSection === 'home' ? (
          <section className="section-selector">
            <div className="section-selector-copy">
              <span className="section-selector-kicker">Workspace Select</span>
              <h2>Choose where you want to work today</h2>
              <p>
                Journal opens the full LifeLog experience with uploads, voice dictation,
                search, calendar tracking, and entry management. Habit Tracking is reserved
                for a dedicated view later.
              </p>
            </div>

            <div className="section-grid">
              <article className="section-card section-card-muted">
                <span className="section-card-icon">✓</span>
                <div className="section-card-body">
                  <p className="section-card-label">Coming Later</p>
                  <h3>Habit Tracking</h3>
                  <p>
                    Placeholder slot for the future habit-focused dashboard.
                  </p>
                </div>
                <button className="section-card-button section-card-button-disabled" disabled>
                  Link pending
                </button>
              </article>

              <article className="section-card section-card-active">
                <span className="section-card-icon">📓</span>
                <div className="section-card-body">
                  <p className="section-card-label">Available Now</p>
                  <h3>Journal</h3>
                  <p>
                    Open the full LifeLog journal with file import, voice dictation, search,
                    calendar review, and entry editing.
                  </p>
                </div>
                <button className="section-card-button" onClick={openJournalHome}>
                  Open Journal
                </button>
              </article>

              <article className="section-card section-card-calendar">
                <div className="section-card-body">
                  <p className="section-card-label">Period & Habit Tracker</p>
                  <h3>Calendar</h3>
                  <p>
                    Track journaling activity and period dates together.
                  </p>
                </div>
                <div className="home-calendar-wrap">
                  <HabitCalendar
                    entries={entries}
                    compact
                    showPeriodTracker
                  />
                </div>
              </article>
            </div>
          </section>
        ) : currentJournalView === 'chooser' ? (
          <section className="journal-dashboard">
            <div className="journal-dashboard-header">
              <div>
                <span className="section-selector-kicker">Journal Dashboard</span>
                <h2>All Journal Entries</h2>
                <p>
                  Start a new entry in the mode you want, then review everything in one place.
                </p>
              </div>
            </div>

            <div className="journal-dashboard-list">
              {(() => {
                const dumpEntries = entries.filter(e => !isStructuredEntry(e))
                const structuredEntries = entries.filter(e => isStructuredEntry(e))

                return (
                  <>
                    {dumpEntries.length > 0 && (
                      <div className="entry-category">
                        <div className="entry-category-header">
                          <h3>✍️ Dump Entries ({dumpEntries.length})</h3>
                          {dumpEntries.length > 2 && (
                            <button
                              className="see-more-btn"
                              onClick={openDumpEntriesView}
                            >
                              See all ({dumpEntries.length}) →
                            </button>
                          )}
                        </div>
                        <EntryList
                          entries={dumpEntries.slice(0, 2)}
                          onSelectEntry={openEntryDetails}
                        />
                      </div>
                    )}

                    {structuredEntries.length > 0 && (
                      <div className="entry-category">
                        <div className="entry-category-header">
                          <h3>🧭 Structured Entries ({structuredEntries.length})</h3>
                          {structuredEntries.length > 2 && (
                            <button
                              className="see-more-btn"
                              onClick={openStructuredEntriesView}
                            >
                              See all ({structuredEntries.length}) →
                            </button>
                          )}
                        </div>
                        <EntryList
                          entries={structuredEntries.slice(0, 2)}
                          onSelectEntry={openEntryDetails}
                        />
                      </div>
                    )}

                    {dumpEntries.length === 0 && structuredEntries.length === 0 && (
                      <div className="empty-state">
                        <p>No entries yet. Create your first entry to get started!</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="journal-mode-cards">
              <article className="section-card section-card-active">
                <span className="section-card-icon">✍️</span>
                <div className="section-card-body">
                  <p className="section-card-label">Manual Entry</p>
                  <h3>Dump</h3>
                  <p>
                    Freeform writing with uploads, voice notes, search, and calendar review.
                  </p>
                </div>
                <button className="section-card-button" onClick={openDumpJournal}>
                  Open Dump Workspace
                </button>
              </article>

              <article className="section-card section-card-muted">
                <span className="section-card-icon">🧭</span>
                <div className="section-card-body">
                  <p className="section-card-label">Guided Entry</p>
                  <h3>Structured</h3>
                  <p>
                    Focus-area prompts with form-style question responses and direct save.
                  </p>
                </div>
                <button className="section-card-button" onClick={openStructuredJournal}>
                  Open Structured Workspace
                </button>
              </article>
            </div>

            <ReflectionsPanel />
          </section>
        ) : currentJournalView === 'structured' ? (
          <StructuredJournal
            onCreateEntry={handleStructuredDraftSave}
            onUploadEntries={handleStructuredUpload}
          />
        ) : currentJournalView === 'dump' && parsePath(window.location.pathname).view === 'all-entries' ? (
          <section className="journal-all-entries">
            <div className="all-entries-header">
              <button className="back-btn" onClick={openJournalHome}>
                ← Back to Dashboard
              </button>
              <div>
                <h2>✍️ All Dump Entries</h2>
                <p>All your freeform entries in one place</p>
              </div>
            </div>
            <EntryList
              entries={entries.filter(e => !isStructuredEntry(e))}
              onSelectEntry={openEntryDetails}
            />
          </section>
        ) : currentJournalView === 'structured' && parsePath(window.location.pathname).view === 'all-entries' ? (
          <section className="journal-all-entries">
            <div className="all-entries-header">
              <button className="back-btn" onClick={openJournalHome}>
                ← Back to Dashboard
              </button>
              <div>
                <h2>🧭 All Structured Entries</h2>
                <p>All your guided journaling entries in one place</p>
              </div>
            </div>
            <EntryList
              entries={entries.filter(e => isStructuredEntry(e))}
              onSelectEntry={openEntryDetails}
            />
          </section>
        ) : selectedEntry ? (
          <JournalEntry
            entry={selectedEntry}
            onUpdate={updateEntry}
            onDelete={deleteEntry}
            onBack={backToEntries}
          />
        ) : isCreating ? (
          <EntryForm
            onSave={createEntry}
            onCancel={backToEntries}
          />
        ) : (
          <>
            <div className="app-content app-content-standalone">
                <div className="dump-header-sidebar">
                  <button className="back-btn" onClick={openJournalHome}>
                    ← Journal Dashboard
                  </button>
                </div>
                <ReflectionsPanel />
                <FileUpload onUpload={handleFileUpload} />
                <AudioRecorder onTranscriptionComplete={handleAudioTranscription} />
                <div className="app-controls">
                  <SearchBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                  />
                  <button
                    className="new-entry-btn"
                    onClick={openCreateEntry}
                  >
                    ✏️ New Entry
                  </button>
                </div>
                {selectedDate && (
                  <div className="date-filter-badge">
                    📅 Showing entries for {selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                    <button 
                      onClick={() => setSelectedDate(null)}
                      className="clear-date-filter"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
