export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.GROQ_API_KEY;
    if (!token) return res.status(500).json({ error: 'GROQ_API_KEY manquant dans Vercel' });

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer || audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio trop court ou vide' });
    }

    const contentType = req.headers['content-type'] || 'audio/webm';
    console.log(`Audio: ${audioBuffer.length} bytes, type: ${contentType}`);

    // FormData pour Groq (même format qu'OpenAI)
    const { FormData, Blob } = await import('node:buffer').catch(() => ({}));
    
    const form = new (globalThis.FormData || FormData)();
    form.append('file', new (globalThis.Blob || Blob)([audioBuffer], { type: contentType }), 'audio.webm');
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');

    const groqRes = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      }
    );

    const responseText = await groqRes.text();
    console.log(`Groq ${groqRes.status}: ${respons
