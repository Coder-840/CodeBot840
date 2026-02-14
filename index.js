const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
};

const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];
let bountyList = new Set(); // Stores unique player names

// OpenRouter AI Setup
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai",
  apiKey: "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"
});

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  
  // Load Plugins
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // 1. FIXED $repeat <msg> <count>
    if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return bot.chat("Usage: $repeat hello 3");
      
      // Fixed: Loop actually runs 'count' times
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 1500)); // Server cooldown
      }
    }

    // 2. $kill (Self-terminate)
    else if (command === '$kill') {
      bot.chat('/kill');
      bot.chat('Goodbye, world.');
    }

    // 3. $hunt <player> (Punch to death)
    else if (command === '$hunt') {
      const targetName = args[1];
      const target = bot.players[targetName]?.entity;
      if (target) {
        bot.chat(`Hunting ${targetName}...`);
        bountyList.add(targetName);
        bot.pvp.attack(target);
      } else {
        bot.chat(`I don't see ${targetName} nearby.`);
      }
    }

    // 4. $bountylist & $whitelist
    else if (command === '$bountylist') {
      const names = Array.from(bountyList);
      bot.chat(names.length > 0 ? `Target list: ${names.join(', ')}` : "The kill list is empty.");
    }
    else if (command === '$whitelist') {
      const target = args[1];
      if (bountyList.delete(target)) {
        bot.chat(`${target} has been spared.`);
        if (bot.pvp.target?.username === target) bot.pvp.stop();
      }
    }

    // 5. $locate <player> (Entity Awareness)
    else if (command === '$locate') {
      const targetName = args[1];
      const target = bot.players[targetName]?.entity;
      if (target) {
        const p = target.position;
        bot.chat(`${targetName} is at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
      } else {
        // Explaining the packet limitation
        bot.chat("Player is out of render distance. I can only locate players near me.");
      }
    }

    // 6. $ask (AI Response)
    else if (command === '$ask') {
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/free",
          messages: [{ role: "user", content: `Logs: ${chatLogs.join('\n')}\n\nQ: ${args.slice(1).join(' ')}` }]
        });
        bot.chat(completion.choices[0].message.content.substring(0, 100));
      } catch (err) { bot.chat("AI Error."); }
    }
  });

  // Reconnect & Auth logic
  bot.on('messagestr', (m) => {
    if (m.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (m.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });
  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
