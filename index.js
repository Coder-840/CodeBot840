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

  // Skill: Clean color codes from names (Required for Anarchy servers)
  const cleanName = (name) => name ? name.replace(/§[0-9a-fk-or]/gi, '').toLowerCase() : '';

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const moves = new Movements(bot, mcData);
    moves.canDig = true;
    bot.pathfinder.setMovements(moves);
    bot.pvp.movements = moves;
    console.log('--- CodeBot840: Online & Lethal ---');
  });

  // AUTO-HUNT SCANNER (Fixed with Clean Names)
  setInterval(() => {
    if (bot.pvp.target) return;
    
    const target = Object.values(bot.entities).find(e => {
      if (e.type !== 'player' || !e.username) return false;
      return bountyList.has(cleanName(e.username));
    });

    if (target) {
      bot.pathfinder.setGoal(null);
      bot.pvp.attack(target);
      bot.chat(`Target locked: ${cleanName(target.username)}. Executing.`);
    }
  }, 1000);

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

    // 3. BOUNTY SYSTEM (Fixed with cleanName)
    else if (command === '$hunt') {
      const targetName = cleanName(args[1]);
      if (!targetName) return bot.chat("Usage: $hunt [player]");
      bountyList.add(targetName);
      bot.chat(`${targetName} is now a priority target.`);
    }

    else if (command === '$whitelist') {
      const targetName = cleanName(args[1]);
      if (bountyList.delete(targetName)) {
        bot.chat(`${targetName} removed from list.`);
        bot.pvp.stop();
      }
    }

    // 4. AI ASK (Fixed Response Structure)
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me a question!");
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto", 
          messages: [
            { role: "system", content: "You are CodeBot840, an anarchy bot. Answer detailed questions accurately." },
            { role: "user", content: `Context: ${chatLogs.join(' | ')}\nQ: ${question}` }
          ],
          max_tokens: 300
        });
        
        // Robust response parsing
        const answer = completion.choices?.[0]?.message?.content || completion.choices?.[0]?.text;
        if (answer) {
          const cleanAnswer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          bot.chat(cleanAnswer.substring(0, 250)); 
        }
      } catch (err) {
        console.log('AI Error:', err.message);
        bot.chat("AI Error. Check logs.");
      }
    }

    // 5. UTILITY
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (isNaN(x)) return;
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }
    else if (command === '$kill') {
      bot.chat('/kill');
    }
  });

  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
