const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  // Helper method to handle API responses
  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'An error occurred' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }
    
    return response.json();
  }

  // Get all entries
  async getEntries() {
    try {
      const response = await fetch(`${API_BASE_URL}/entries`);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching entries:', error);
      throw error;
    }
  }

  // Get specific entry by ID
  async getEntry(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/entries/${id}`);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching entry:', error);
      throw error;
    }
  }

  // Create new entry
  async createEntry(entryData) {
    try {
      const response = await fetch(`${API_BASE_URL}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryData),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error creating entry:', error);
      throw error;
    }
  }

  // Update existing entry
  async updateEntry(id, entryData) {
    try {
      const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryData),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
  }

  // Delete entry
  async deleteEntry(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
        method: 'DELETE',
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error checking API health:', error);
      throw error;
    }
  }

  // Generate structured journal prompts from focus area
  async generateStructuredPrompts(focusArea, questionCount = 5) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ focusArea, questionCount }),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error generating structured prompts:', error);
      throw error;
    }
  }

  // Generate focus areas from previous entries
  async getFocusAreas(limit = 6) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai/focus-areas?limit=${encodeURIComponent(limit)}`);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching focus areas:', error);
      throw error;
    }
  }

  // Generate reflections for a date range
  async getReflections({ fromDate, toDate, questionCount = 4, userId = 'default' }) {
    try {
      const response = await fetch(`${API_BASE_URL}/reflections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fromDate, toDate, questionCount, userId }),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error generating reflections:', error);
      throw error;
    }
  }

  // Get AI-generated prompts for the user's next journaling session
  async getNextPrompts(userId = 'default') {
    try {
      const response = await fetch(`${API_BASE_URL}/prompts/next/${encodeURIComponent(userId)}`);
      if (response.status === 404) return null;
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching next prompts:', error);
      return null;
    }
  }
}

export default new ApiService();
