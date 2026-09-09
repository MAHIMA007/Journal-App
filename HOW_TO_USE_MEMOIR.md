# Memoir — The Friendly Diary App 📖✨

## What is Memoir?
Memoir is like a magic diary. You write down your day, and a friendly
robot helper reads it and tells you nice, smart things about yourself.

## How to get in
1. Open the app.
2. First time? Type a name and a password, click "Sign Up."
3. Already have one? Type the same name and password, click "Log in."

## The picture on the side (Sidebar)
- 🏠 Home = your starting room
- 📖 Journal = where you write
- 🤖 AI Coach = your robot friend
- ⚙️ Settings = make it "you"

## Writing in your diary
1. Click 📖 Journal.
2. Pick "Quick Entry" (just type) or "Guided" (robot asks questions).
3. Type what happened today.
4. Click Save. Done! 🎉

## Talking instead of typing
- Click the microphone button 🎤.
- Talk like you're telling a friend about your day.
- Click "Done Speaking."
- Read it, fix any mistakes, click Save.

## Uploading old notes
- Click the upload/paperclip button.
- Drop in a photo, PDF, or Word file.
- Memoir reads the words inside for you and turns it into an entry.

## Your robot friend (AI Coach)
1. Click 🤖 AI Coach.
2. Type a question like "How have I been feeling?"
3. Or press a magic button:
   - 📊 Analyze Mood
   - 🔄 Find Patterns
   - 💡 Generate Insights
   - 🎯 Track Goals
4. The robot reads your diary and answers kindly.

## Habits and to-dos
- ✅ Todo List: little tasks for today, tick them off.
- 🔥 Habit Tracker: pick 3 habits (like "drink water"), tap the day you did it.
- 🗓️ Calendar: colors get brighter the more you journal — like a treasure map!

## Making it "you" (Settings)
- 🖼️ Upload a background photo.
- 👤 Build your own cartoon face (skin, hair, eyes, outfit) — or upload a real photo.
- 📏 Add your weight/height (optional, just for you).
- 🎯 Write down your goals.

## Every day when you open Memoir
You'll see a greeting like:
> "Welcome back [Name], you are brave."

The word changes every day — it's a little gift for you. 💛

## Is it safe?
- Everything stays on your own computer.
- No company sees your diary.
- The robot brain (Ollama) runs locally — not on the internet.

## If something looks broken
- Robot not answering? Make sure Ollama is turned on.
- Page won't load? Ask a grown-up to run `docker compose up -d`.

---

## 🧑‍💻 Grown-up notes (technical appendix)

**Verified working (2026-08-29):**
- `GET/POST /api/entries` — create and list journal entries
- `POST /api/ai/chat` — tool-calling agent, now uses the real logged-in `userId`
- `POST /api/ai/moods` + `GET /api/ai/moods?days=30` — mood persisted in Postgres, average score computed
- `POST /api/ai/daily-summary` — generated, persisted, and Redis-cached
- `POST /api/ai/search` — returns matches (see limitation below)
- Startup auto-indexing — server log shows `Indexed N existing entries for semantic search`

**Known limitation:** embeddings are SHA-256 hash-based, not true semantic
vectors, so similarity scores are low even for clearly related text (observed
`0.0065` for an obvious match). To get real semantic search, pull the
embedding model and switch `embeddingService` to call it:
```bash
docker compose exec ollama ollama pull nomic-embed-text
```
Then update `embeddingService.hashToEmbedding` to call Ollama's `/api/embed`
endpoint with `nomic-embed-text` instead of hashing text locally.
