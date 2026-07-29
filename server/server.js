const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_DIR = path.join(__dirname, 'database');
const LEGACY_JSON_DB_FILE = path.join(DB_DIR, 'entries.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'lifelog',
  password: process.env.DB_PASSWORD || 'lifelog',
  database: process.env.DB_NAME || 'lifelog'
});

app.use(cors());
app.use(express.json());

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'application/x-rtf'
]);

const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.doc', '.docx', '.rtf']);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimeAllowed = allowedMimeTypes.has(file.mimetype);
    const extAllowed = allowedExtensions.has(extension);

    if (mimeAllowed || extAllowed) {
      cb(null, true);
      return;
    }

    cb(new Error('Invalid file type. Allowed: PDF, JPG, PNG, TXT, DOC, DOCX, RTF.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS next_session_prompts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        prompts JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_next_session_prompts_user_id_created_at
      ON next_session_prompts (user_id, created_at DESC)
    `);

    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM entries');
    const row = countResult.rows[0];
    const hasLegacyFile = await fs.pathExists(LEGACY_JSON_DB_FILE);

    if (row.count === 0 && hasLegacyFile) {
      const legacyData = await fs.readJson(LEGACY_JSON_DB_FILE);
      const legacyEntries = Array.isArray(legacyData.entries) ? legacyData.entries : [];

      if (legacyEntries.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const entry of legacyEntries) {
            await client.query(
              `INSERT INTO entries (id, title, content, tags, created_at, updated_at)
               VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
              [
                entry.id || uuidv4(),
                String(entry.title || '').trim(),
                String(entry.content || '').trim(),
                JSON.stringify(Array.isArray(entry.tags) ? entry.tags : []),
                entry.createdAt || new Date().toISOString(),
                entry.updatedAt || new Date().toISOString()
              ]
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

function mapEntryRow(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function extractTextFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractTextFromImage(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer);
    return text || '';
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract text from image');
  }
}

async function extractTextFromWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('Word extraction error:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

async function extractTextFromTxt(buffer) {
  try {
    return buffer.toString('utf-8') || '';
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Failed to read text file');
  }
}

async function extractTextFromRtf(buffer) {
  try {
    const raw = buffer.toString('utf-8');
    const destinationWords = new Set([
      'fonttbl',
      'colortbl',
      'stylesheet',
      'info',
      'pict',
      'object',
      'header',
      'headerl',
      'headerr',
      'footer',
      'footerl',
      'footerr',
      'annotation',
      'xmlopen',
      'xmlclose',
      'xmlattrname',
      'xmlattrvalue',
      'generator',
      'themedata',
      'datastore'
    ]);

    const stack = [{ skip: false }];
    let i = 0;
    let out = '';

    while (i < raw.length) {
      const ch = raw[i];

      if (ch === '{') {
        const parent = stack[stack.length - 1];
        stack.push({ skip: parent.skip });
        i += 1;
        continue;
      }

      if (ch === '}') {
        if (stack.length > 1) {
          stack.pop();
        }
        i += 1;
        continue;
      }

      if (ch === '\\') {
        const current = stack[stack.length - 1];
        const next = raw[i + 1];

        if (!next) {
          i += 1;
          continue;
        }

        // Escaped literals
        if (next === '\\' || next === '{' || next === '}') {
          if (!current.skip) {
            out += next;
          }
          i += 2;
          continue;
        }

        // Hex escape: \'hh
        if (next === "'") {
          const hex = raw.slice(i + 2, i + 4);
          if (!current.skip && /^[0-9a-fA-F]{2}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
          }
          i += 4;
          continue;
        }

        // Control symbol
        if (!/[a-zA-Z]/.test(next)) {
          if (next === '~' && !current.skip) {
            out += ' ';
          } else if (next === '*' && stack.length > 0) {
            stack[stack.length - 1].skip = true;
          }
          i += 2;
          continue;
        }

        // Control word and optional numeric argument
        let j = i + 1;
        while (j < raw.length && /[a-zA-Z]/.test(raw[j])) {
          j += 1;
        }
        const word = raw.slice(i + 1, j);

        let num = '';
        if (raw[j] === '-' || /[0-9]/.test(raw[j])) {
          const kStart = j;
          j += 1;
          while (j < raw.length && /[0-9]/.test(raw[j])) {
            j += 1;
          }
          num = raw.slice(kStart, j);
        }

        if (raw[j] === ' ') {
          j += 1;
        }

        if (destinationWords.has(word) && stack.length > 0) {
          stack[stack.length - 1].skip = true;
        }

        if (!current.skip) {
          if (word === 'par' || word === 'line') {
            out += '\n';
          } else if (word === 'tab') {
            out += '\t';
          } else if (word === 'emdash') {
            out += '-';
          } else if (word === 'endash') {
            out += '-';
          } else if (word === 'u' && num) {
            const code = Number(num);
            if (!Number.isNaN(code)) {
              const normalized = code < 0 ? code + 65536 : code;
              out += String.fromCodePoint(normalized);
            }
          }
        }

        i = j;
        continue;
      }

      if (!stack[stack.length - 1].skip) {
        out += ch;
      }
      i += 1;
    }

    return out
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^[;*]+$/.test(line))
      .join('\n')
      .trim();
  } catch (error) {
    console.error('RTF extraction error:', error);
    throw new Error('Failed to extract text from RTF');
  }
}

async function extractTextForFile(file) {
  const mime = file.mimetype;
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (mime === 'application/pdf' || extension === '.pdf') {
    return extractTextFromPdf(file.buffer);
  }

  if (
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    extension === '.jpg' ||
    extension === '.jpeg' ||
    extension === '.png'
  ) {
    return extractTextFromImage(file.buffer);
  }

  if (mime === 'text/plain' || extension === '.txt') {
    return extractTextFromTxt(file.buffer);
  }

  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.doc' ||
    extension === '.docx'
  ) {
    return extractTextFromWord(file.buffer);
  }

  if (
    mime === 'application/rtf' ||
    mime === 'text/rtf' ||
    mime === 'application/x-rtf' ||
    extension === '.rtf'
  ) {
    return extractTextFromRtf(file.buffer);
  }

  return '';
}

async function extractDraftsFromFiles(files) {
  const drafts = [];

  for (const file of files) {
    try {
      const extractedText = await extractTextForFile(file);
      const content = (extractedText || '').trim();

      if (!content) {
        continue;
      }

      drafts.push({
        title: path.parse(file.originalname).name || 'Uploaded Entry',
        content,
        tags: []
      });
    } catch (fileError) {
      console.error(`Error processing file ${file.originalname}:`, fileError);
    }
  }

  return drafts;
}

async function insertEntryDrafts(drafts) {
  const now = new Date().toISOString();
  const createdEntries = [];

  for (const draft of drafts) {
    const title = String(draft.title || '').trim();
    const content = String(draft.content || '').trim();
    const tags = Array.isArray(draft.tags)
      ? draft.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    if (!title || !content) {
      continue;
    }

    const newEntry = {
      id: uuidv4(),
      title,
      content,
      tags,
      createdAt: now,
      updatedAt: now
    };

    await pool.query(
      `INSERT INTO entries (id, title, content, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        newEntry.id,
        newEntry.title,
        newEntry.content,
        JSON.stringify(newEntry.tags),
        newEntry.createdAt,
        newEntry.updatedAt
      ]
    );

    createdEntries.push(newEntry);
  }

  return createdEntries;
}

function normalizeFocusArea(rawFocusArea) {
  return String(rawFocusArea || '')
    .trim()
    .toLowerCase();
}

function generateStructuredPrompts(focusArea) {
  const normalized = normalizeFocusArea(focusArea);

  const promptSets = [
    {
      keywords: ['understand myself', 'self', 'identity', 'self-awareness', 'know myself'],
      prompts: [
        'What are three things you are genuinely proud of right now, and why do they matter to you?',
        'Where do you notice a gap between who you want to be and how you are showing up today?',
        'What patterns keep repeating in your decisions, and what might they be trying to teach you?',
        'What is one area where you want to improve, and what would a small first step look like this week?',
        'If a close friend described your strengths, what would they say that you often ignore?'
      ]
    },
    {
      keywords: ['confidence', 'insecure', 'self-esteem', 'doubt'],
      prompts: [
        'When did you feel most confident in the last month, and what were you doing differently?',
        'What situation triggers self-doubt most often, and what story do you tell yourself there?',
        'Which criticism do you carry that no longer feels fair or useful?',
        'What proof do you already have that you are growing, even if slowly?',
        'What one sentence could you remind yourself of when doubt spikes next time?'
      ]
    },
    {
      keywords: ['work', 'career', 'job', 'professional'],
      prompts: [
        'What part of your current work gives you energy, and what part drains you?',
        'Where did you make meaningful progress recently, even if it was not visible to others?',
        'What skill would most improve your confidence at work over the next 90 days?',
        'Which task are you avoiding, and what is the real reason behind that avoidance?',
        'What would a realistic "better workday" look like tomorrow?'
      ]
    },
    {
      keywords: ['anxiety', 'stress', 'overwhelm', 'burnout'],
      prompts: [
        'What is the loudest stressor in your mind today, and what part of it can you control?',
        'How is stress showing up in your body right now?',
        'What boundary could reduce your mental load this week?',
        'What usually helps you feel grounded when things get overwhelming?',
        'What can you postpone, delegate, or simplify today without guilt?'
      ]
    },
    {
      keywords: ['relationship', 'family', 'friend', 'partner'],
      prompts: [
        'Which relationship feels most important right now, and what does it need from you?',
        'What conversation have you been postponing, and why?',
        'Where are your expectations unclear or unspoken in this relationship?',
        'How do you want to show up in conflict going forward?',
        'What is one appreciation you can express to someone today?'
      ]
    }
  ];

  const matchingSet = promptSets.find((set) =>
    set.keywords.some((keyword) => normalized.includes(keyword))
  );

  const fallbackPrompts = [
    `What feels most important to explore about "${focusArea}" right now?`,
    'What is already working in this area that you can build on?',
    'Where do you feel stuck, and what might be one cause?',
    'What small action would move you one step forward this week?',
    'How do you want to feel about this area one month from now?'
  ];

  const prompts = matchingSet ? matchingSet.prompts : fallbackPrompts;

  return {
    focusArea: focusArea.trim(),
    prompts,
    generatedAt: new Date().toISOString(),
    source: 'lifelog-structured-prompt-engine'
  };
}

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = 'llama3.1:8b';

const DEFAULT_FALLBACK_PROMPTS = [
  'What is one thing from your last entry that you want to revisit or expand on?',
  'What felt unresolved or incomplete when you finished writing?',
  'What is one concrete step you could take this week based on what you wrote?'
];

function clampQuestionCount(rawCount, fallback = 4, min = 1, max = 10) {
  const parsed = Number.parseInt(String(rawCount ?? ''), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function stripMarkdownJsonFences(rawContent) {
  return String(rawContent || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseJsonFromModel(rawContent) {
  const candidate = stripMarkdownJsonFences(rawContent);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function buildEntryHistoryBlock(entries, snippetLimit = 280) {
  if (!entries.length) {
    return '(No previous entries available)';
  }

  return entries
    .map((entry, index) => {
      const snippet = String(entry.content || '')
        .slice(0, snippetLimit)
        .replace(/\s+/g, ' ')
        .trim();
      const ellipsis = String(entry.content || '').length > snippetLimit ? '...' : '';
      return `[Entry ${index + 1} - ${new Date(entry.created_at).toLocaleDateString()}]\nTitle: ${entry.title}\n${snippet}${ellipsis}`;
    })
    .join('\n\n');
}

function inferFocusAreasFromEntries(rows, limit = 6) {
  const stopWords = new Set([
    'about', 'after', 'again', 'along', 'also', 'because', 'being', 'between', 'could', 'daily',
    'during', 'entry', 'every', 'first', 'from', 'going', 'have', 'into', 'just', 'last', 'make',
    'much', 'need', 'over', 'really', 'should', 'some', 'still', 'such', 'than', 'that', 'their',
    'them', 'then', 'there', 'these', 'they', 'this', 'thoughts', 'today', 'want', 'were', 'what',
    'when', 'where', 'which', 'with', 'work', 'would', 'your', 'journal', 'life'
  ]);

  const frequency = new Map();

  for (const row of rows) {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    for (const tag of tags) {
      const cleaned = String(tag || '').trim().toLowerCase();
      if (cleaned.length < 3) continue;
      frequency.set(cleaned, (frequency.get(cleaned) || 0) + 3);
    }

    const titleWords = String(row.title || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    for (const word of titleWords) {
      if (word.length < 4 || stopWords.has(word)) continue;
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  const ranked = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  if (ranked.length === 0) {
    return [
      'Energy and focus',
      'Work and priorities',
      'Relationships and communication',
      'Stress and recovery',
      'Personal growth'
    ].slice(0, limit);
  }

  return ranked;
}

async function generateStructuredPromptsWithOllama(focusArea, recentEntries, questionCount = 5) {
  const safeQuestionCount = clampQuestionCount(questionCount, 5, 3, 8);
  const historyBlock = buildEntryHistoryBlock(recentEntries, 240);

  const systemPrompt = `You are a structured journaling assistant.

Generate exactly ${safeQuestionCount} guided journaling questions for the focus area provided.

Rules:
- Questions must connect to the user's previous entries when possible.
- Questions should be practical, specific, and answerable in writing.
- Keep each question to one sentence.
- Avoid repeating the same wording pattern.
- Output ONLY valid JSON with no extra text:
{"prompts": ["question 1", "question 2"]}`;

  const userPrompt = `Focus area: ${focusArea}\n\nRecent entries:\n${historyBlock}`;

  const fallback = generateStructuredPrompts(focusArea).prompts.slice(0, safeQuestionCount);

  try {
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => '');
      throw new Error(`Ollama returned HTTP ${ollamaRes.status}: ${errText}`);
    }

    const ollamaData = await ollamaRes.json();
    const rawContent = ollamaData?.message?.content || '';
    const parsed = parseJsonFromModel(rawContent);

    if (
      parsed &&
      Array.isArray(parsed.prompts) &&
      parsed.prompts.length >= safeQuestionCount &&
      parsed.prompts.every((p) => typeof p === 'string' && p.trim())
    ) {
      return parsed.prompts.slice(0, safeQuestionCount).map((p) => p.trim());
    }

    return fallback;
  } catch (error) {
    console.error('[generateStructuredPromptsWithOllama] Falling back:', error.message);
    return fallback;
  }
}

async function generateFocusAreasWithOllama(recentEntries, limit = 6) {
  const safeLimit = Math.min(10, Math.max(3, Number.parseInt(limit, 10) || 6));
  const fallback = inferFocusAreasFromEntries(recentEntries, safeLimit);

  if (!recentEntries.length) {
    return fallback;
  }

  const historyBlock = buildEntryHistoryBlock(recentEntries, 200);
  const systemPrompt = `You analyze journal history and produce concise focus areas.

Rules:
- Generate exactly ${safeLimit} focus areas.
- Each focus area should be 2 to 5 words.
- Focus on recurring themes, unresolved concerns, or growth goals.
- Output ONLY valid JSON:
{"focusAreas": ["area 1", "area 2"]}`;

  const userPrompt = `Create ${safeLimit} focus areas from these entries:\n\n${historyBlock}`;

  try {
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama returned HTTP ${ollamaRes.status}`);
    }

    const ollamaData = await ollamaRes.json();
    const rawContent = ollamaData?.message?.content || '';
    const parsed = parseJsonFromModel(rawContent);

    if (parsed && Array.isArray(parsed.focusAreas)) {
      const cleaned = parsed.focusAreas
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, safeLimit);

      if (cleaned.length >= 3) {
        return cleaned;
      }
    }

    return fallback;
  } catch (error) {
    console.error('[generateFocusAreasWithOllama] Falling back:', error.message);
    return fallback;
  }
}

async function generateReflectionQuestionsWithOllama({ fromDate, toDate, questionCount, entries }) {
  const safeQuestionCount = clampQuestionCount(questionCount, 4, 3, 5);
  const historyBlock = buildEntryHistoryBlock(entries, 260);

  const fallback = [
    'What is one pattern you notice in this date range that you want to keep?',
    'Which unfinished thought from this period deserves a concrete next step?',
    'Where did your actions and priorities align well, and where did they drift?',
    'What one change would make the next few days feel more intentional?',
    'Which relationship, habit, or project needs your attention next?'
  ].slice(0, safeQuestionCount);

  const systemPrompt = `You are a reflection coach that creates date-range journaling questions.

Rules:
- Generate exactly ${safeQuestionCount} questions.
- Questions must reference patterns, events, decisions, or recurring topics from the provided entries.
- Keep each question to one sentence.
- Questions should be specific, not generic.
- Output ONLY valid JSON:
{"questions": ["q1", "q2"]}`;

  const userPrompt = `Date range: ${fromDate} to ${toDate}\n\nEntries in range:\n${historyBlock}`;

  try {
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => '');
      throw new Error(`Ollama returned HTTP ${ollamaRes.status}: ${errText}`);
    }

    const ollamaData = await ollamaRes.json();
    const rawContent = ollamaData?.message?.content || '';
    const parsed = parseJsonFromModel(rawContent);

    if (
      parsed &&
      Array.isArray(parsed.questions) &&
      parsed.questions.length >= safeQuestionCount &&
      parsed.questions.every((q) => typeof q === 'string' && q.trim())
    ) {
      return parsed.questions.slice(0, safeQuestionCount).map((q) => q.trim());
    }

    return fallback;
  } catch (error) {
    console.error('[generateReflectionQuestionsWithOllama] Falling back:', error.message);
    return fallback;
  }
}

async function generateNextPrompts(userId, currentEntry) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('userId is required and must be a non-empty string');
  }
  if (
    !currentEntry ||
    typeof currentEntry.id !== 'string' ||
    typeof currentEntry.title !== 'string' ||
    typeof currentEntry.content !== 'string' ||
    !currentEntry.id.trim() ||
    !currentEntry.title.trim() ||
    !currentEntry.content.trim()
  ) {
    throw new Error('currentEntry must have non-empty id, title, and content fields');
  }

  // Pull the last 10 entries (excluding the entry just saved so we can reference it separately)
  let recentEntries = [];
  try {
    const result = await pool.query(
      `SELECT id, title, content, created_at
       FROM entries
       WHERE id != $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [currentEntry.id]
    );
    recentEntries = result.rows;
  } catch (dbError) {
    console.error('[generateNextPrompts] DB query error:', dbError);
    throw new Error('Failed to fetch recent entries from database');
  }

  const historyBlock =
    recentEntries.length > 0
      ? recentEntries
          .map((e, i) => {
            const snippet = e.content.slice(0, 250).replace(/\s+/g, ' ').trim();
            const ellipsis = e.content.length > 250 ? '...' : '';
            return `[Entry ${i + 1} — ${new Date(e.created_at).toLocaleDateString()}]\nTitle: ${e.title}\n${snippet}${ellipsis}`;
          })
          .join('\n\n')
      : '(No previous entries available)';

  const systemPrompt = `You are a journaling assistant that writes SHORT, SPECIFIC reflective questions for a person's NEXT journaling session.

Rules you MUST follow:
- Reference CONCRETE details from the entries provided: specific events, names, decisions, goals, or recurring topics the person actually mentioned.
- Do NOT ask generic therapy questions such as "How did that make you feel?", "What emotions came up?", or "What are you grateful for?".
- Each question must be specific enough that it could only apply to THIS person's actual entries — not a stranger's.
- Prioritize: unresolved items, patterns across entries, follow-ups on things they said they would do, tensions or contradictions, and progress on goals they mentioned.
- Keep each question to ONE sentence.
- Generate exactly 2 or 3 questions — no more, no less.

Output ONLY valid JSON with no extra text, no markdown fences, no explanation:
{"prompts": ["question 1", "question 2", "question 3"]}`;

  const userPrompt = `Here is the journal entry just saved:

Title: ${currentEntry.title}
${currentEntry.content}

---
Here are the user's ${recentEntries.length} most recent previous entries for context:

${historyBlock}

---
Generate 2-3 specific, concrete reflective questions for the user's next journaling session based on the above.`;

  let prompts = DEFAULT_FALLBACK_PROMPTS;

  try {
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => '');
      throw new Error(`Ollama returned HTTP ${ollamaRes.status}: ${errText}`);
    }

    const ollamaData = await ollamaRes.json();
    const rawContent = ollamaData?.message?.content || '';

    // Strip markdown fences if the model wraps the JSON in ```json ... ```
    const jsonString = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr) {
      console.warn('[generateNextPrompts] JSON parse failed, using fallback. Raw:', rawContent);
      parsed = null;
    }

    if (
      parsed &&
      Array.isArray(parsed.prompts) &&
      parsed.prompts.length >= 2 &&
      parsed.prompts.every((p) => typeof p === 'string' && p.trim())
    ) {
      prompts = parsed.prompts.slice(0, 3).map((p) => p.trim());
    } else {
      console.warn('[generateNextPrompts] Unexpected structure from Ollama, using fallback.');
    }
  } catch (ollamaError) {
    console.error('[generateNextPrompts] Ollama call failed, using fallback prompts:', ollamaError.message);
    // Fallback prompts already set above — continue to store them
  }

  try {
    await pool.query(
      `INSERT INTO next_session_prompts (id, user_id, entry_id, prompts, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [uuidv4(), userId.trim(), currentEntry.id, JSON.stringify(prompts)]
    );
  } catch (storeError) {
    console.error('[generateNextPrompts] Failed to store prompts in DB:', storeError);
    // Non-fatal: still return the prompts even if storing failed
  }

  return prompts;
}

app.get('/api/entries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries ORDER BY created_at DESC');
    res.json(result.rows.map(mapEntryRow));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

app.get('/api/entries/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries WHERE id = $1', [req.params.id]);
    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    return res.json(mapEntryRow(row));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const { title, content, tags, userId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const now = new Date().toISOString();
    const newEntry = {
      id: uuidv4(),
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags : [],
      createdAt: now,
      updatedAt: now
    };

    await pool.query(
      `INSERT INTO entries (id, title, content, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        newEntry.id,
        newEntry.title,
        newEntry.content,
        JSON.stringify(newEntry.tags),
        newEntry.createdAt,
        newEntry.updatedAt
      ]
    );

    // Fire-and-forget: generate prompts for the user's next session in background
    const resolvedUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : 'default';
    generateNextPrompts(resolvedUserId, {
      id: newEntry.id,
      title: newEntry.title,
      content: newEntry.content
    }).catch((err) => {
      console.error('[POST /api/entries] Background prompt generation failed:', err.message);
    });

    return res.status(201).json(newEntry);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create entry' });
  }
});

app.put('/api/entries/:id', async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const existingResult = await pool.query('SELECT * FROM entries WHERE id = $1', [req.params.id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const updatedEntry = {
      ...mapEntryRow(existing),
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags : [],
      updatedAt: new Date().toISOString()
    };

    await pool.query(
      `UPDATE entries
       SET title = $1, content = $2, tags = $3::jsonb, updated_at = $4
       WHERE id = $5`,
      [
        updatedEntry.title,
        updatedEntry.content,
        JSON.stringify(updatedEntry.tags),
        updatedEntry.updatedAt,
        updatedEntry.id
      ]
    );

    return res.json(updatedEntry);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update entry' });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM entries WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
});

app.post('/api/entries/extract', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const drafts = await extractDraftsFromFiles(req.files);

    if (drafts.length === 0) {
      return res.status(400).json({ error: 'Failed to extract text from any files' });
    }

    return res.status(200).json({ drafts });
  } catch (error) {
    console.error('Extract error:', error);
    return res.status(500).json({ error: error.message || 'Failed to extract file content' });
  }
});

app.post('/api/entries/import', async (req, res) => {
  try {
    const drafts = Array.isArray(req.body?.drafts) ? req.body.drafts : [];

    if (drafts.length === 0) {
      return res.status(400).json({ error: 'No drafts provided' });
    }

    const createdEntries = await insertEntryDrafts(drafts);

    if (createdEntries.length === 0) {
      return res.status(400).json({ error: 'No valid drafts to import' });
    }

    return res.status(201).json({
      message: `Successfully created ${createdEntries.length} entry/entries`,
      entries: createdEntries
    });
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ error: error.message || 'Failed to import entries' });
  }
});

app.post('/api/entries/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const drafts = await extractDraftsFromFiles(req.files);

    if (drafts.length === 0) {
      return res.status(400).json({ error: 'Failed to extract text from any files' });
    }

    const createdEntries = await insertEntryDrafts(drafts);

    if (createdEntries.length === 0) {
      return res.status(400).json({ error: 'Failed to extract text from any files' });
    }

    return res.status(201).json({
      message: `Successfully created ${createdEntries.length} entry/entries`,
      entries: createdEntries
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload and process files' });
  }
});

app.post('/api/ai/prompts', async (req, res) => {
  try {
    const focusArea = String(req.body?.focusArea || '').trim();
    const questionCount = clampQuestionCount(req.body?.questionCount, 5, 3, 8);

    if (!focusArea) {
      return res.status(400).json({ error: 'Focus area is required' });
    }

    const recentResult = await pool.query(
      `SELECT id, title, content, tags, created_at
       FROM entries
       ORDER BY created_at DESC
       LIMIT 24`
    );

    const prompts = await generateStructuredPromptsWithOllama(
      focusArea,
      recentResult.rows,
      questionCount
    );

    return res.status(200).json({
      focusArea,
      prompts,
      generatedAt: new Date().toISOString(),
      source: 'ollama-structured'
    });
  } catch (error) {
    console.error('AI prompt generation error:', error);
    return res.status(500).json({ error: 'Failed to generate prompts' });
  }
});

app.get('/api/ai/focus-areas', async (req, res) => {
  try {
    const limit = Math.min(10, Math.max(3, Number.parseInt(String(req.query.limit || '6'), 10) || 6));
    const recentResult = await pool.query(
      `SELECT id, title, content, tags, created_at
       FROM entries
       ORDER BY created_at DESC
       LIMIT 40`
    );

    const focusAreas = await generateFocusAreasWithOllama(recentResult.rows, limit);
    return res.status(200).json({
      focusAreas,
      generatedAt: new Date().toISOString(),
      source: 'ollama-focus-areas'
    });
  } catch (error) {
    console.error('[GET /api/ai/focus-areas] Error:', error);
    return res.status(500).json({ error: 'Failed to generate focus areas' });
  }
});

app.post('/api/reflections', async (req, res) => {
  try {
    const today = new Date();
    const defaultTo = today.toISOString().split('T')[0];
    const defaultFromDate = new Date(today);
    defaultFromDate.setDate(defaultFromDate.getDate() - 6);
    const defaultFrom = defaultFromDate.toISOString().split('T')[0];

    const fromDate = String(req.body?.fromDate || defaultFrom);
    const toDate = String(req.body?.toDate || defaultTo);
    const questionCount = clampQuestionCount(req.body?.questionCount, 4, 3, 5);
    const userId = typeof req.body?.userId === 'string' && req.body.userId.trim()
      ? req.body.userId.trim()
      : 'default';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return res.status(400).json({ error: 'fromDate and toDate must be in YYYY-MM-DD format' });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ error: 'fromDate cannot be after toDate' });
    }

    const result = await pool.query(
      `SELECT id, title, content, tags, created_at
       FROM entries
       WHERE created_at::date BETWEEN $1::date AND $2::date
       ORDER BY created_at DESC`,
      [fromDate, toDate]
    );

    const questions = await generateReflectionQuestionsWithOllama({
      fromDate,
      toDate,
      questionCount,
      entries: result.rows
    });

    return res.status(200).json({
      userId,
      fromDate,
      toDate,
      questionCount,
      entryCount: result.rows.length,
      questions,
      generatedAt: new Date().toISOString(),
      source: 'ollama-reflections'
    });
  } catch (error) {
    console.error('[POST /api/reflections] Error:', error);
    return res.status(500).json({ error: 'Failed to generate reflections' });
  }
});

app.get('/api/prompts/next/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await pool.query(
      `SELECT id, user_id, entry_id, prompts, created_at
       FROM next_session_prompts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No prompts found for this user' });
    }

    const row = result.rows[0];
    return res.json({
      id: row.id,
      userId: row.user_id,
      entryId: row.entry_id,
      prompts: Array.isArray(row.prompts) ? row.prompts : [],
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('[GET /api/prompts/next/:userId] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'LifeLog API is running with PostgreSQL' });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    return res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`LifeLog API server running on http://localhost:${PORT}`);
    console.log(`PostgreSQL database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'lifelog'}`);
  });
}

startServer().catch(console.error);
