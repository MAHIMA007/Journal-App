import ragService from './ragService.js';
import ollamaService from './ollamaService.js';

class MemoirAgent {
  constructor() {
    this.tools = {
      search_entries: this.searchEntries.bind(this),
      analyze_mood: this.analyzeMood.bind(this),
      find_patterns: this.findPatterns.bind(this),
      generate_insights: this.generateInsights.bind(this),
      track_goals: this.trackGoals.bind(this)
    };
    this.conversationHistory = new Map(); // userId -> array of messages
  }

  async searchEntries(query, entries = []) {
    try {
      const results = await ragService.semanticSearch(query, 5);
      return {
        toolName: 'search_entries',
        results,
        summary: `Found ${results.length} relevant journal entries`
      };
    } catch (error) {
      console.error('Search error:', error.message);
      return { toolName: 'search_entries', error: error.message };
    }
  }

  async analyzeMood(entries) {
    try {
      const entryTexts = Array.isArray(entries)
        ? entries.map(e => e.content || e).join('\n---\n')
        : entries;

      const prompt = `Analyze the emotional tone and mood in these journal entries:

${entryTexts}

Provide a brief analysis including:
1. Overall emotional state
2. Key emotions detected
3. Mood trajectory (improving, declining, stable)
4. Emotional patterns`;

      const response = await ollamaService.generateResponse(prompt);
      return {
        toolName: 'analyze_mood',
        analysis: response
      };
    } catch (error) {
      console.error('Mood analysis error:', error.message);
      return { toolName: 'analyze_mood', error: error.message };
    }
  }

  async findPatterns(entries) {
    try {
      const entryTexts = Array.isArray(entries)
        ? entries.map(e => e.content || e).join('\n---\n')
        : entries;

      const prompt = `Analyze these journal entries for patterns and recurring themes:

${entryTexts}

Identify:
1. Recurring themes or topics
2. Behavior patterns
3. Emotional triggers
4. Time-based patterns (if dates are mentioned)
5. Relationships between topics`;

      const response = await ollamaService.generateResponse(prompt);
      return {
        toolName: 'find_patterns',
        patterns: response
      };
    } catch (error) {
      console.error('Pattern finding error:', error.message);
      return { toolName: 'find_patterns', error: error.message };
    }
  }

  async generateInsights(entries) {
    try {
      const entryTexts = Array.isArray(entries)
        ? entries.map(e => e.content || e).join('\n---\n')
        : entries;

      const prompt = `Based on these journal entries, generate personalized insights:

${entryTexts}

Provide:
1. Key insights about this person's life
2. Growth areas and strengths
3. Actionable recommendations
4. Potential blind spots or areas for reflection
5. Positive patterns to celebrate`;

      const response = await ollamaService.generateResponse(prompt);
      return {
        toolName: 'generate_insights',
        insights: response
      };
    } catch (error) {
      console.error('Insight generation error:', error.message);
      return { toolName: 'generate_insights', error: error.message };
    }
  }

  async trackGoals(entries, goals = []) {
    try {
      const entryTexts = Array.isArray(entries)
        ? entries.map(e => e.content || e).join('\n---\n')
        : entries;

      const goalsText = Array.isArray(goals) ? goals.join('\n') : goals;

      const prompt = `Track progress on these goals based on the journal entries:

GOALS:
${goalsText || 'No specific goals mentioned'}

JOURNAL ENTRIES:
${entryTexts}

Analyze:
1. Progress toward each goal
2. Relevant entries and evidence
3. Obstacles or challenges mentioned
4. Suggestions for next steps
5. Motivation level and commitment`;

      const response = await ollamaService.generateResponse(prompt);
      return {
        toolName: 'track_goals',
        goalTracking: response
      };
    } catch (error) {
      console.error('Goal tracking error:', error.message);
      return { toolName: 'track_goals', error: error.message };
    }
  }

  decideTool(query) {
    // Simple heuristic for tool selection based on keywords
    const queryLower = query.toLowerCase();
    const tools = [];

    if (
      queryLower.includes('search') ||
      queryLower.includes('find') ||
      queryLower.includes('look')
    ) {
      tools.push('search_entries');
    }

    if (
      queryLower.includes('mood') ||
      queryLower.includes('feel') ||
      queryLower.includes('emotion') ||
      queryLower.includes('emotional')
    ) {
      tools.push('analyze_mood');
    }

    if (
      queryLower.includes('pattern') ||
      queryLower.includes('trend') ||
      queryLower.includes('recurring') ||
      queryLower.includes('habit')
    ) {
      tools.push('find_patterns');
    }

    if (
      queryLower.includes('insight') ||
      queryLower.includes('suggest') ||
      queryLower.includes('recommend') ||
      queryLower.includes('advice')
    ) {
      tools.push('generate_insights');
    }

    if (
      queryLower.includes('goal') ||
      queryLower.includes('progress') ||
      queryLower.includes('track')
    ) {
      tools.push('track_goals');
    }

    // Default: use RAG for all queries
    return tools.length > 0 ? tools : ['search_entries'];
  }

  async execute(userQuery, recentEntries = [], userId = 'default') {
    try {
      // Store conversation history
      if (!this.conversationHistory.has(userId)) {
        this.conversationHistory.set(userId, []);
      }
      const history = this.conversationHistory.get(userId);

      // Add user message to history
      history.push({ role: 'user', content: userQuery });

      // System prompt
      const systemPrompt = `You are Memoir, an empathetic and insightful journal AI coach.
Your role is to help users reflect deeply on their lives, discover patterns, and grow.
Be warm, supportive, and thoughtful. Reference specific details from their journal entries.
Help them find meaning and progress in their personal journey.`;

      // Determine which tools to use
      const toolsToUse = this.decideTool(userQuery);

      // Try RAG first for all queries
      const ragResult = await ragService.queryWithRAG(userQuery, 3);

      // Build response
      let response;
      if (ragResult.hasContext && ragResult.answer) {
        // If RAG found relevant context, use that
        response = ragResult.answer;
      } else {
        // Fallback to simple LLM response
        const prompt = `Context from previous journal entries (if available):
${ragResult.sources.map(s => s.text).join('\n---\n') || 'No relevant entries found'}

User query: ${userQuery}

Respond as a supportive journal coach:`;

        response = await ollamaService.generateResponse(prompt, systemPrompt);
      }

      // Add assistant response to history (keep only last 10 messages)
      history.push({ role: 'assistant', content: response });
      if (history.length > 20) {
        this.conversationHistory.set(userId, history.slice(-20));
      }

      return {
        response,
        sources: ragResult.sources || [],
        toolsUsed: toolsToUse,
        conversationId: userId,
        messageCount: history.length
      };
    } catch (error) {
      console.error('Agent execution error:', error.message);
      return {
        response: `I encountered an error: ${error.message}. Please try again.`,
        error: error.message
      };
    }
  }

  getConversationHistory(userId = 'default') {
    return this.conversationHistory.get(userId) || [];
  }

  clearConversationHistory(userId = 'default') {
    this.conversationHistory.delete(userId);
  }
}

export default new MemoirAgent();
