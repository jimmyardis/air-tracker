export default async function handler(req, res) {
  // 1. CORS HANDSHAKE (The "Door Opener")
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. PREFLIGHT CHECK (Stop the crash)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Method Check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { entries } = req.body;

    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    // Organize entries
    const organized = {
      performance: entries.filter(e => e.category === 'performance'),
      leadership: entries.filter(e => e.category === 'leadership'),
      training: entries.filter(e => e.category === 'training'),
      other: entries.filter(e => e.category === 'other')
    };

    // 4. AI PROMPT (Narrative Format - 350 chars)
    const prompt = `You are an expert US Air Force writer specializing in the new EPB (Enlisted Performance Brief) Narrative Statement format.

    TASK: Convert logged accomplishments into strong Narrative Statements.
    
    RULES:
    - Write in full, grammatically correct sentences (Active Voice).
    - Limit: 350 characters per statement.
    - Structure: Action -> Impact -> Result/Leadership.
    - Focus on Executing the Mission, Leading People, Managing Resources.

    INPUT DATA:
    Mission: ${organized.performance.map(e => `- ${e.text} (${e.date})`).join('; ') || 'None'}
    Leadership: ${organized.leadership.map(e => `- ${e.text} (${e.date})`).join('; ') || 'None'}
    Training: ${organized.training.map(e => `- ${e.text} (${e.date})`).join('; ') || 'None'}
    Other: ${organized.other.map(e => `- ${e.text} (${e.date})`).join('; ') || 'None'}

    OUTPUT JSON:
    {
      "performance": [{"bullet": "Narrative sentence...", "chars": 210}],
      "leadership": [],
      "training": [],
      "other": []
    }`;

    // 5. CALL CLAUDE
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
        const err = await response.json();
        console.error(err);
        return res.status(500).json({ error: 'AI Error', details: err });
    }

    const data = await response.json();
    const resultText = data.content[0].text;
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return res.status(200).json({ success: true, bullets: JSON.parse(jsonMatch[0]) });
    } else {
      return res.status(200).json({ success: true, raw: resultText });
    }

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
