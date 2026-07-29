/**
 * Round-trip test: send a journal entry to Ollama (Llama 3.1 8B), print the response.
 * Prerequisites:
 *   1. Install Ollama: https://ollama.com/download
 *   2. Pull the model: ollama pull llama3.1:8b
 *   3. Ollama must be running (it starts automatically after install)
 * Usage: node test-ai-roundtrip.js
 */

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'llama3.1:8b';

const sampleEntry = {
  title: 'A productive Monday',
  content: `Today I finally finished the project proposal I've been putting off for weeks. 
Went for a morning run, felt energized all day. Had a good call with the team. 
Still need to follow up on the design review by end of week.`,
  date: new Date().toISOString(),
};

async function main() {
  console.log(`Sending journal entry to Ollama (${MODEL})...\n`);
  console.log('Entry:', JSON.stringify(sampleEntry, null, 2), '\n');

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        {
          role: 'user',
          content: `Here is a journal entry:\n\nTitle: ${sampleEntry.title}\n\n${sampleEntry.content}\n\nGive me a one-paragraph reflection or insight about this entry.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  const responseText = data.message?.content;
  console.log('Llama response:\n');
  console.log(responseText);
  console.log('\nRound-trip successful!');
}

main().catch((err) => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error('Error: Ollama is not running. Start it with: ollama serve');
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
});
