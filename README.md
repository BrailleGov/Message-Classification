# Message Classification

This prototype collects Discord messages and lets you label them as `safe` or `unsafe` through a simple web page.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `config.example.json` to `config.json` and fill in your Discord bot token, channel ID and guild ID.
3. Copy `whitelist.json.example` to `whitelist.json` and list the IP addresses allowed to access the site.
4. Start the web server:
   ```bash
   npm run server
   ```
5. In another terminal, run the Discord bot:
   ```bash
   npm run bot
   ```
6. Open [http://localhost:3000](http://localhost:3000) to label messages using the arrow keys:
   - Left arrow: mark unsafe and delete the message.
   - Right arrow: mark safe.
   - Down arrow: mute 5 minutes and delete the message.
   - Up arrow: mute 15 minutes and delete the message.
   - Use the "Jump to Present" button to skip to the latest message.
   - The settings menu (gear icon) lets you adjust mute durations and toggle animations.

Messages and labels are stored in `data.json`.
