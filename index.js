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

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    bot.pvp.movements = new Movements(bot, mcData);
    bot.pvp.movements.canDig = true;
    console.log('CodeBot840 spawned and movement engine initialized.');
  });

  setInterval(() => {
    if (bot.pvp.target) return;

    const target = Object.values(bot.entities).find(e =>
      e.type === 'player' &&
      e.username &&
      bountyList.has(e.username.toLowerCase())
    );

    if (target) {
      bot.pvp.attack(target);
      bot.chat(`Engaging bounty: ${target.username}!`);
    }
  }, 1000);

  setInterval(() => {
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    armorTypes.forEach(type => {
      const armor = bot.inventory.items().find(item => item.name.includes(type));
      if (armor) bot.equip(armor, type).catch(() => {});
    });
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) bot.equip(sword, 'hand').catch(() => {});
  }, 5000);

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

    else if (command === '$hunt') {
      const targetName = args[1]?.toLowerCase();
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      bot.chat(`${targetName} added to bounty list.`);
    }

    else if (command === '$whitelist') {
      const targetName = args[1]?.toLowerCase();
      if (bountyList.delete(targetName)) {
        bot.chat(`${targetName} pardoned.`);
        bot.pvp.stop();
      }
    }

    else if (command === '$bountylist') {
      bot.chat(`Targets: ${Array.from(bountyList).join(', ') || 'None'}`);
    }

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
        const answer = completion.choices?.[0]?.message?.content;
        if (answer) {
          bot.chat(answer.substring(0, 100));
        } else {
          bot.chat("No response from AI.");
        }
      } catch (err) {
        bot.chat("AI Error. Check key status.");
        console.error(err);
      }
    }

    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x)) return;
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`Coords: ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)}`);
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
