const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { BOT_TOKEN, CHANNEL_ID, GUILD_ID } = config;

const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    let id = 1;
    return data.map(item => ({
      id: id++,
      content: item.content,
      label: item.label,
      sourceId: item.sourceId,
      timestamp: item.timestamp,
      authorId: item.authorId
    }));
  } catch (e) {
    return [];
  }
}

function saveData(data) {
  const stripped = data.map(item => ({
    content: item.content,
    label: item.label,
    sourceId: item.sourceId,
    timestamp: item.timestamp,
    authorId: item.authorId
  }));
  fs.writeFileSync(DATA_FILE, JSON.stringify(stripped, null, 2));
}

let queue = loadData();
let nextId = queue.reduce((max, m) => Math.max(max, m.id), 0) + 1;

app.post('/queue', (req, res) => {
  const { id: sourceId, content, timestamp, authorId } = req.body || {};
  if (!sourceId || !timestamp) {
    return res.status(400).json({ error: 'invalid payload' });
  }
  if (queue.find(m => m.sourceId === sourceId)) {
    return res.status(200).json({ status: 'duplicate' });
  }

  let label;
  const existing = queue.find(m => m.label && m.content === content);
  if (existing) label = existing.label;

  const item = { id: nextId++, sourceId, content, timestamp, authorId };
  if (label) item.label = label;
  queue.push(item);
  try {
    saveData(queue);
  } catch (e) {
    console.error('Failed to save data:', e);
  }
  res.json({ status: label ? 'auto-labeled' : 'queued' });
});

function getNextItem() {
  for (const item of queue) {
    if (item.label) continue;
    const dup = queue.find(m => m.label && m.content === item.content);
    if (dup) {
      item.label = dup.label;
      continue;
    }
    return item;
  }
  return null;
}

app.get('/next', (req, res) => {
  const item = getNextItem();
  if (!item) return res.status(404).end();
  res.json({ id: item.id, content: item.content });
});

async function deleteMessage(id) {
  try {
    const res = await fetch(`https://discord.com/api/channels/${CHANNEL_ID}/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    if (!res.ok) {
      console.error('Failed to delete message', id, await res.text());
    }
  } catch (e) {
    console.error('Delete message error:', e);
  }
}

async function muteMember(userId, durationMs) {
  const until = new Date(Date.now() + durationMs).toISOString();
  try {
    const res = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ communication_disabled_until: until })
    });
    if (!res.ok) {
      console.error('Failed to mute member', userId, await res.text());
    }
  } catch (e) {
    console.error('Mute member error:', e);
  }
}

app.post('/label', async (req, res) => {
  const { id, label } = req.body || {};
  const item = queue.find(m => m.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  if (item.label) return res.status(200).json({ status: 'already labeled' });

  const action = label;
  const storedLabel = label === 'mute' ? 'unsafe' : label;
  item.label = storedLabel;
  queue.forEach(m => {
    if (m !== item && m.content === item.content) m.label = storedLabel;
  });

  if ((action === 'unsafe' || action === 'mute') && item.sourceId) {
    await deleteMessage(item.sourceId);
  }
  if (action === 'mute' && item.authorId) {
    await muteMember(item.authorId, 5 * 60 * 1000);
  }

  try {
    saveData(queue);
  } catch (e) {
    console.error('Failed to save data:', e);
  }
  res.json({ status: 'labeled' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
