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

// NEW API KEY INTEGRATED
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai",
  apiKey: "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"
});

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  // SKILL: Auto-Equip Gear (Checks inventory every 5 seconds)
  setInterval(() => {
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    armorTypes.forEach(type => {
      const armor = bot.inventory.items().find(item => item.name.includes(type));
      if (armor) bot.equip(armor, type).catch(() => {});
    });
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) bot.equip(sword, 'hand').catch(() => {});
  }, 5000);

  // AUTO-HUNT SCANNER
  setInterval(() => {
    if (bot.pvp.target) return;
    const playerEntity = bot.nearestEntity(e => 
      e.type === 'player' && bountyList.has(e.username)
    );
    if (playerEntity) {
      bot.chat(`Bounty detected: ${playerEntity.username}. Initiating combat.`);
      bot.pvp.attack(playerEntity);
    }
  }, 2000);

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // 1. HELP (Throttled for Anti-Spam)
    if (command === '$help') {
      const helpLines = [
        'CodeBot840 Commands: $coords, $kill, $hunt <player>, $whitelist <player>, $bountylist, $goto <x> <y> <z>, $ask <message>',
      ];
      for (const line of helpLines) {
        bot.chat(line);
        await new Promise(r => setTimeout(r, 2500)); 
      }
    }

    // 2. REPEAT
    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return bot.chat("Usage: $repeat hello 3");
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 1600)); 
      }
    }

    // 3. HUNTING & BOUNTIES
    else if (command === '$hunt') {
      const targetName = args[1];
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      const target = bot.players[targetName]?.entity;
      if (target) {
        bot.chat(`Target found! Engaging ${targetName}.`);
        bot.pvp.attack(target);
      } else {
        bot.chat(`${targetName} added to bounty list.`);
      }
    }

    else if (command === '$whitelist') {
      const target = args[1];
      if (bountyList.delete(target)) {
        bot.chat(`${target} has been pardoned.`);
        if (bot.pvp.target?.username === target) bot.pvp.stop();
      }
    }

    else if (command === '$bountylist') {
      const names = Array.from(bountyList);
      bot.chat(names.length > 0 ? `Active Bounties: ${names.join(', ')}` : "Kill list is empty.");
    }

    // 4. MOVEMENT & UTILITY
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) return bot.chat("Usage: $goto X Y Z");
      const mcData = require('minecraft-data')(bot.version);
      const move = new Movements(bot, mcData);
      move.canDig = true;
      bot.pathfinder.setMovements(move);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      bot.chat(`Walking to ${x}, ${y}, ${z}`);
    }

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
        bot.chat("Target is not in my render distance.");
      }
    }

    else if (command === '$kill') {
      bot.chat('/kill');
    }

    // 5. AI ASK (Gemma 2 9B - Fast & Free)
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      try {
        const completion = await openrouter.chat.completions.create({
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: [{ role: "user", content: `Logs: ${chatLogs.join('\n')}\nQuestion: ${question}` }]
        });
        bot.chat(completion.choices[0].message.content.substring(0, 100));
      } catch (err) {
        bot.chat("AI Error. Key may be inactive.");
      }
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
