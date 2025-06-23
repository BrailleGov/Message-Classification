const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { BOT_TOKEN, CHANNEL_ID, SERVER_BASE_URL } = config;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

async function postQueue(payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${SERVER_BASE_URL}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return true;
    } catch (e) {
      console.error('Queue post failed', e);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error('Giving up on message', payload.id);
  return false;
}

client.on('messageCreate', async (msg) => {
  if (msg.channelId !== CHANNEL_ID) return;
  if (msg.author.bot) return;
  const payload = {
    id: msg.id,
    content: msg.content,
    timestamp: msg.createdAt.toISOString()
  };
  await postQueue(payload);
});

client.login(BOT_TOKEN).then(() => {
  console.log('Discord bot logged in');
}).catch(err => {
  console.error('Failed to login:', err);
});
