// api/chat.js — Vercel Serverless Function
const SYSTEM_PROMPT = `Tu es Amani Justice, un assistant juridique mauritanien expert.
Tu connais le droit mauritanien : code du travail, droit de la famille (Moudawwana), droits civiques, anti-corruption.
Réponds TOUJOURS dans la même langue que l'utilisateur.
Sois concis (3-5 phrases), cite les articles de loi mauritaniens pertinents.
Commence par reconnaître la situation avec empathie.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { question } = req.body;
  const prompt = `<s>[INST] ${SYSTEM_PROMPT}\n\nQuestion : ${question} [/INST]`;

  try {
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
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
      await new Promise(r => setTimeout(r, 25000));
      return handler(req, res);
    }

    const data = await hfRes.json();
    let text = Array.isArray(data) ? data[0].generated_text : data.generated_text || '';
    text = text.replace(/<[^>]+>/g, '').trim();
    const lastDot = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (lastDot > 50) text = text.substring(0, lastDot + 1);

    return res.status(200).json({ response: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
