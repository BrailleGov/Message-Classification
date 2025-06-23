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
      displayed: false,
      sourceId: item.sourceId,
      timestamp: item.timestamp,
      authorId: item.authorId,
      username: item.username,
      displayName: item.displayName,
      avatar: item.avatar,
      roles: item.roles
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
    authorId: item.authorId,
    username: item.username,
    displayName: item.displayName,
    avatar: item.avatar,
    roles: item.roles
  }));
  fs.writeFileSync(DATA_FILE, JSON.stringify(stripped, null, 2));
}

let queue = loadData();
let nextId = queue.reduce((max, m) => Math.max(max, m.id), 0) + 1;

app.post('/queue', (req, res) => {
  const { id: sourceId, content, timestamp, authorId, username, displayName, avatar, roles } = req.body || {};
  if (!sourceId || !timestamp) {
    return res.status(400).json({ error: 'invalid payload' });
  }
  if (queue.find(m => m.sourceId === sourceId)) {
    return res.status(200).json({ status: 'duplicate' });
  }

  let label;
  const existing = queue.find(m => m.label && m.content === content);
  if (existing) label = existing.label;

  const item = { id: nextId++, sourceId, content, timestamp, authorId, username, displayName, avatar, roles, displayed: false };
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
    if (item.label || item.displayed) continue;
    const dup = queue.find(m => m.label && m.content === item.content);
    if (dup) {
      item.label = dup.label;
      continue;
    }
    item.displayed = true;
    return item;
  }
  return null;
}

app.get('/next', (req, res) => {
  const item = getNextItem();
  if (!item) return res.status(404).end();
  res.json({
    id: item.id,
    content: item.content,
    username: item.username,
    displayName: item.displayName,
    avatar: item.avatar,
    roles: item.roles
  });
});

app.post('/jump', (req, res) => {
  let last = null;
  for (let i = queue.length - 1; i >= 0; i--) {
    if (!queue[i].label) {
      last = queue[i];
      break;
    }
  }
  if (!last) return res.status(404).end();
  queue = queue.filter(item => item.label || item === last);
  last.displayed = true;
  try {
    saveData(queue);
  } catch (e) {
    console.error('Failed to save data:', e);
  }
  res.json({
    id: last.id,
    content: last.content,
    username: last.username,
    displayName: last.displayName,
    avatar: last.avatar,
    roles: last.roles
  });
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
  const { id, label, duration } = req.body || {};
  const item = queue.find(m => m.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  if (item.label) return res.status(200).json({ status: 'already labeled' });

  const action = label;
  const isMute = label === 'mute' || label === 'mute15';
  const storedLabel = isMute ? 'unsafe' : label;
  item.label = storedLabel;
  item.displayed = false;
  queue.forEach(m => {
    if (m !== item && m.content === item.content) m.label = storedLabel;
  });

  if ((action === 'unsafe' || isMute) && item.sourceId) {
    await deleteMessage(item.sourceId);
  }
  const durMin = typeof duration === 'number' ? Math.min(30, Math.max(5, duration)) : null;
  if (action === 'mute' && item.authorId) {
    const minutes = durMin ?? 5;
    await muteMember(item.authorId, minutes * 60 * 1000);
  }
  if (action === 'mute15' && item.authorId) {
    const minutes = durMin ?? 15;
    await muteMember(item.authorId, minutes * 60 * 1000);
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
