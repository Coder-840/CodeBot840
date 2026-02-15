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

// ===== IGNORE SYSTEM =====
let ignoreMode = false;
const ignoreAllowed = new Set(['player_840', 'chickentender']);

// ===== NEW HUNT SYSTEM =====
let huntTargets = new Set();
let currentTarget = null;

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "REPLACE_WITH_NEW_KEY"
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

  // =========================
  // HUNT ENGINE
  // =========================

  function findTarget() {
    for (const name in bot.players) {
      const player = bot.players[name];
      if (!player.entity) continue;

      const clean = name.toLowerCase();

      if (huntTargets.has(clean) &&
         (!ignoreMode || ignoreAllowed.has(clean))) {
        return player.entity;
      }
    }
    return null;
  }

  function tryAttack() {
    if (currentTarget && currentTarget.isValid) return;

    const target = findTarget();
    if (!target) return;

    currentTarget = target;
    bot.chat(`⚔ Engaging ${target.username}`);
    bot.pvp.attack(target);
  }

  setInterval(() => {

    if (currentTarget && !currentTarget.isValid) {
      currentTarget = null;
      bot.pvp.stop();
    }

    if (!currentTarget) {
      tryAttack();
    }

  }, 700);

  bot.on('entitySpawn', entity => {
    if (!entity.username) return;

    const name = entity.username.toLowerCase();

    if (huntTargets.has(name) &&
       (!ignoreMode || ignoreAllowed.has(name))) {

      currentTarget = entity;
      bot.chat(`🎯 Target spotted: ${entity.username}`);
      bot.pvp.attack(entity);
    }
  });

  // =========================
  // AUTO EQUIP
  // =========================
  setInterval(() => {
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    armorTypes.forEach(type => {
      const armor = bot.inventory.items().find(item => item.name.includes(type));
      if (armor) bot.equip(armor, type).catch(() => {});
    });
    const sword = bot.inventory.items().find(item => item.name.includes('sword'));
    if (sword) bot.equip(sword, 'hand').catch(() => {});
  }, 5000);

  // =========================
  // CHAT COMMANDS
  // =========================

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    if (ignoreMode && !ignoreAllowed.has(username.toLowerCase())) return;

    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 15) chatLogs.shift();

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // HELP
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat, $ask, $goto, $hunt, $whitelist, $bountylist, $kill, $ignore');
    }

    // REPEAT
    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return;
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    // HUNT ADD
    else if (command === '$hunt') {
      const name = args[1]?.toLowerCase();
      if (!name) return bot.chat("Usage: $hunt [player]");

      huntTargets.add(name);
      bot.chat(`${name} added to hunt list.`);
      tryAttack();
    }

    // HUNT REMOVE
    else if (command === '$whitelist') {
      const name = args[1]?.toLowerCase();
      if (!name) return;

      huntTargets.delete(name);

      if (currentTarget?.username?.toLowerCase() === name) {
        bot.pvp.stop();
        currentTarget = null;
      }

      bot.chat(`${name} removed.`);
    }

    // LIST
    else if (command === '$bountylist') {
      bot.chat(`Targets: ${[...huntTargets].join(', ') || 'None'}`);
    }

    // AI ASK
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me something.");

      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto",
          max_tokens: 500,
          messages: [
            { role: "system", content: "You are CodeBot840. Be concise and accurate." },
            { role: "user", content: `Context: ${chatLogs.join(' | ')}\nQ: ${question}` }
          ]
        });

        const answer = completion.choices?.[0]?.message?.content;
        if (answer) {
          const clean = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          const safe = clean.slice(0, 1000);
          bot.chat(safe.endsWith('.') ? safe : safe + '...');
        } else {
          bot.chat("AI returned nothing.");
        }

      } catch (err) {
        console.error("AI Error:", err.message);
        bot.chat("AI request failed.");
      }
    }

    // GOTO
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x)) return;
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    // COORDS
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
    }

    // SUICIDE
    else if (command === '$kill') {
      bot.chat('/kill');
    }

    // IGNORE
    else if (command === '$ignore') {
      const state = args[1]?.toLowerCase();

      if (state === 'true') {
        ignoreMode = true;
        bot.chat('Ignore enabled.');
      }
      else if (state === 'false') {
        ignoreMode = false;
        bot.chat('Ignore disabled.');
      }
      else {
        bot.chat('Usage: $ignore true/false');
      }
    }
  });

  // =========================
  // LOGIN AUTO
  // =========================
  bot.on('messagestr', (m) => {
    if (m.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (m.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });

  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
