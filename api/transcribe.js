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
    const token = process.env.HF_TOKEN;
    if (!token) return res.status(500).json({ error: 'HF_TOKEN manquant dans Vercel' });

    // Lire le body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer || audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio trop court ou vide' });
    }

    const contentType = req.headers['content-type'] || 'audio/webm';
    console.log(`Audio reçu: ${audioBuffer.length} bytes, type: ${contentType}`);

    // Nouvelle API HuggingFace (router, mars 2026)
    const form = new FormData();
    form.append(
      'file',
      new Blob([audioBuffer], { type: contentType }),
      'audio.webm'
    );
    form.append('model', 'openai/whisper-large-v3-turbo');

    const hfRes = await fetch(
      'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form,
      }
    );

    const responseText = await hfRes.text();
    console.log(`HF status: ${hfRes.status} | response: ${responseText.slice(0, 300)}`);

    if (hfRes.status === 503) {
      return res.status(503).json({ error: 'Modèle en cours de chargement, réessayez dans 20s' });
    }

    if (!hfRes.ok) {
      return res.status(500).json({ error: `HF erreur ${hfRes.status}: ${responseText.slice(0, 150)}` });
    }

    try {
      const data = JSON.parse(responseText);
      return res.status(200).json({ text: data.text || '' });
    } catch {
      return res.status(500).json({ error: 'Réponse non-JSON: ' + responseText.slice(0, 100) });
    }

  } catch (err) {
    console.error('transcribe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
