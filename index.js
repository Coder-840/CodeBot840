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
let bountyList = new Set();

// --- SECURITY SETTINGS ---
let ignoreOthers = true; // Default to TRUE so strangers can't mess with it
const whiteList = new Set(['player_840', 'chickentender']); 

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai",
  apiKey: "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"
});

const cleanName = (name) => name ? name.replace(/§[0-9a-fk-or]/gi, '').toLowerCase() : '';

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const moves = new Movements(bot, mcData);
    moves.canDig = true;
    bot.pathfinder.setMovements(moves);
    bot.pvp.movements = moves;
    console.log('CodeBot840 Online. Security: ' + (ignoreOthers ? 'Whitelisted Only' : 'Public'));
  });

  // AUTO-HUNT
  setInterval(() => {
    if (bot.pvp.target) return;
    const target = Object.values(bot.entities).find(e =>
      e.type === 'player' && e.username && bountyList.has(cleanName(e.username))
    );
    if (target) {
      bot.pvp.attack(target);
      bot.chat(`Engaging bounty: ${target.username}!`);
    }
  }, 1000);

  bot.on('chat', async (username, message) => {
    const sender = cleanName(username);
    if (sender === cleanName(bot.username)) return;

    // 1. SECURITY CHECK
    if (ignoreOthers && !whiteList.has(sender)) {
        // If a stranger tries to use a command, bot ignores it
        if (message.startsWith('$')) return; 
        
        // Still log their chat for AI context though
        chatLogs.push(`${username}: ${message}`);
        if (chatLogs.length > 15) chatLogs.shift();
        return;
    }

    // Process logs for whitelisted users
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // 2. NEW COMMAND: $ignore true/false
    if (command === '$ignore') {
      const mode = args[1]?.toLowerCase();
      if (mode === 'true') {
        ignoreOthers = true;
        bot.chat("Security Enabled: I will only listen to my masters.");
      } else if (mode === 'false') {
        ignoreOthers = false;
        bot.chat("Security Disabled: I am now public property.");
      } else {
        bot.chat(`Current Status: Ignore Others is ${ignoreOthers}`);
      }
    }

    // --- REST OF COMMANDS ---
    else if (command === '$help') {
      bot.chat('Commands: $ignore [t/f], $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $hunt [user], $whitelist [user], $kill');
    }

    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return;
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    else if (command === '$hunt') {
      const targetName = args[1]?.toLowerCase();
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      bot.chat(`${targetName} added to bounty list.`);
    }

    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me a question!");
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto",
          messages: [
            { role: "system", content: "You are CodeBot840. Provide detailed paragraphs if asked." },
            { role: "user", content: `Context: ${chatLogs.join(' | ')}\nQ: ${question}` }
          ]
        });
        const answer = completion.choices?.[0]?.message?.content;
        if (answer) {
          const cleanAnswer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          const chunks = cleanAnswer.match(/.{1,200}(\s|$)/g) || [cleanAnswer];
          for (const chunk of chunks) {
            bot.chat(chunk.trim());
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      } catch (err) { bot.chat("AI Error."); }
    }

    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (!isNaN(x)) bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
    }

    else if (command === '$kill') {
      bot.chat('/kill');
    }
  });

  bot.on('messagestr', (m) => {
    if (m.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (m.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });

  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
