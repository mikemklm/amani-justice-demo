export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, lang } = req.body;

    if (!question) return res.status(400).json({ error: 'Question manquante' });

    const token = process.env.HF_TOKEN;
    if (!token) return res.status(500).json({ error: 'HF_TOKEN manquant' });

    const SYSTEM = `Tu es Amani Justice, assistant juridique mauritanien expert.
Tu connais le droit mauritanien : code du travail, droit de la famille (Moudawwana), droits civiques, anti-corruption.
Réponds TOUJOURS dans la même langue que l'utilisateur (français, arabe, ou wolof).
Sois concis (3-5 phrases max), cite les articles de loi pertinents.
Commence par reconnaître la situation avec empathie.`;

    const prompt = `<s>[INST] ${SYSTEM}\n\nQuestion : ${question} [/INST]`;

    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.6,
            return_full_text: false,
          },
        }),
      }
    );

    if (hfRes.status === 503) {
      return res.status(503).json({ error: 'Modèle en cours de chargement, réessayez' });
    }

    const text = await hfRes.text();

    try {
      const data = JSON.parse(text);
      let response = Array.isArray(data) ? data[0].generated_text : data.generated_text || '';
      response = response.replace(/<[^>]+>/g, '').trim();
      const lastDot = Math.max(response.lastIndexOf('.'), response.lastIndexOf('!'), response.lastIndexOf('?'));
      if (lastDot > 50) response = response.substring(0, lastDot + 1);
      return res.status(200).json({ response });
    } catch {
      return res.status(500).json({ error: 'Réponse HF invalide: ' + text.slice(0, 100) });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
