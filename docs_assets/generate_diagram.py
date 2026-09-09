"""Generates the architecture diagram image used in the Memoir documentation."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.path import Path

fig, ax = plt.subplots(figsize=(11, 7.5))
ax.set_xlim(0, 11)
ax.set_ylim(0, 7.5)
ax.axis('off')

def box(x, y, w, h, text, fc='#eef2ff', ec='#6366f1', fontsize=10, weight='bold', text_color='#1f2937'):
    patch = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12",
                            linewidth=1.6, edgecolor=ec, facecolor=fc)
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h / 2, text, ha='center', va='center',
            fontsize=fontsize, fontweight=weight, color=text_color, wrap=True)
    return patch

def arrow(x1, y1, x2, y2, color='#6b7280'):
    arr = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle='-|>', mutation_scale=14,
                           linewidth=1.4, color=color)
    ax.add_patch(arr)

# Title
ax.text(5.5, 7.15, 'Memoir — System Architecture', ha='center', fontsize=17, fontweight='bold', color='#1f2937')

# Client layer
box(0.4, 5.6, 4.6, 1.15, 'Browser (React 19 + Vite)\nSidebar / Journal / AI Coach /\nSettings / Habit Tracker', fc='#eef2ff', ec='#667eea')

# Reverse proxy notion (single container serving both)
box(5.6, 5.6, 4.9, 1.15, 'Express Server (Node 20)\nserves built React app +\nREST API on :3001', fc='#f5f3ff', ec='#764ba2')

arrow(5.0, 6.18, 5.6, 6.18)
arrow(5.6, 6.0, 5.0, 6.0)

# Middle layer: API groups
box(0.4, 3.9, 3.0, 1.2, 'Entries API\n/api/entries\n/api/entries/on-this-day', fc='#ecfeff', ec='#0891b2')
box(3.7, 3.9, 3.1, 1.2, 'AI API\n/api/ai/chat, /search, /query\n/analyze/*, /moods, /daily-summary', fc='#fef2f2', ec='#dc2626')
box(7.1, 3.9, 3.4, 1.2, 'Journal Support API\n/api/prompts, /api/reflections\n/api/stats/streak', fc='#fefce8', ec='#ca8a04')

arrow(2.0, 5.6, 2.0, 5.1)
arrow(5.2, 5.6, 5.2, 5.1)
arrow(8.4, 5.6, 8.4, 5.1)

# Data + AI layer
box(0.4, 2.0, 3.0, 1.3, 'PostgreSQL 16 + pgvector\nentries, mood_records,\ndaily_summaries, prompts', fc='#f0fdf4', ec='#16a34a')
box(3.7, 2.0, 3.1, 1.3, 'Ollama (local LLM)\nMistral 7B — chat, mood,\npatterns, insights, summaries', fc='#fff7ed', ec='#ea580c')
box(7.1, 2.0, 3.4, 1.3, 'Redis 7\nCache: mood/pattern analysis,\ndaily & weekly summaries', fc='#fdf4ff', ec='#a21caf')

arrow(2.0, 3.9, 2.0, 3.3)
arrow(5.2, 3.9, 5.2, 3.3)
arrow(8.8, 3.9, 8.8, 3.3)

# In-memory vector store note
box(3.7, 0.6, 3.1, 1.0, 'In-memory Vector Store\n(hash-based embeddings,\nauto-indexed on boot/save)', fc='#eff6ff', ec='#2563eb', fontsize=9)
arrow(5.2, 2.0, 5.2, 1.6)

# Docker boundary
from matplotlib.patches import Rectangle
boundary = Rectangle((0.15, 0.3), 10.7, 6.65, fill=False, edgecolor='#9ca3af', linestyle='--', linewidth=1.3)
ax.add_patch(boundary)
ax.text(0.3, 6.82, 'docker-compose.yml (4 containers)', fontsize=9, color='#6b7280', style='italic')

plt.tight_layout()
plt.savefig('/Users/mahimaa/Personal/docs_assets/00_architecture_diagram.png', dpi=170)
print('saved')
