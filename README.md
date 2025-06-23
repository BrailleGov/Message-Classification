# Message Classification

This prototype collects Discord messages and lets you label them as `safe` or `unsafe` through a simple web page.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `config.example.json` to `config.json` and fill in your Discord bot token and channel ID.
3. Start the web server:
   ```bash
   npm run server
   ```
4. In another terminal, run the Discord bot:
   ```bash
   npm run bot
   ```
5. Open [http://localhost:3000](http://localhost:3000) to label messages using the left (unsafe) and right (safe) arrow keys.

Messages and labels are stored in `data.json`.
