import { useCallback, useEffect, useRef, useState } from 'react'
import { isWordSpellable, checkWord, suggestWord } from '../utils/spellChecker'
import './SpellCheckTextarea.css'

// Splits text into word tokens with their character offsets, e.g. for "hi wrold" -> [{word:'hi',start:0,end:2}, {word:'wrold',start:3,end:8}]
function tokenize(text) {
  const tokens = []
  const regex = /[A-Za-z']+/g
  let match = regex.exec(text)
  while (match !== null) {
    let word = match[0]
    let start = match.index
    let end = match.index + word.length

    // Strip leading/trailing quote marks (e.g. 'quoted') but keep contraction apostrophes like "don't".
    while (word.startsWith("'")) {
      word = word.slice(1)
      start += 1
    }
    while (word.endsWith("'")) {
      word = word.slice(0, -1)
      end -= 1
    }

    if (word) tokens.push({ word, start, end })
    match = regex.exec(text)
  }
  return tokens
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Likely a proper noun (name/brand) rather than a typo: capitalized, but not at the
// start of a sentence, so it's not just normal sentence-initial capitalization.
function isLikelyProperNoun(text, token) {
  if (!/^[A-Z]/.test(token.word)) return false

  let i = token.start - 1
  while (i >= 0 && /\s/.test(text[i])) i -= 1
  if (i < 0) return false

  return !/[.!?]/.test(text[i])
}

// Drop-in replacement for a plain <textarea> that underlines misspelled words
// and offers click-to-fix suggestions, similar to Word/Google Docs.
function SpellCheckTextarea({ value, onChange, className = '', ...rest }) {
  const [misspelled, setMisspelled] = useState([])
  const [popup, setPopup] = useState(null)
  const textareaRef = useRef(null)
  const backdropRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const tokens = tokenize(value)
        .filter((t) => isWordSpellable(t.word))
        .filter((t) => !isLikelyProperNoun(value, t))
      const results = await Promise.all(tokens.map(async (t) => ({ ...t, ok: await checkWord(t.word) })))
      if (!cancelled) setMisspelled(results.filter((t) => !t.ok))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value])

  const closePopup = useCallback(() => setPopup(null), [])

  useEffect(() => {
    if (!popup) return undefined
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.spellcheck-popup')) closePopup()
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [popup, closePopup])

  const handleClick = async (e) => {
    const index = e.target.selectionStart
    const hit = misspelled.find((t) => index >= t.start && index <= t.end)
    if (!hit) {
      closePopup()
      return
    }

    const suggestions = await suggestWord(hit.word)
    const containerRect = containerRef.current.getBoundingClientRect()
    setPopup({
      ...hit,
      suggestions,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top + 18,
    })
  }

  const applySuggestion = (suggestion) => {
    if (!popup) return
    onChange(value.slice(0, popup.start) + suggestion + value.slice(popup.end))
    closePopup()
  }

  const handleScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const renderHighlighted = () => {
    if (!misspelled.length) return escapeHtml(value)

    let result = ''
    let cursor = 0
    misspelled
      .slice()
      .sort((a, b) => a.start - b.start)
      .forEach(({ start, end }) => {
        result += escapeHtml(value.slice(cursor, start))
        result += `<mark class="spellcheck-error">${escapeHtml(value.slice(start, end))}</mark>`
        cursor = end
      })
    result += escapeHtml(value.slice(cursor))
    return result
  }

  return (
    <div className="spellcheck-container" ref={containerRef}>
      <div
        className="spellcheck-backdrop"
        ref={backdropRef}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: `${renderHighlighted()}<br/>` }}
      />
      <textarea
        {...rest}
        ref={textareaRef}
        className={`spellcheck-textarea ${className}`}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onClick={handleClick}
        onScroll={handleScroll}
      />
      {popup && (
        <div className="spellcheck-popup" style={{ left: popup.x, top: popup.y }}>
          {popup.suggestions.length ? (
            popup.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => applySuggestion(s)}>{s}</button>
            ))
          ) : (
            <span className="spellcheck-popup-empty">No suggestions</span>
          )}
        </div>
      )}
    </div>
  )
}

export default SpellCheckTextarea
