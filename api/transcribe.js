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
    if (!token) return res.status(500).json({ error: 'HF_TOKEN manquant — configurez-le dans Vercel' });

    // Lire le body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer || audioBuffer.length < 100) {
      return res.status(400).json({ error: 'Audio trop court ou vide' });
    }

    const contentType = req.headers['content-type'] || 'audio/webm';

    // Log pour debug
    console.log(`Audio reçu: ${audioBuffer.length} bytes, type: ${contentType}`);

    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-medium',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      }
    );

    const responseText = await hfRes.text();
    console.log(`HF status: ${hfRes.status}, response: ${responseText.slice(0, 200)}`);

    if (hfRes.status === 503) {
      return res.status(503).json({ error: 'Modèle en cours de chargement, réessayez dans 20s' });
    }

    if (!hfRes.ok) {
      return res.status(500).json({ error: `HF erreur ${hfRes.status}: ${responseText.slice(0, 100)}` });
    }

    try {
      const data = JSON.parse(responseText);
      return res.status(200).json({ text: data.text || '' });
    } catch {
      return res.status(500).json({ error: 'Réponse HF non-JSON: ' + responseText.slice(0, 100) });
    }

  } catch (err) {
    console.error('transcribe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
