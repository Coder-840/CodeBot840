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

  // Auto-Equip Skill
  setInterval(() => {
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    armorTypes.forEach(type => {
      const armor = bot.inventory.items().find(item => item.name.includes(type));
      if (armor) bot.equip(armor, type).catch(() => {});
    });
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) bot.equip(sword, 'hand').catch(() => {});
  }, 5000);

  // FIXED AUTO-HUNT (Injects movements for combat)
  setInterval(() => {
    if (bot.pvp.target) return;
    const playerEntity = bot.nearestEntity(e => e.type === 'player' && bountyList.has(e.username));
    if (playerEntity) {
      const mcData = require('minecraft-data')(bot.version);
      bot.pvp.movements = new Movements(bot, mcData);
      bot.pvp.attack(playerEntity);
    }
  }, 2000);

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // 1. SINGLE LINE $help
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $hunt [user], $whitelist [user], $bountylist, $locate [user], $kill');
    }

    // 2. REPEAT (2500ms Delay)
    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return bot.chat("Usage: $repeat hello 3");
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    // 3. FIXED $hunt & COMBAT
    else if (command === '$hunt') {
      const targetName = args[1];
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      const target = bot.players[targetName]?.entity;
      if (target) {
        const mcData = require('minecraft-data')(bot.version);
        bot.pvp.movements = new Movements(bot, mcData);
        bot.pvp.attack(target);
        bot.chat(`Engaging ${targetName}!`);
      } else {
        bot.chat(`${targetName} added to bounty. I'll attack when they're in range.`);
      }
    }

    else if (command === '$whitelist') {
      const target = args[1];
      if (bountyList.delete(target)) {
        bot.chat(`${target} pardoned.`);
        bot.pvp.stop();
      }
    }

    else if (command === '$bountylist') {
      bot.chat(`Targets: ${Array.from(bountyList).join(', ') || 'None'}`);
    }

    // 4. MOVEMENT
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x)) return bot.chat("Usage: $goto X Y Z");
      const mcData = require('minecraft-data')(bot.version);
      const move = new Movements(bot, mcData);
      move.canDig = true;
      bot.pathfinder.setMovements(move);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    // 5. FIXED $ask (Corrected Prompt Reference)
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me a question!");
      try {
        const completion = await openrouter.chat.completions.create({
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: [
            { role: "system", content: "You are CodeBot840. Be extremely brief (max 100 chars)." },
            { role: "user", content: `Context: ${chatLogs.join(' | ')}\n\nQuestion: ${question}` }
          ]
        });
        bot.chat(completion.choices[0].message.content.substring(0, 100));
      } catch (err) {
        bot.chat("AI Error. Is the key valid?");
        console.error(err);
      }
    }

    // 6. UTILITY
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`Coords: ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)}`);
    }
    else if (command === '$locate') {
      const target = bot.players[args[1]]?.entity;
      if (target) {
        const p = target.position;
        bot.chat(`${args[1]} is at ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)}`);
      } else {
        bot.chat("Player not nearby.");
      }
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
