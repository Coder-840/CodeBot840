const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const OpenAI = require('openai');

// OpenRouter Configuration
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "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",
  defaultHeaders: {
    "HTTP-Referer": "https://railway.app", // Optional for OpenRouter rankings
    "X-Title": "CodeBot840"
  }
});

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
};
const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  bot.loadPlugin(pathfinder);

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 10) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // --- COMMANDS ---
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $goto [x] [y] [z], $ask [question]');
    }

    else if (command === '$coords') {
      const { x, y, z } = bot.entity.position;
      bot.chat(`X:${Math.round(x)} Y:${Math.round(y)} Z:${Math.round(z)}`);
    }

    else if (command === '$repeat') {
      const count = Math.min(parseInt(args[args.length - 1]), 10);
      const repeatMsg = args.slice(1, -1).join(' ');
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      const mcData = require('minecraft-data')(bot.version);
      const move = new Movements(bot, mcData);
      move.canDig = true;
      bot.pathfinder.setMovements(move);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      bot.chat(`Walking to ${x} ${y} ${z}...`);
    }

    else if (command === '$ask') {
      const prompt = args.slice(1).join(' ');
      try {
        const completion = await openrouter.chat.completions.create({
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: [
            { role: "system", content: "You are CodeBot840 on an anarchy server. Be brief." },
            { role: "user", content: `Logs:\n${chatLogs.join('\n')}\n\nQuestion: ${prompt}` }
          ],
        });
        bot.chat(completion.choices[0].message.content.substring(0, 100));
      } catch (err) {
        bot.chat("AI Error - Key might be empty or restricted.");
      }
    }
  });

  // --- RECONNECT & AUTH ---
  bot.on('messagestr', (msg) => {
    if (msg.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (msg.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });
  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
