import express from 'express';
import ragService from '../services/ragService.js';
import agentService from '../services/agentService.js';
import ollamaService from '../services/ollamaService.js';
import embeddingService from '../services/embeddingService.js';

const router = express.Router();

// Health check
router.get('/health', async (req, res) => {
  try {
    const ollamaAvailable = await ollamaService.isAvailable();
    const stats = ragService.getStats();

    res.json({
      status: 'ok',
      ollamaConnected: ollamaAvailable,
      vectorStore: stats,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Semantic search over entries
router.post('/search', async (req, res) => {
  try {
    const { query, k = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await ragService.semanticSearch(query, k);

    res.json({
      query,
      results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RAG query with context
router.post('/query', async (req, res) => {
  try {
    const { query, k = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await ragService.queryWithRAG(query, k);

    res.json({
      query,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, userId = 'default', entries = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await agentService.execute(message, entries, userId);

    res.json({
      message,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation history
router.get('/conversation/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const history = agentService.getConversationHistory(userId);

    res.json({
      userId,
      history,
      messageCount: history.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear conversation history
router.delete('/conversation/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    agentService.clearConversationHistory(userId);

    res.json({
      message: 'Conversation history cleared',
      userId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Index entries for RAG
router.post('/index', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const results = await ragService.indexEntries(entries);

    res.json({
      indexed: results.length,
      total: entries.length,
      stats: ragService.getStats()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Index single entry
router.post('/index/:entryId', async (req, res) => {
  try {
    const { entryId } = req.params;
    const { content, title, tags, createdAt } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await ragService.indexEntry({
      id: entryId,
      content,
      title: title || 'Untitled',
      tags: tags || [],
      createdAt: createdAt || new Date()
    });

    res.json({
      entryId,
      indexed: true,
      result,
      stats: ragService.getStats()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze mood in entries
router.post('/analyze/mood', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries) {
      return res.status(400).json({ error: 'Entries are required' });
    }

    const result = await agentService.analyzeMood(entries);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find patterns
router.post('/analyze/patterns', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries) {
      return res.status(400).json({ error: 'Entries are required' });
    }

    const result = await agentService.findPatterns(entries);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate insights
router.post('/analyze/insights', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries) {
      return res.status(400).json({ error: 'Entries are required' });
    }

    const result = await agentService.generateInsights(entries);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track goals
router.post('/analyze/goals', async (req, res) => {
  try {
    const { entries, goals } = req.body;

    if (!entries) {
      return res.status(400).json({ error: 'Entries are required' });
    }

    const result = await agentService.trackGoals(entries, goals || []);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get AI stats
router.get('/stats', (req, res) => {
  try {
    const stats = ragService.getStats();

    res.json({
      vectorStore: stats,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all indexed data
router.delete('/clear-index', async (req, res) => {
  try {
    await ragService.clearIndex();

    res.json({
      message: 'Index cleared successfully',
      stats: ragService.getStats()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
