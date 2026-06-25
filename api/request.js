const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1517706658581712896';
const CATEGORY_ID = null; // set this to a category ID if you want requests in a specific category

async function discordRequest(endpoint, options = {}) {
  const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Discord API error ${res.status}: ${err}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { game, item, username } = req.body;
  if (!game || !item) return res.status(400).json({ error: 'Missing game or item' });

  try {
    // Create a new channel for this request
    const channelName = `req-${item.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`;
    const channelBody = {
      name: channelName,
      type: 0, // text channel
      topic: `Request from ${username || 'Anonymous'} — ${game}: ${item}`,
      ...(CATEGORY_ID ? { parent_id: CATEGORY_ID } : {})
    };

    const channel = await discordRequest(`/guilds/${GUILD_ID}/channels`, {
      method: 'POST',
      body: JSON.stringify(channelBody)
    });

    // Send an embed in the new channel
    const embed = {
      color: 0x52b788,
      title: '📥 New Item Request',
      fields: [
        { name: 'Game', value: `\`${game}\``, inline: true },
        { name: 'Item', value: `\`${item}\``, inline: true },
        { name: 'From', value: username || 'Anonymous', inline: true }
      ],
      footer: { text: "Blake's Garden Shop" },
      timestamp: new Date().toISOString()
    };

    await discordRequest(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: '<@1311800649742291034>',
        embeds: [embed]
      })
    });

    res.status(200).json({ success: true, channel: channel.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
