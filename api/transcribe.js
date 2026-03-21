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
    // Lire le body manuellement (bodyParser désactivé)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Audio vide' });
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'HF_TOKEN manquant dans les variables Vercel' });
    }

    // Appel HuggingFace
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': req.headers['content-type'] || 'audio/webm', // ← prend le type du client
        },
        body: audioBuffer,
      }
    );

    // Si modèle en cours de chargement
    if (hfRes.status === 503) {
      return res.status(503).json({ error: 'Modèle en cours de chargement, réessayez dans 20s' });
    }

    const text = await hfRes.text();

    // Vérifier que c'est du JSON valide
    try {
      const data = JSON.parse(text);
      return res.status(200).json({ text: data.text || '' });
    } catch {
      return res.status(500).json({ error: 'Réponse HF invalide: ' + text.slice(0, 100) });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
