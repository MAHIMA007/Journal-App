import axios from 'axios';

class OllamaService {
  constructor() {
    this.baseURL = process.env.OLLAMA_URL || 'http://localhost:11434/api';
    this.model = process.env.OLLAMA_MODEL || 'mistral';
    this.timeout = 60000;
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseURL.replace('/api', '')}/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.warn('Ollama not available:', error.message);
      return false;
    }
  }

  async generateResponse(prompt, context = '', temperature = 0.7) {
    try {
      if (!await this.isAvailable()) {
        throw new Error('Ollama service not running');
      }

      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

      const response = await axios.post(
        `${this.baseURL}/generate`,
        {
          model: this.model,
          prompt: fullPrompt,
          stream: false,
          temperature,
          top_p: 0.9,
          num_predict: 500
        },
        { timeout: this.timeout }
      );

      return response.data.response.trim();
    } catch (error) {
      console.error('Ollama generation error:', error.message);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async chat(messages, systemPrompt = '') {
    try {
      const formattedMessages = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${formattedMessages}`
        : formattedMessages;

      return await this.generateResponse(fullPrompt);
    } catch (error) {
      console.error('Ollama chat error:', error.message);
      throw error;
    }
  }

  async embedText(text) {
    try {
      // Using nomic-embed-text model for embeddings
      const response = await axios.post(
        `${this.baseURL}/embed`,
        {
          model: 'nomic-embed-text',
          input: text
        },
        { timeout: this.timeout }
      );
      return response.data.embedding;
    } catch (error) {
      console.error('Ollama embedding error:', error.message);
      throw error;
    }
  }

  async listModels() {
    try {
      const response = await axios.get(`${this.baseURL.replace('/api', '')}/tags`);
      return response.data.models || [];
    } catch (error) {
      console.error('Error listing models:', error.message);
      return [];
    }
  }

  async pullModel(modelName) {
    try {
      const response = await axios.post(
        `${this.baseURL}/pull`,
        { name: modelName },
        { timeout: 600000 }
      );
      return response.data;
    } catch (error) {
      console.error(`Error pulling model ${modelName}:`, error.message);
      throw error;
    }
  }
}

export default new OllamaService();
