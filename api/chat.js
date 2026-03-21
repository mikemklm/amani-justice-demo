export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, lang, history } = req.body;
    if (!question) return res.status(400).json({ error: 'Question manquante' });

    const token = process.env.GROQ_API_KEY;
    if (!token) return res.status(500).json({ error: 'GROQ_API_KEY manquant' });

    const SYSTEM = `Tu es Amani Justice, assistante juridique mauritanienne experte et bienveillante.
Tu connais parfaitement le droit mauritanien : code du travail, droit de la famille (Moudawwana), droits civiques, anti-corruption.
Réponds TOUJOURS dans la même langue que l'utilisateur (français, arabe, ou wolof).
Sois concis (3-5 phrases max), cite les articles de loi mauritaniens pertinents quand utile.
Commence par reconnaître la situation avec empathie.`;

    const messages = [
      { role: 'system', content: SYSTEM },
      ...(history || []).slice(-6),
      { role: 'user', content: question }
    ];

    const groqRes = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          max_tokens: 300,
          temperature: 0.6,
        }),
      }
    );

    const responseText = await groqRes.text();
    console.log(`Groq chat ${groqRes.status}: ${responseText.slice(0, 200)}`);

    if (!groqRes.ok) {
      return res.status(500).json({ error: `Groq erreur ${groqRes.status}: ${responseText.slice(0, 150)}` });
    }

    const data = JSON.parse(responseText);
    let text = data.choices?.[0]?.message?.content || '';
    text = text.trim();
    const lastDot = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (lastDot > 50) text = text.substring(0, lastDot + 1);

    return res.status(200).json({ response: text });

  } catch (err) {
    console.error('chat error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
