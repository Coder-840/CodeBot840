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
    const moves = new Movements(bot, mcData);
    moves.canDig = true;
    bot.pathfinder.setMovements(moves);
    bot.pvp.movements = moves; // CRITICAL: This is why he wasn't moving!
    console.log('CodeBot840: Combat & Movement Engine Loaded');
  });

  // AUTO-HUNT SCANNER
  setInterval(() => {
    if (bot.pvp.target) return;
    const target = Object.values(bot.entities).find(e =>
      e.type === 'player' && e.username && bountyList.has(e.username.toLowerCase())
    );
    if (target) {
      bot.pathfinder.setGoal(null); // Stop wandering
      bot.pvp.attack(target);
      bot.chat(`Bounty detected: ${target.username}. Commencing termination.`);
    }
  }, 1000);

  // AUTO-EQUIP
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

    // 1. HELP (Single Line)
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $hunt [user], $whitelist [user], $bountylist, $locate [user], $kill');
    }

    // 2. REPEAT (2500ms delay)
    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count)) return;
      for (let i = 0; i < count; i++) {
        bot.chat(repeatMsg);
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    // 3. BOUNTY SYSTEM
    else if (command === '$hunt') {
      const targetName = args[1]?.toLowerCase();
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      const target = Object.values(bot.entities).find(e => e.username?.toLowerCase() === targetName);
      if (target) {
        bot.pathfinder.setGoal(null);
        bot.pvp.attack(target);
        bot.chat(`I see you, ${target.username}. Lock acquired.`);
      } else {
        bot.chat(`${targetName} added to bounty list. I will strike when seen.`);
      }
    }

    else if (command === '$whitelist') {
      const targetName = args[1]?.toLowerCase();
      if (bountyList.delete(targetName)) {
        bot.chat(`${targetName} has been spared.`);
        bot.pvp.stop();
      }
    }

    // 4. AI ASK (Expanded length)
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me a question!");
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto", 
          messages: [
            { role: "system", content: "You are CodeBot840, an intelligent anarchy bot. You are allowed to type long, detailed paragraphs. Answer accurately based on context." },
            { role: "user", content: `Logs: ${chatLogs.join(' | ')}\nQ: ${question}` }
          ],
          max_tokens: 300 // Allows for the "paragraphs" you wanted
        });
        
        const answer = completion.choices?.[0]?.message?.content;
        if (answer) {
          const cleanAnswer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          // Minecraft chat max is ~256-320 depending on server. Substring to 250 to stay safe.
          bot.chat(cleanAnswer.substring(0, 250)); 
        }
      } catch (err) {
        bot.chat("AI Error. Check logs.");
      }
    }

    // 5. UTILITY
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
