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

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai",
  apiKey: "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"
});

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  // --- AUTO-HUNT LOGIC ---
  // Scans render distance every 2 seconds for bounties
  setInterval(() => {
    if (bot.pvp.target) return; // Don't switch if already fighting

    const playerEntity = bot.nearestEntity(e => 
      e.type === 'player' && bountyList.has(e.username)
    );

    if (playerEntity) {
      bot.chat(`Bounty detected! Engaging ${playerEntity.username}...`);
      bot.pvp.attack(playerEntity);
    }
  }, 2000);

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // 1. UPDATED $help
    if (command === '$help') {
      bot.chat('--- CodeBot840 Commands ---');
      bot.chat('$coords - Get bot location');
      bot.chat('$repeat [msg] [count] - Throttled repeat');
      bot.chat('$ask [question] - AI response');
      bot.chat('$goto [x] [y] [z] - Pathfind & mine');
      bot.chat('$hunt [player] - Add to kill list & attack');
      bot.chat('$whitelist [player] - Remove from kill list');
      bot.chat('$bountylist - View kill list');
      bot.chat('$locate [player] - Find nearby player');
      bot.chat('$kill - Bot executes /kill');
    }

    // 2. $repeat [msg] [count]
    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return bot.chat("Usage: $repeat hello 3");
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 1600)); 
      }
    }

    // 3. $hunt [player]
    else if (command === '$hunt') {
      const targetName = args[1];
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      const target = bot.players[targetName]?.entity;
      if (target) {
        bot.chat(`Target ${targetName} found! Engaging.`);
        bot.pvp.attack(target);
      } else {
        bot.chat(`${targetName} added to bounty list. I will attack when seen.`);
      }
    }

    // 4. $whitelist [player]
    else if (command === '$whitelist') {
      const target = args[1];
      if (bountyList.delete(target)) {
        bot.chat(`${target} removed from bounty list.`);
        if (bot.pvp.target?.username === target) bot.pvp.stop();
      }
    }

    // 5. $bountylist
    else if (command === '$bountylist') {
      const names = Array.from(bountyList);
      bot.chat(names.length > 0 ? `Bounties: ${names.join(', ')}` : "No active bounties.");
    }

    // 6. $goto [x] [y] [z]
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      const mcData = require('minecraft-data')(bot.version);
      const move = new Movements(bot, mcData);
      move.canDig = true;
      bot.pathfinder.setMovements(move);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      bot.chat(`Moving to ${x} ${y} ${z}`);
    }

    // 7. $coords & $locate & $kill
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
    }
    else if (command === '$locate') {
      const target = bot.players[args[1]]?.entity;
      if (target) {
        const p = target.position;
        bot.chat(`${args[1]} is at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
      } else {
        bot.chat("Player not in render distance.");
      }
    }
    else if (command === '$kill') {
      bot.chat('/kill');
      bot.chat('Goodbye, cruel world... T-T');
    }

    // 8. $ask [question]
    else if (command === '$ask') {
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/free",
          messages: [{ role: "user", content: `Context: ${chatLogs.join('\n')}\nQ: ${args.slice(1).join(' ')}` }]
        });
        bot.chat(completion.choices.message.content.substring(0, 100));
      } catch (err) { bot.chat("AI Error."); }
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
