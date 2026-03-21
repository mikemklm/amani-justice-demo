export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, lang, history } = req.body;
    if (!question) return res.status(400).json({ error: 'Question manquante' });

    const token = process.env.HF_TOKEN;
    if (!token) return res.status(500).json({ error: 'HF_TOKEN manquant' });

    const SYSTEM = `Tu es Amani Justice, assistante juridique mauritanienne experte et bienveillante.
Tu connais parfaitement le droit mauritanien : code du travail, droit de la famille (Moudawwana), droits civiques, anti-corruption.
Réponds TOUJOURS dans la même langue que l'utilisateur (français, arabe, ou wolof).
Sois concis (3-5 phrases max), cite les articles de loi mauritaniens pertinents quand utile.
Commence par reconnaître la situation avec empathie.`;

    // Construire les messages avec historique
    const messages = [
      { role: 'system', content: SYSTEM },
      ...(history || []).slice(-6),
      { role: 'user', content: question }
    ];

    // Nouvelle API HuggingFace chat completions
    const hfRes = await fetch(
      'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistralai/Mistral-7B-Instruct-v0.3',
          messages,
          max_tokens: 300,
          temperature: 0.6,
          stream: false,
        }),
      }
    );

    const responseText = await hfRes.text();
    console.log(`Chat HF status: ${hfRes.status} | ${responseText.slice(0, 200)}`);

    if (hfRes.status === 503) {
      return res.status(503).json({ error: 'Modèle en cours de chargement' });
    }

    if (!hfRes.ok) {
      return res.status(500).json({ error: `HF erreur ${hfRes.status}: ${responseText.slice(0, 100)}` });
    }

    try {
      const data = JSON.parse(responseText);
      let text = data.choices?.[0]?.message?.content || '';
      text = text.replace(/<[^>]+>/g, '').trim();
      const lastDot = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
      if (lastDot > 50) text = text.substring(0, lastDot + 1);
      return res.status(200).json({ response: text });
    } catch {
      return res.status(500).json({ error: 'Réponse non-JSON: ' + responseText.slice(0, 100) });
    }

  } catch (err) {
    console.error('chat error:', err);
    return res.status(500).json({ error: err.message });
  }
}
