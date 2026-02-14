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
let ignoreOthers = true; 
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

  bot.on('login', () => setTimeout(() => bot.chat('/play'), 2000));

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const moves = new Movements(bot, mcData);
    moves.canDig = true;
    bot.pathfinder.setMovements(moves);
    bot.pvp.movements = moves;
    console.log('CodeBot840 Online.');
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

    // ALWAYS log chat so AI has context, regardless of whitelist
    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 20) chatLogs.shift();

    // SECURITY: If message is a command, check whitelist
    if (message.startsWith('$')) {
      if (ignoreOthers && !whiteList.has(sender)) return; // SILENTLY ignore strangers
    } else {
      return; // Not a command, stop processing
    }

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // COMMAND: $ignore
    if (command === '$ignore') {
      const mode = args[1]?.toLowerCase();
      if (mode === 'true') { ignoreOthers = true; bot.chat("Security: ON"); }
      else if (mode === 'false') { ignoreOthers = false; bot.chat("Security: OFF"); }
    }

    // COMMAND: $ask (Fixed Structure)
    else if (command === '$ask') {
      const question = args.slice(1).join(' ');
      if (!question) return bot.chat("Ask me something!");
      
      try {
        const completion = await openrouter.chat.completions.create({
          model: "openrouter/auto",
          messages: [
            { role: "system", content: "You are CodeBot840. Provide detailed paragraphs. Max 1000 chars." },
            { role: "user", content: `Context logs:\n${chatLogs.join('\n')}\n\nQuestion: ${question}` }
          ]
        });

        const answer = completion.choices?.[0]?.message?.content;
        if (answer) {
          const cleanAnswer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          // Split into 200 char chunks for MC chat
          const chunks = cleanAnswer.match(/.{1,200}(\s|$)/g) || [cleanAnswer];
          for (const chunk of chunks) {
            bot.chat(chunk.trim());
            await new Promise(r => setTimeout(r, 1200));
          }
        } else {
          bot.chat("AI returned empty.");
        }
      } catch (err) {
        bot.chat("AI Error.");
        console.error(err);
      }
    }

    // COMMAND: $hunt
    else if (command === '$hunt') {
      const target = args[1]?.toLowerCase();
      if (target) {
        bountyList.add(target);
        bot.chat(`${target} added to kill list.`);
      }
    }

    // COMMAND: $goto
    else if (command === '$goto') {
      const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
      if (!isNaN(x)) bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    }

    // COMMAND: $coords
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
    }

    // COMMAND: $kill
    else if (command === '$kill') {
      bot.chat('/kill');
    }
    
    // COMMAND: $help
    else if (command === '$help') {
        bot.chat('Commands: $ignore [t/f], $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $hunt [user], $kill');
    }
  });

  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
