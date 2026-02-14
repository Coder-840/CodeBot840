const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Ollama } = require('ollama');

// CONFIGURATION
const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
};
const PASSWORD = 'YourSecurePassword123';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const ollama = new Ollama({ host: OLLAMA_URL });

let chatLogs = []; // Stores last 15 messages for AI context

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  bot.loadPlugin(pathfinder);

  // --- COMMAND LOGIC ---
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    // Record logs for $ask context
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // $help
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $goto [x] [y] [z], $ask [question]');
    }

    // $coords
    else if (command === '$coords') {
      const { x, y, z } = bot.entity.position;
      bot.chat(`Coords: X:${Math.round(x)} Y:${Math.round(y)} Z:${Math.round(z)}`);
    }

    // $repeat [msg] [count] (with 1.5s delay to avoid throttle)
    else if (command === '$repeat') {
      const count = Math.min(parseInt(args[args.length - 1]), 10);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count) || !repeatMsg) return bot.chat('Usage: $repeat hello 3');
      
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(res => setTimeout(res, 1500)); 
      }
    }

    // $goto [x] [y] [z] (will mine blocks in way)
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) return bot.chat('Usage: $goto 100 64 100');

      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.canDig = true; // Skill: Mining enabled
      
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      bot.chat(`Moving to ${x}, ${y}, ${z}...`);
    }

    // $ask [question] (Ollama with History)
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      try {
        const response = await ollama.chat({
          model: 'gemma3',
          messages: [
            { role: 'system', content: 'You are CodeBot840 on a Minecraft server. Keep responses under 100 characters.' },
            { role: 'user', content: `Chat History:\n${chatLogs.join('\n')}\n\nQuestion: ${question}` }
          ]
        });
        bot.chat(response.message.content.substring(0, 100));
      } catch (err) {
        bot.chat("Ollama API unreachable. Check tunnel!");
      }
    }
  });

  // --- CORE LOGIC (Auth/Safety) ---
  bot.on('messagestr', (msg) => {
    if (msg.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (msg.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });

  bot.on('spawn', () => console.log('CodeBot840 is online!'));
  bot.on('kicked', (reason) => {
    console.log('Kicked:', reason);
    setTimeout(startBot, 10000); // Reconnect loop
  });
  bot.on('error', (err) => setTimeout(startBot, 10000));
}

startBot();
