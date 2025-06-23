const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let queue = loadData();

app.post('/queue', (req, res) => {
  const { id, content, timestamp } = req.body || {};
  if (!id || !timestamp) {
    return res.status(400).json({ error: 'invalid payload' });
  }
  if (queue.find(m => m.id === id)) {
    return res.status(200).json({ status: 'duplicate' });
  }
  queue.push({ id, content, timestamp });
  try {
    saveData(queue);
  } catch (e) {
    console.error('Failed to save data:', e);
  }
  res.json({ status: 'queued' });
});

app.get('/next', (req, res) => {
  const item = queue.find(m => !m.label);
  if (!item) return res.status(404).end();
  res.json({ id: item.id, content: item.content });
});

app.post('/label', (req, res) => {
  const { id, label } = req.body || {};
  const item = queue.find(m => m.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  if (item.label) return res.status(200).json({ status: 'already labeled' });
  item.label = label;
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
