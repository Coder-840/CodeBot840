const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');

// Helper at top scope
const cleanName = (name) => name ? name.replace(/§[0-9a-fk-or]/gi, '').toLowerCase() : '';

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
};

const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];
let bountyList = new Set();

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai",
  apiKey: "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"
});

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.on('login', () => {
    console.log('Connected to proxy.');
    setTimeout(() => bot.chat('/play'), 2000);
  });

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const moves = new Movements(bot, mcData);
    moves.canDig = true;
    bot.pathfinder.setMovements(moves);
    bot.pvp.movements = moves;
    console.log('CodeBot840: Spawned');
  });

  // AUTO-HUNT SCANNER
  setInterval(() => {
    if (bot.pvp.target) return;
    const target = Object.values(bot.entities).find(e => {
      if (e.type !== 'player' || !e.username) return false;
      return bountyList.has(cleanName(e.username));
    });

    if (target) {
      bot.pathfinder.setGoal(null);
      bot.pvp.attack(target);
      bot.chat(`Engaging bounty: ${cleanName(target.username)}`);
    }
  }, 1000);

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $hunt [user], $whitelist [user], $bountylist, $locate [user], $kill');
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

    // FIXED $hunt - Grabs the username correctly
    else if (command === '$hunt') {
      const targetName = cleanName(args[1]);
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      bot.chat(`${targetName} added to bounty list.`);
      
      const target = Object.values(bot.entities).find(e => cleanName(e.username) === targetName);
      if (target) {
        bot.pathfinder.setGoal(null);
        bot.pvp.attack(target);
      }
    }

    else if (command === '$whitelist') {
      const targetName = cleanName(args[1]);
      if (bountyList.delete(targetName)) {
        bot.chat(`${targetName} spared.`);
        bot.pvp.stop();
      }
    }

    else if (command === '$bountylist') {
      bot.chat(`Targets: ${Array.from(bountyList).join(', ') || 'None'}`);
    }

    // REVERTED TO YOUR WORKING $ASK VERSION
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me a question!");
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto",
          messages: [
            { role: "system", content: "You are CodeBot840. Be extremely brief (max 100 chars)." },
            { role: "user", content: `Context: ${chatLogs.join(' | ')}\nQ: ${question}` }
          ]
        });
        
        const answer = completion.choices?.[0]?.message?.content;
        if (answer) {
          const cleanAnswer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          bot.chat(cleanAnswer.substring(0, 100));
        } else {
          bot.chat("AI returned an empty response.");
        }
      } catch (err) {
        console.error("AI Error:", err.message);
        bot.chat("AI Error: Check logs.");
      }
    }

    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x)) return;
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
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
