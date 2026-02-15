const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
};

const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];
let bountyList = new Set();
let ignoreMode = true;
const ignoreAllowed = new Set(['player_840', 'chickentender']);

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
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
    console.log('CodeBot840 spawned. Combat/Movement ready.');
  });

  // ===== AUTO-HUNT =====
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

  // ===== AUTO-EQUIP =====
  setInterval(() => {
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    armorTypes.forEach(type => {
      const armor = bot.inventory.items().find(item => item.name.includes(type));
      if (armor) bot.equip(armor, type).catch(() => {});
    });
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) bot.equip(sword, 'hand').catch(() => {});
  }, 5000);

  // ===== CHAT HANDLER =====
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    // Always log all chat for AI
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 100) chatLogs.shift();
    console.log(`${username}: ${message}`);

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // Ignore mode only affects command handling
    const canInteract = !ignoreMode || ignoreAllowed.has(username.toLowerCase());
    if (!canInteract && command.startsWith('$')) return;

    // ===== COMMANDS =====
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $hunt [user], $whitelist [user], $bountylist, $kill, $ignore [true/false]');
    }

    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return;
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    else if (command === '$hunt') {
      const targetName = args[1]?.toLowerCase();
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      chatLogs.push(`SERVER: ${targetName} added to bounty list`);
      bot.chat(`${targetName} added to bounty list.`);
    }

    else if (command === '$whitelist') {
      const targetName = args[1]?.toLowerCase();
      if (bountyList.delete(targetName)) {
        chatLogs.push(`SERVER: ${targetName} removed from bounty list`);
        bot.chat(`${targetName} pardoned.`);
        bot.pvp.stop();
      }
    }

    else if (command === '$bountylist') {
      bot.chat(`Targets: ${Array.from(bountyList).join(', ') || 'None'}`);
    }

    // ===== SERVER-AWARE $ASK =====
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me a question!");
      try {
        const context = chatLogs.slice(-50).join(' | ');
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto",
          messages: [
            {
              role: "system",
              content: `You are CodeBot840, a fully server-aware bot. Be concise and informative. Use the last server messages (chat, deaths, joins, bounties) to answer if possible, max 240 characters per paragraph. Always answer player questions using outside knowledge if logs don't provide enough info. You are an expert in Minecraft, coding, and math.`
            },
            {
              role: "user",
              content: `Server messages (players + server events + bounties): ${context}\nQuestion: ${question}`
            }
          ]
        });

        let answer = completion.choices?.[0]?.message?.content || '';
        answer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (!answer) return bot.chat("AI returned an empty response.");

        const paragraphs = answer.split(/\r?\n/);
        for (let para of paragraphs) {
          para = para.trim();
          if (!para) continue;
          while (para.length > 0) {
            const chunk = para.substring(0, 256);
            bot.chat(chunk);
            para = para.substring(256);
            await new Promise(r => setTimeout(r, 500));
          }
        }

      } catch (err) {
        console.error("AI Error:", err.message);
        bot.chat("AI Error: Connection failed.");
      }
    }

    // ===== MOVEMENT / UTILITY =====
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x)) return;
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
    }
    else if (command === '$kill') {
      bot.chat('/kill');
    }
    else if (command === '$ignore') {
      const state = args[1]?.toLowerCase();
      if (state === 'true') {
        ignoreMode = true;
        bot.chat('Ignore mode enabled.');
      } else if (state === 'false') {
        ignoreMode = false;
        bot.chat('Ignore mode disabled.');
      } else {
        bot.chat('Usage: $ignore true/false');
      }
    }
  });

  // ===== SERVER EVENTS =====
  bot.on('messagestr', (message) => {
    console.log(`SERVER: ${message}`);
    chatLogs.push(`SERVER: ${message}`);
    if (chatLogs.length > 100) chatLogs.shift();

    if (message.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (message.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });

  bot.on('entityDeath', (entity) => {
    if (entity.type === 'player') {
      const deathMsg = `SERVER: ${entity.username} died`;
      console.log(deathMsg);
      chatLogs.push(deathMsg);
      if (chatLogs.length > 100) chatLogs.shift();
    }
  });

  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
