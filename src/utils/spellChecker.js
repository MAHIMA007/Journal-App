// Offline, dependency-free spell checker: a bundled word list for lookups plus
// a Norvig-style edit-distance search for suggestions (no network calls).
let dictionaryPromise = null

// The bundled word list is an old formal dictionary (macOS system words) with no
// contractions and none of today's common tech vocabulary - patch both in directly.
const EXTRA_WORDS = new Set([
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't",
  "won't", "wouldn't", "can't", "couldn't", "shouldn't", "mightn't", "mustn't", "needn't", "shan't", "ain't",
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
  "he's", "he'll", "he'd", "she's", "she'll", "she'd", "it's", "it'll",
  "we're", "we've", "we'll", "we'd", "they're", "they've", "they'll", "they'd",
  "that's", "that'll", "there's", "there'll", "here's", "what's", "what're", "who's", "who'll",
  "let's", "y'all", "o'clock",
  'email', 'emails', 'emailed', 'emailing', 'wifi', 'app', 'apps', 'blog', 'blogs', 'blogging',
  'smartphone', 'smartphones', 'laptop', 'laptops', 'internet', 'website', 'websites', 'online',
  'selfie', 'selfies', 'hashtag', 'hashtags', 'emoji', 'emojis', 'podcast', 'podcasts', 'streaming',
  'bluetooth', 'login', 'logout', 'username', 'usernames', 'password', 'passwords', 'okay',
  // Common irregular verb/pronoun forms the suffix-stripping below can't derive from a base word.
  'has', 'had', 'having', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
  'does', 'did', 'done', 'goes', 'went', 'gone', 'said', 'says', 'saying',
  'gets', 'got', 'gotten', 'makes', 'made', 'takes', 'took', 'taken', 'gives', 'gave', 'given',
  'knows', 'knew', 'known', 'sees', 'saw', 'seen', 'comes', 'came', 'thinks', 'thought',
  'feels', 'felt', 'tells', 'told', 'becomes', 'became', 'i',
])

function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch('/dictionaries/words_en.txt')
      .then((res) => res.text())
      .then((text) => {
        const dictionary = new Set(text.split('\n').map((w) => w.trim()).filter(Boolean))
        EXTRA_WORDS.forEach((word) => dictionary.add(word))
        return dictionary
      })
      .catch(() => new Set(EXTRA_WORDS))
  }
  return dictionaryPromise
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

// Every word one edit (deletion/transposition/substitution/insertion) away from `word`.
function edits1(word) {
  const splits = []
  for (let i = 0; i <= word.length; i += 1) {
    splits.push([word.slice(0, i), word.slice(i)])
  }

  const candidates = new Set()
  splits.forEach(([left, right]) => {
    if (right) candidates.add(left + right.slice(1)) // delete
    if (right.length > 1) candidates.add(left + right[1] + right[0] + right.slice(2)) // transpose
    if (right) LETTERS.forEach((c) => candidates.add(left + c + right.slice(1))) // replace
    LETTERS.forEach((c) => candidates.add(left + c + right)) // insert
  })
  return candidates
}

// Skip things that aren't really spell-checkable words: short tokens, numbers, ALL-CAPS acronyms.
export function isWordSpellable(word) {
  return /^[a-zA-Z']{2,}$/.test(word) && word !== word.toUpperCase()
}

// The bundled dictionary only lists base/lemma forms (no plurals, past tense, -ing, etc.),
// so a regular inflection like "wanted" or "things" won't be found directly. Undo common
// English suffixes to recover a candidate base form and check that instead.
function possibleBaseForms(word) {
  const candidates = new Set()

  if (word.endsWith('ies') && word.length > 3) candidates.add(word.slice(0, -3) + 'y')
  if (word.endsWith('es') && word.length > 2) candidates.add(word.slice(0, -2))
  if (word.endsWith('s') && word.length > 1) candidates.add(word.slice(0, -1))

  if (word.endsWith('ied') && word.length > 3) candidates.add(word.slice(0, -3) + 'y')
  if (word.endsWith('ed') && word.length > 2) {
    const stem = word.slice(0, -2)
    candidates.add(stem)
    candidates.add(`${stem}e`)
    if (stem.length > 1 && stem.at(-1) === stem.at(-2)) candidates.add(stem.slice(0, -1))
  }

  if (word.endsWith('ing') && word.length > 3) {
    const stem = word.slice(0, -3)
    candidates.add(stem)
    candidates.add(`${stem}e`)
    if (stem.length > 1 && stem.at(-1) === stem.at(-2)) candidates.add(stem.slice(0, -1))
  }

  if (word.endsWith('ily') && word.length > 3) candidates.add(word.slice(0, -3) + 'y')
  if (word.endsWith('ly') && word.length > 2) candidates.add(word.slice(0, -2))

  if (word.endsWith('iest') && word.length > 4) candidates.add(word.slice(0, -4) + 'y')
  if (word.endsWith('ier') && word.length > 3) candidates.add(word.slice(0, -3) + 'y')
  if (word.endsWith('est') && word.length > 3) candidates.add(word.slice(0, -3))
  if (word.endsWith('er') && word.length > 2) candidates.add(word.slice(0, -2))

  return [...candidates].filter((c) => c.length > 1)
}

export async function checkWord(word) {
  const dictionary = await loadDictionary()
  const lower = word.toLowerCase()
  if (dictionary.has(lower)) return true
  return possibleBaseForms(lower).some((form) => dictionary.has(form))
}

export async function suggestWord(word, maxSuggestions = 5) {
  const dictionary = await loadDictionary()
  const lower = word.toLowerCase()
  if (dictionary.has(lower)) return []

  const candidates = new Set()
  const nearby = edits1(lower)
  nearby.forEach((candidate) => {
    if (dictionary.has(candidate)) candidates.add(candidate)
  })

  if (candidates.size === 0) {
    // Nothing one edit away matched - widen the search to two edits.
    for (const mid of nearby) {
      edits1(mid).forEach((candidate) => {
        if (dictionary.has(candidate)) candidates.add(candidate)
      })
    }
  }

  const wasCapitalized = word[0] && word[0] === word[0].toUpperCase()
  return [...candidates]
    .sort((a, b) => Math.abs(a.length - lower.length) - Math.abs(b.length - lower.length) || a.localeCompare(b))
    .slice(0, maxSuggestions)
    .map((w) => (wasCapitalized ? w[0].toUpperCase() + w.slice(1) : w))
}
