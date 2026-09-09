"""
Generates Memoir_Complete_Guide.docx — a full explanation of the Memoir app
covering architecture, tech stack, features, API reference, database schema,
AI/RAG pipeline, deployment, security notes, interview Q&A, and a glossary.
"""
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ASSETS = "/Users/mahimaa/Personal/docs_assets"
OUT = "/Users/mahimaa/Personal/Memoir_Complete_Guide.docx"

PURPLE = RGBColor(0x66, 0x4b, 0xa2)
INDIGO = RGBColor(0x43, 0x38, 0xca)
DARK = RGBColor(0x1f, 0x29, 0x37)
GRAY = RGBColor(0x4b, 0x55, 0x63)

doc = Document()

# ---------- base style tweaks ----------
normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)
normal.font.color.rgb = DARK

def set_cell_shading(cell, color_hex):
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    cell._tc.get_or_add_tcPr().append(shd)

def h1(text):
    p = doc.add_heading(text, level=1)
    for run in p.runs:
        run.font.color.rgb = PURPLE
    return p

def h2(text):
    p = doc.add_heading(text, level=2)
    for run in p.runs:
        run.font.color.rgb = INDIGO
    return p

def h3(text):
    p = doc.add_heading(text, level=3)
    for run in p.runs:
        run.font.color.rgb = DARK
    return p

def para(text, bold=False, italic=False, size=11, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    return p

def bullet(text):
    doc.add_paragraph(text, style='List Bullet')

def numbered(text):
    doc.add_paragraph(text, style='List Number')

def image(path, width=6.2, caption=None):
    doc.add_picture(f"{ASSETS}/{path}", width=Inches(width))
    last_paragraph = doc.paragraphs[-1]
    last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = cap.add_run(caption)
        run.italic = True
        run.font.size = Pt(9.5)
        run.font.color.rgb = GRAY

def table(headers, rows, col_widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_cells = t.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header
        for p in hdr_cells[i].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_shading(hdr_cells[i], "667EEA")
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = str(val)
    return t

def page_break():
    doc.add_page_break()

# =========================================================
# COVER PAGE
# =========================================================
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run("📖 Memoir")
run.font.size = Pt(44)
run.bold = True
run.font.color.rgb = PURPLE

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run("A Complete Guide to the App, Its Architecture, and Its AI Systems")
run.font.size = Pt(16)
run.font.color.rgb = GRAY

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(
    "Written for two audiences at once:\n"
    "1) a complete newbie who has never seen the project, and\n"
    "2) an interviewer who wants to know exactly how it was built and why."
)
run.font.size = Pt(12)
run.italic = True

doc.add_paragraph()
image("01_home_dashboard.png", width=6.0, caption="The Memoir Home dashboard — affirmation, calendar, habit tracker, and file upload.")
page_break()

# =========================================================
# 1. EXECUTIVE SUMMARY
# =========================================================
h1("1. What is Memoir, in one paragraph?")
para(
    "Memoir is a private, self-hosted journaling web app. A user writes diary entries "
    "(by typing, talking, or uploading old notes/photos/PDFs), and a locally-run AI model "
    "reads those entries to answer questions like \"what patterns do you notice in my life?\" "
    "or \"how has my mood changed?\". Everything — the database, the AI model, and the cache — "
    "runs in Docker containers on the user's own machine. No data ever leaves the computer, "
    "and there are no subscription costs, because the AI is a free, open-source model (Mistral) "
    "run through Ollama instead of a paid API like OpenAI."
)

h2("1.1 The elevator pitch (for an interviewer)")
para(
    "\"I built a full-stack journaling application with a self-hosted AI coach. It's a React "
    "front end, an Express/Node REST API, a PostgreSQL database, and a local large language "
    "model (Mistral, via Ollama) that powers semantic search, retrieval-augmented generation "
    "(RAG), mood analysis, and an agent that picks the right AI tool based on what the user "
    "asks. The whole stack — app, database, cache, and LLM — is defined in one docker-compose "
    "file, so it can be deployed anywhere with a single command and costs nothing to run.\""
)

h2("1.2 Why this project is a good talking point")
bullet("Demonstrates full-stack skills: React front end, Node/Express back end, PostgreSQL schema design.")
bullet("Demonstrates applied AI/LLM skills: embeddings, vector search, RAG, prompt engineering, and a simple tool-calling agent — without depending on a paid API.")
bullet("Demonstrates DevOps skills: multi-container Docker Compose orchestration (app, Postgres, Ollama, Redis), health checks, and a production Dockerfile.")
bullet("Demonstrates product thinking: habit tracking with a \"grace miss\" streak, mood-trend visualization, on-this-day memories, and daily/weekly AI-generated recaps — features aimed at daily retention, not just a tech demo.")
bullet("Demonstrates debugging discipline: real bugs were found and fixed during development (see Section 8 — Known Issues & Fixes), which is a strong story for \"tell me about a bug you fixed.\"")

page_break()

# =========================================================
# 2. WHO IS THIS APP FOR? (Newbie explanation)
# =========================================================
h1("2. Explaining Memoir to a complete newbie")
para(
    "Imagine a diary app on your phone or computer — but instead of just storing your "
    "words, it has a small, private robot brain built in. You write about your day, and "
    "the robot brain (which runs entirely on your own computer, not the internet) can:"
)
bullet("Tell you how your mood has been trending over time.")
bullet("Notice patterns you might not see yourself (\"you always mention feeling anxious before big meetings\").")
bullet("Answer questions about your own journal, like a search engine that understands meaning, not just keywords.")
bullet("Remind you to write if you're about to break your daily streak.")
bullet("Show you what you wrote exactly one year ago today.")

h2("2.1 A day in the life of a Memoir user")
numbered("Log in (or sign up in 10 seconds — just a username and password).")
numbered("Land on Home: see a daily affirmation, a streak badge, an \"on this day\" memory, a habit tracker, and a calendar.")
numbered("Tap Quick Capture, write a few lines about the day (or use the microphone to talk instead of type).")
numbered("Check a habit off (e.g. \"drank enough water\") with one tap.")
numbered("Open AI Coach and ask \"how have I been feeling this week?\" — the AI reads recent entries and answers like a supportive friend.")
numbered("At night, get a gentle reminder notification only if skipping today would break an active streak.")

page_break()

# =========================================================
# 3. ARCHITECTURE
# =========================================================
h1("3. Architecture")
para(
    "Memoir runs as four Docker containers, orchestrated by a single docker-compose.yml. "
    "The diagram below shows every major component and how data flows between them."
)
image("00_architecture_diagram.png", width=6.4)

h2("3.1 The four containers")
table(
    ["Container", "Image", "Responsibility"],
    [
        ["memoir-app", "Custom (Node 20-alpine)", "Serves the built React app AND the REST API on port 3001"],
        ["memoir-db", "pgvector/pgvector:pg16", "PostgreSQL 16 with the pgvector extension pre-installed"],
        ["memoir-ollama", "ollama/ollama", "Runs the Mistral 7B language model locally, exposed on port 11434"],
        ["memoir-redis", "redis:7-alpine", "Caches AI analysis results (mood, patterns, daily/weekly summaries)"],
    ],
)

h2("3.2 Request lifecycle example: \"What patterns do you notice?\"")
numbered("Browser sends POST /api/ai/chat with the message and the logged-in user's ID.")
numbered("Express inspects the message with a keyword-based tool selector (selectAgentTool) and picks find_patterns.")
numbered("The server loads the user's 20 most recent entries from PostgreSQL.")
numbered("It builds a prompt and calls Ollama's local /api/generate endpoint (Mistral 7B).")
numbered("Ollama's response is returned to the browser as JSON, along with which tool was used (for transparency/debugging).")
para("Note: if the tool is search_entries instead, the server first runs a semantic similarity search against an in-memory vector store before calling Ollama — this is the RAG (Retrieval-Augmented Generation) path, described fully in Section 6.")

h2("3.3 Why one Express server serves both the API and the front end")
para(
    "In production, `npm run build` compiles the React app into static files (dist/). "
    "The Express server checks if that folder exists and, if so, serves it directly with "
    "express.static, while still handling /api/* routes separately. This means only one "
    "container and one port (3001) are needed in production — simpler to deploy and secure "
    "than running two separate servers."
)

page_break()

# =========================================================
# 4. TECH STACK
# =========================================================
h1("4. Complete Tech Stack")

h2("4.1 Frontend")
table(
    ["Tool", "Version", "Purpose"],
    [
        ["React", "19.1.0", "Component-based UI, hooks-only (no class components)"],
        ["Vite", "7.x", "Dev server + production bundler (fast HMR, small output)"],
        ["Plain CSS", "—", "Hand-written per-component stylesheets (no CSS framework)"],
        ["Web Speech API", "Browser-native", "Real-time voice dictation (no external transcription cost)"],
        ["Notification API", "Browser-native", "Streak-saving evening reminders"],
    ],
)

h2("4.2 Backend")
table(
    ["Tool", "Version", "Purpose"],
    [
        ["Node.js", "20", "JavaScript runtime for the server"],
        ["Express", "4.18", "REST API framework, ~30 routes in one server.js"],
        ["pg (node-postgres)", "8.13", "PostgreSQL client / connection pool"],
        ["multer", "1.4", "Multipart file upload handling (images, PDFs, docs)"],
        ["pdf-parse / mammoth / tesseract.js", "—", "Extract text from PDFs, Word docs, and images (OCR)"],
        ["Node's built-in http/https/net", "—", "Used instead of axios/redis client libraries to avoid extra npm dependencies and registry/network issues"],
    ],
)

h2("4.3 AI / Machine Learning")
table(
    ["Tool", "Purpose"],
    [
        ["Ollama", "Local server that runs open-source LLMs with a simple HTTP API"],
        ["Mistral 7B", "The actual language model used for chat, mood analysis, pattern detection, insights, and summaries"],
        ["Hash-based embeddings (SHA-256)", "A free, deterministic stand-in for real embeddings, used for the in-memory vector store"],
        ["Cosine similarity", "The math used to compare two embeddings and rank search results"],
    ],
)

h2("4.4 Data & Infrastructure")
table(
    ["Tool", "Purpose"],
    [
        ["PostgreSQL 16 + pgvector", "Primary database; pgvector is installed and ready for a future real-embeddings upgrade"],
        ["Redis 7", "Caches expensive AI-generated analysis so repeat requests are instant and free"],
        ["Docker + Docker Compose", "Packages the whole app into four reproducible containers"],
        ["localStorage (browser)", "Stores login session, profile/avatar, background photo, and habit/todo data client-side"],
    ],
)

page_break()

# =========================================================
# 5. FEATURE TOUR (with screenshots)
# =========================================================
h1("5. Feature Tour")

h2("5.1 Home Dashboard")
para(
    "The first screen after logging in. Combines several small, high-frequency widgets "
    "instead of one big feature, which is intentional — it is designed to be glanced at "
    "daily, not read like a report."
)
bullet("Daily affirmation — a random encouraging word, cached per day so it doesn't change on every refresh.")
bullet("Streak & milestone badges — current/longest streak, computed from distinct journal dates in PostgreSQL.")
bullet("\"On this day\" — surfaces an entry from exactly one year (or more) ago.")
bullet("\"Continue the thought\" — shows an AI-generated prompt based on the user's most recent entry.")
bullet("Mood trend sparkline — a tiny bar chart built from saved mood check-ins, no charting library needed.")
bullet("Weekly recap button — generates a Redis-cached, Ollama-written summary of the last 7 days on demand.")
bullet("Habit tracker — up to 3 habits, weekly/monthly views, and a \"1 grace miss per week\" streak so a single missed day doesn't reset progress.")
bullet("Calendar with period tracking — a heat-map style calendar plus optional menstrual cycle prediction.")
bullet("Upload progress photo — drag-and-drop daily photos for visual progress tracking.")
image("01_home_dashboard.png", width=6.2, caption="Home dashboard, redesigned to match the app's indigo/purple gradient theme.")

h2("5.2 Journal")
para(
    "Two entry modes, both writing to the same entries table:"
)
bullet("Dump — freeform writing, with voice dictation, file upload/OCR, search, and calendar filtering.")
bullet("Structured — guided mode where the AI suggests focus areas (e.g. \"Confidence Building\") and generates specific questions to answer.")
para(
    "The Journal dashboard also includes Reflections — a tool that generates 3-5 reflective "
    "questions about a chosen date range, and a live count of matching entries."
)
image("02_journal_dashboard.png", width=6.2, caption="Journal dashboard showing existing entries, the two entry-mode cards, and the Reflections panel.")

h2("5.3 AI Coach")
para(
    "A chat interface with four quick-action buttons (Analyze Mood, Find Patterns, Generate "
    "Insights, Track Goals) plus free-text chat. Every message is routed through a simple "
    "keyword-based tool selector before being sent to Ollama, so the AI's behavior is "
    "predictable and debuggable rather than a black box."
)
image("03_ai_coach.png", width=6.2, caption="A live conversation: the AI Coach reading the user's own journal entry and identifying real emotional patterns — generated entirely by the local Mistral model.")

h2("5.4 Settings — Personal Avatar")
para(
    "Instead of only allowing a photo upload, users can build an illustrated avatar by "
    "choosing skin tone, hairstyle, hair color, eye style, and outfit color. The avatar is "
    "drawn live with layered CSS shapes (no image library needed) and instantly reflected "
    "in the sidebar."
)
image("04_settings_avatar.png", width=6.2, caption="The illustrated avatar builder in Settings, alongside background photo, weight/height, and goals.")

page_break()

# =========================================================
# 6. THE AI / RAG PIPELINE — DEEP DIVE
# =========================================================
h1("6. The AI System, Explained From Scratch")
para(
    "This section explains every AI concept used in Memoir in plain language, then shows "
    "exactly how it is implemented — useful both for understanding the code and for "
    "answering interview questions about LLMs, RAG, and embeddings."
)

h2("6.1 What is an LLM, and what is Ollama?")
para(
    "A Large Language Model (LLM) is a program trained on huge amounts of text that can "
    "predict and generate human-like text. Mistral 7B is one such model, open-source and "
    "free to run. Ollama is a small local server that downloads a model file and exposes a "
    "simple HTTP API (POST /api/generate, /api/chat) so any app can talk to the model over "
    "the network — in this case, over Docker's internal network from the app container to "
    "the ollama container."
)

h2("6.2 What are embeddings?")
para(
    "An embedding turns text into a list of numbers (a vector) that represents its meaning. "
    "Two pieces of text with similar meaning should produce vectors that are 'close' to each "
    "other mathematically, even if they don't share any of the same words."
)
para(
    "Memoir currently uses a simplified, hash-based embedding: it runs the entry's text "
    "through SHA-256 and turns the resulting bytes into a 384-number vector. This is free, "
    "instant, and deterministic (the same text always produces the same vector), but it is "
    "NOT a true semantic embedding — it does not understand meaning, only produces a unique "
    "fingerprint per text. This was a deliberate zero-cost tradeoff, documented as a known "
    "limitation in Section 8."
)

h2("6.3 What is a vector store, and how does search work?")
para(
    "A vector store is just a place to keep all those embeddings so they can be compared "
    "quickly. Memoir's is a simple JavaScript Map (entryId → embedding), rebuilt in memory "
    "every time the server starts (by loading all entries from Postgres) and updated "
    "immediately whenever a new entry is saved."
)
para(
    "To search, the user's query is embedded the same way, then compared to every stored "
    "embedding using cosine similarity — a formula that measures the angle between two "
    "vectors (1.0 = identical direction, 0 = unrelated). The closest matches are returned."
)

h2("6.4 What is RAG (Retrieval-Augmented Generation)?")
para(
    "RAG means: before asking the AI to answer a question, first retrieve relevant "
    "background information and give it to the AI as context. Without RAG, an LLM can only "
    "use what it was trained on — it has never seen the user's actual diary. With RAG, "
    "Memoir's flow is:"
)
numbered("User asks a question (e.g. \"how was I feeling about work?\").")
numbered("The server searches the vector store for the most similar past journal entries.")
numbered("Those entries are inserted into the prompt as context, along with a system prompt describing the AI's persona (a warm, supportive coach).")
numbered("Ollama generates a response that references the user's actual life, not generic advice.")

h2("6.5 What is the AI \"agent\", and what is tool-calling?")
para(
    "Rather than sending every chat message to the AI the same way, Memoir first decides "
    "which \"tool\" best matches the user's intent, using keyword matching in "
    "selectAgentTool(). The five tools are:"
)
table(
    ["Tool", "Triggered by keywords like…", "What it does"],
    [
        ["search_entries", "find, search, look, or no match", "Runs the full RAG pipeline described above"],
        ["analyze_mood", "mood, feel, emotion, emotional", "Asks the LLM to summarize emotional tone and trajectory"],
        ["find_patterns", "pattern, trend, recurring, habit", "Asks the LLM to identify recurring themes and triggers"],
        ["generate_insights", "insight, advice, suggest, recommend", "Asks the LLM for strengths, growth areas, and next steps"],
        ["track_goals", "goal, progress, track", "Asks the LLM to evaluate progress against stated goals"],
    ],
)
para(
    "This is a simplified version of what production AI agents do at a larger scale (e.g. "
    "OpenAI's function calling or LangChain agents) — same concept (pick the right tool for "
    "the job), implemented without any extra framework or paid API."
)

h2("6.6 Prompt engineering used in Memoir")
para(
    "Every AI call uses a system prompt establishing persona and constraints, for example: "
    "\"You are a thoughtful and empathetic journal AI coach... Reference specific details "
    "from their past entries when relevant.\" Prompts that must return structured data (like "
    "generated focus areas or reflection questions) explicitly instruct the model to "
    "\"Output ONLY valid JSON\", and the server strips markdown code fences and safely "
    "parses the result, falling back to a hand-written default list if parsing fails."
)

h2("6.7 Caching AI results with Redis")
para(
    "Mood analysis, pattern detection, and daily/weekly summaries are all expensive (they "
    "call the LLM, which takes several seconds). Memoir hashes the input text and stores "
    "the result in Redis with an expiry (15 minutes for mood/patterns, 24 hours for daily "
    "summaries, 7 days for weekly summaries). If Redis is ever unreachable, the code falls "
    "back to a small in-memory Map automatically, so the feature degrades gracefully instead "
    "of breaking."
)

page_break()

# =========================================================
# 7. DATABASE & API REFERENCE
# =========================================================
h1("7. Database Schema")
table(
    ["Table", "Key Columns", "Purpose"],
    [
        ["entries", "id, title, content, tags (jsonb), created_at, updated_at", "Every journal entry, dump or structured"],
        ["next_session_prompts", "id, user_id, entry_id, prompts (jsonb), created_at", "AI-suggested questions for the user's next writing session"],
        ["mood_records", "id, entry_id (unique), mood, score (1-5), emotions (jsonb)", "One mood check-in per entry, used for the trend sparkline"],
        ["daily_summaries", "summary_date (PK), summary, entry_count, generated_at", "Cached AI-written recap of a single day"],
    ],
)
para("All tables use PostgreSQL's JSONB type for flexible list/array fields (tags, emotions, prompts) without needing separate join tables.")

h1("8. Full API Reference")
h2("8.1 Journal entries")
table(
    ["Method", "Route", "Purpose"],
    [
        ["GET", "/api/entries", "List all entries"],
        ["GET", "/api/entries/on-this-day", "Entries from this month/day in a previous year"],
        ["GET", "/api/entries/:id", "Fetch a single entry"],
        ["POST", "/api/entries", "Create an entry (auto-indexes it for search + generates next-session prompts)"],
        ["PUT", "/api/entries/:id", "Update an entry"],
        ["DELETE", "/api/entries/:id", "Delete an entry"],
        ["POST", "/api/entries/extract", "Upload files (PDF/image/docx) and extract their text"],
        ["POST", "/api/entries/upload", "Upload files and save directly as entries"],
    ],
)
h2("8.2 AI & analysis")
table(
    ["Method", "Route", "Purpose"],
    [
        ["POST", "/api/ai/chat", "Tool-calling chat with the AI coach"],
        ["POST", "/api/ai/search", "Semantic search over journal entries"],
        ["POST", "/api/ai/query", "Full RAG query (search + generate)"],
        ["POST", "/api/ai/index", "Manually (re)index a batch of entries"],
        ["POST", "/api/ai/analyze/mood", "Mood analysis (Redis-cached)"],
        ["POST", "/api/ai/analyze/patterns", "Pattern detection (Redis-cached)"],
        ["POST", "/api/ai/analyze/insights", "Personalized growth insights"],
        ["POST", "/api/ai/moods", "Save a mood check-in for an entry"],
        ["GET", "/api/ai/moods", "Mood history + average score, for the trend chart"],
        ["POST", "/api/ai/daily-summary", "Generate/fetch a cached daily recap"],
        ["GET", "/api/ai/daily-summary/:date", "Fetch a previously generated daily recap"],
        ["POST", "/api/ai/weekly-summary", "Generate/fetch a cached weekly recap"],
        ["GET", "/api/stats/streak", "Current streak, longest streak, total entries"],
        ["GET", "/api/ai/stats", "Vector store size/health"],
        ["DELETE", "/api/ai/clear-index", "Wipe the in-memory vector store"],
    ],
)
h2("8.3 Prompts, reflections, and system")
table(
    ["Method", "Route", "Purpose"],
    [
        ["POST", "/api/ai/prompts", "Generate structured-journal questions for a focus area"],
        ["GET", "/api/ai/focus-areas", "Suggest focus areas based on recent entries"],
        ["POST", "/api/reflections", "Generate reflective questions for a date range"],
        ["GET", "/api/prompts/next/:userId", "Fetch the AI's suggested prompts for next time"],
        ["GET", "/api/health", "Health check used by Docker and monitoring"],
    ],
)

page_break()

# =========================================================
# 9. DEPLOYMENT / DOCKER
# =========================================================
h1("9. Deployment: How Docker Compose Ties It Together")
para("From the project root, one command builds and starts everything:")
p = doc.add_paragraph()
run = p.add_run("docker build -t memoir:latest .\ndocker compose up -d")
run.font.name = 'Courier New'
run.font.size = Pt(10.5)

h2("9.1 Dockerfile (production image)")
para(
    "A small Node 20-alpine image that copies the pre-built server/ folder (with its "
    "node_modules already installed on the host, to sidestep flaky npm registry certificate "
    "issues inside the build) and the compiled dist/ frontend, then runs `node server/server.js`. "
    "No build step happens inside the container — it just runs what's already been built."
)

h2("9.2 docker-compose.yml environment wiring")
table(
    ["Variable", "Value", "Purpose"],
    [
        ["DB_HOST", "db", "Points the app at the Postgres container by its Compose service name"],
        ["OLLAMA_URL", "http://ollama:11434/api", "Points the app at the local LLM container"],
        ["REDIS_HOST", "redis", "Points the app at the cache container"],
        ["OLLAMA_MODEL", "mistral", "Which model Ollama should load for every generate/chat call"],
    ],
)
para(
    "Because container names are used instead of localhost, the four containers can find "
    "each other over Docker's internal network regardless of the host machine's IP."
)

h2("9.3 First-time model setup")
para("After the containers start, the LLM itself must be downloaded once (it is not baked into the image, to keep the image small):")
p = doc.add_paragraph()
run = p.add_run("docker compose exec ollama ollama pull mistral")
run.font.name = 'Courier New'
run.font.size = Pt(10.5)

page_break()

# =========================================================
# 10. SECURITY & PRIVACY
# =========================================================
h1("10. Security & Privacy Notes")
bullet("Authentication is client-side only (SHA-256 hashed password in localStorage) — appropriate for a single personal device, explicitly NOT a substitute for real multi-user security.")
bullet("All AI inference happens locally via Ollama — no journal content is ever sent to a third-party API.")
bullet("File uploads are restricted by MIME type and extension allow-lists, with a 10MB size limit, to reduce the risk of malicious uploads.")
bullet("The server validates required fields (title/content, mood score range 1-5, etc.) before writing to the database.")
bullet("Parameterized SQL queries (pg's $1/$2 placeholders) are used throughout — no string-concatenated SQL, which prevents SQL injection.")

# =========================================================
# 11. KNOWN ISSUES & FIXES (great interview material)
# =========================================================
h1("11. Known Issues Found & Fixed During Development")
para("These are real debugging stories from building Memoir — useful to describe in an interview when asked about problem-solving:")

h2("11.1 Vector store was never populated")
para(
    "Symptom: semantic search always returned no results, even though entries existed in "
    "Postgres. Root cause: nothing ever called the indexing function when an entry was "
    "created, and the server never loaded existing entries into the vector store on boot. "
    "Fix: added indexEntryForSearch() calls both inside the POST /api/entries handler and "
    "once at server startup (looping over all existing rows)."
)

h2("11.2 Express route ordering bug")
para(
    "Symptom: GET /api/entries/on-this-day returned 404 Not Found. Root cause: Express "
    "matches routes in the order they are registered, and /api/entries/:id had already been "
    "registered earlier in the file — it was matching \"on-this-day\" as if it were an entry "
    "ID. Fix: moved the more specific /on-this-day route before the generic /:id route."
)

h2("11.3 Hardcoded userId broke personalization")
para(
    "Symptom: the AI Coach's mood history, chat, and next-session prompts were not "
    "consistently tied to the logged-in user — some code paths used the literal string "
    "'user123' or 'default'. Fix: threaded the real logged-in username from the "
    "authentication state down through the AIChatPanel component's props and into every "
    "AI request body."
)

h2("11.4 Missing helper function crashed the chat endpoint")
para(
    "Symptom: ReferenceError: httpRequest is not defined when using the AI chat feature. "
    "Root cause: axios was replaced with Node's built-in http/https modules to avoid an "
    "unreliable npm registry, but the replacement helper function was referenced before it "
    "was actually written. Fix: implemented httpRequest() as a small Promise-based wrapper "
    "around Node's http.request/https.request."
)

h2("11.5 Docker image built with an incomplete dependency layer")
para(
    "Symptom: Cannot find module 'express' when running the production container, even "
    "though the build appeared to succeed. Root cause: a stale/incomplete Docker layer cache "
    "combined with a failing in-container npm install (certificate errors reaching the "
    "public npm registry). Fix: install dependencies on the host (where npm already worked "
    "reliably) and COPY the resulting node_modules directly into the image, removing the "
    "in-container npm ci step entirely."
)

page_break()

# =========================================================
# 12. LIMITATIONS & ROADMAP
# =========================================================
h1("12. Known Limitations & Roadmap")
h2("12.1 Current limitations")
bullet("Embeddings are hash-based, not true semantic vectors — search similarity scores can be low even for obviously related text.")
bullet("Authentication is single-device/client-side only, not suitable for multi-user or public deployment as-is.")
bullet("The in-memory vector store resets on every server restart (rebuilt from Postgres automatically, but briefly empty during that rebuild).")
bullet("Voice dictation language is hardcoded to en-US.")

h2("12.2 Roadmap ideas")
bullet("Swap hash-based embeddings for Ollama's nomic-embed-text model for real semantic search quality.")
bullet("Move the vector store into pgvector (already installed) for persistence and to scale past ~10,000 entries.")
bullet("Habit-mood correlation insights (e.g. \"your mood is higher on days you complete X\").")
bullet("Export/import all entries as JSON/Markdown for backup and portability.")
bullet("Progressive Web App (PWA) support for offline drafting and installability.")

page_break()

# =========================================================
# 13. INTERVIEW Q&A
# =========================================================
h1("13. Likely Interview Questions & Strong Answers")

qa = [
    ("Walk me through the architecture.",
     "Four Docker containers: a Node/Express server that serves the built React app and a "
     "REST API, PostgreSQL for persistent data, Ollama running a local Mistral model for AI, "
     "and Redis caching expensive AI results. The browser only ever talks to the Express "
     "server; Express is the only thing that talks to Postgres, Ollama, and Redis."),
    ("Why did you choose a local LLM instead of OpenAI's API?",
     "Cost and privacy. Journaling is deeply personal data, so I didn't want it leaving the "
     "user's machine, and I wanted the app to be free to run forever, not metered per token."),
    ("What is RAG and where did you use it?",
     "Retrieval-Augmented Generation: retrieve relevant context before generating a response. "
     "I use it in /api/ai/query — the user's question is embedded, compared against stored "
     "journal-entry embeddings with cosine similarity, and the top matches are inserted into "
     "the LLM prompt so answers are grounded in the user's actual writing."),
    ("What was the hardest bug you fixed?",
     "The vector store silently never got populated, so semantic search always returned "
     "nothing — but there was no error, it just quietly did nothing useful. I found it by "
     "actually testing the live API (/api/ai/stats showed 0 entries despite entries existing "
     "in Postgres) rather than trusting that the code 'looked' correct."),
    ("How would you scale this to many users?",
     "Move authentication to a real server-side system with hashed+salted passwords and "
     "sessions/JWTs, move the vector store into pgvector so it persists and can be filtered "
     "per user, and add per-user rate limiting on the Ollama calls since LLM inference is the "
     "most expensive resource."),
    ("What tradeoffs did you make?",
     "Hash-based embeddings instead of a real embedding model — free and instant, but not "
     "truly semantic. It's flagged as a documented limitation with a clear upgrade path "
     "(pull nomic-embed-text and swap one function)."),
]
for q, a in qa:
    p = doc.add_paragraph()
    run = p.add_run("Q: " + q)
    run.bold = True
    run.font.color.rgb = INDIGO
    p2 = doc.add_paragraph()
    run2 = p2.add_run("A: " + a)
    run2.font.color.rgb = DARK
    doc.add_paragraph()

page_break()

# =========================================================
# 14. GLOSSARY
# =========================================================
h1("14. Glossary (for newbies)")
glossary = [
    ("API", "A set of URLs a program can call to get or send data — the 'menu' the frontend uses to talk to the backend."),
    ("REST API", "An API style using standard HTTP verbs (GET, POST, PUT, DELETE) for reading, creating, updating, and deleting data."),
    ("LLM", "Large Language Model — an AI trained on huge amounts of text that can generate human-like responses."),
    ("Ollama", "Free software that runs LLMs on your own computer and exposes them over a simple local API."),
    ("Embedding", "A list of numbers representing the 'meaning' of a piece of text, used to compare texts mathematically."),
    ("Vector store", "A place to store and search embeddings quickly."),
    ("Cosine similarity", "A formula that measures how similar two embeddings are, from 0 (unrelated) to 1 (identical)."),
    ("RAG", "Retrieval-Augmented Generation — look up relevant information first, then ask the AI to answer using it."),
    ("Agent / tool-calling", "Letting the AI (or simple code) choose which specific action/tool to use based on the user's request."),
    ("Docker", "A way to package an app and everything it needs to run into a portable 'container'."),
    ("Docker Compose", "A tool for running multiple Docker containers together as one system, defined in a single YAML file."),
    ("PostgreSQL", "A free, open-source relational database used to permanently store journal entries and related data."),
    ("Redis", "An in-memory data store, used here purely as a fast cache for expensive AI results."),
    ("pgvector", "A PostgreSQL extension that lets the database store and search embeddings directly."),
]
for term, definition in glossary:
    p = doc.add_paragraph()
    run = p.add_run(term + ": ")
    run.bold = True
    run.font.color.rgb = PURPLE
    p.add_run(definition)

para("")
p = doc.add_paragraph()
run = p.add_run("Generated for the Memoir project — a fully self-hosted, zero-cost, AI-powered journaling app.")
run.italic = True
run.font.size = Pt(9.5)
run.font.color.rgb = GRAY

doc.save(OUT)
print("Saved:", OUT)
