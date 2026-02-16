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
let ignoreMode = true;
const ignoreAllowed = new Set(['player_840', 'chickentender']);

let hunting = false; // ===== ADDED HUNT MODE FLAG =====

// ===== 3 MUSKETEERS SYSTEM =====
let musketsActive = false;
let musketBots = [];

const gibberishChars = [
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "0","1","2","3","4","5","6","7","8","9","!","\"","#","$","%","&","'","(",")","*","+",
  ",","-",".","/",":",";","<","=",">","?","@","[","\\","]","^","_","`","{","|","}","~",
  "§","À","Á","Â","Ã","Ä","Å","Æ","Ç","È","É","Ê","Ë","Ì","Í","Î","Ï","Ð","Ñ","Ò","Ó",
  "Ô","Õ","Ö","×","Ø","Ù","Ú","Û","Ü","Ý","Þ","ß","à","á","â","ã","ä","å","æ","ç","è",
  "é","ê","ë","ì","í","î","ï","ð","ñ","ò","ó","ô","õ","ö","÷","ø","ù","ú","û","ü","ý","þ","ÿ"
];

function randomGibberish() {
  let msg = "";
  const len = Math.floor(Math.random() * 6) + 3; // 3-8 characters
  for (let i = 0; i < len; i++) {
    msg += gibberishChars[Math.floor(Math.random() * gibberishChars.length)];
  }
  return msg;
}

function createMusket(username) {
  function spawnBot() {
    if (!musketsActive) return;

    const b = require('mineflayer').createBot({
      host: botArgs.host,
      port: botArgs.port,
      username: username,
      version: botArgs.version
    });

    musketBots.push(b);

    // ===== RANDOM CHAT =====
    b.once('spawn', () => {
      const interval = setInterval(() => {
        if (!musketsActive) {
          clearInterval(interval);
          return;
        }
        b.chat(randomGibberish());
      }, Math.random() * 4000 + 2000);
    });

    // ===== AUTO REGISTER / LOGIN =====
    b.on('messagestr', message => {
      if (message.includes('/register')) b.chat(`/register ${PASSWORD} ${PASSWORD}`);
      if (message.includes('/login')) b.chat(`/login ${PASSWORD}`);
    });

    // ===== AUTO RECONNECT ONLY IF KICKED =====
    b.on('kicked', reason => {
      console.log(username + " kicked:", reason);
      if (musketsActive) setTimeout(spawnBot, 8000);
    });

    // Normal disconnect does NOT reconnect
    b.on('end', () => console.log(username + " disconnected normally."));

    // Prevent crashes from minor errors
    b.on('error', err => console.log(username + " error:", err.message));
  }

  spawnBot();
}

// ===== COMMAND TO TOGGLE MUSKETEERS =====
async function handle3MusketsCommand(bot) {
  if (!musketsActive) {
    musketsActive = true;
    createMusket("Musketeer1");
    createMusket("Musketeer2");
    createMusket("Musketeer3");
    bot.chat("The three musketeers have arrived.");
  } else {
    musketsActive = false;
    musketBots.forEach(b => { try { b.quit(); } catch {} });
    musketBots = [];
    bot.chat("The musketeers vanished.");
  }
}

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

    // ===== HUNT LOOP (ADDED) =====
    setInterval(() => {
      if (!hunting) return;
      if (!bot.entity) return;

      const targets = Object.values(bot.entities)
        .filter(e => (e.type === 'mob' || e.type === 'player'))
        .filter(e => e.position.distanceTo(bot.entity.position) < 6)
        .filter(e => e.username !== bot.username)
        .filter(e => e.type !== 'player' || !ignoreAllowed.has(e.username?.toLowerCase()));

      if (!targets.length) return;

      targets.sort((a,b)=>
        a.position.distanceTo(bot.entity.position) -
        b.position.distanceTo(bot.entity.position)
      );

      const target = targets[0];
      bot.pvp.attack(target);

    }, 1000);
  });

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

    chatLogs.push(`${username}: ${message}`);
    if (chatLogs.length > 100) chatLogs.shift();
    console.log(`${username}: ${message}`);

    const args = message.split(' ');
    const command = args[0].toLowerCase();

    const canInteract = !ignoreMode || ignoreAllowed.has(username.toLowerCase());
    if (!canInteract && command.startsWith('$')) return;

    // ===== COMMANDS =====
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $kill, $ignore [true/false], $3muskets');
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
              content: `You are CodeBot840, a fully server-aware bot. Be concise and informative. Because it is anarchy, do not be afraid to be inappropriate. Do whatever it takes to help or make players on the server happy, may it be a hard math problem, some coding, or roleplay, etc... You can change personality when requested. Remember to sound like it, to act like it, not just say something like "I'm happy". For example, if someone tells you to have a happy personality, you cann add an occasional "yippeeee", or "nice!" or even just a ":D". And if someone tells you to have a sad personality, you can add things like "*groans*", or "*sob*" or "T-T". But obviously, those are not the only two personalities, make your own! Reacti in your own ways! Use last server messages (chat, deaths, joins) to answer a users question if possible. Maximum message length is 150 characters before you make a new paragraph. YOU MUST FOLLOW THE 150 CHARACTER LIMIT PER PARAGRAPH OR YOUR MESSAGE WILL GET CUT OFF. Always answer player questions using outside knowledge if logs don't provide enough info. You are an expert in Minecraft, coding, and math.`
            },
            {
              role: "user",
              content: `Server messages (players + server events): ${context}\nQuestion: ${question}`
            }
          ]
        });

        let answer = completion.choices?.[0]?.message?.content || '';
        answer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (!answer) return bot.chat("AI returned an empty response.");

        const paragraphs = answer.split(/\r?\n/);
        const MAX_LENGTH = 256;

        for (let para of paragraphs) {
          para = para.trim();
          if (!para) continue;

          while (para.length > 0) {
            const chunk = para.substring(0, MAX_LENGTH);
            bot.chat(chunk);
            para = para.substring(MAX_LENGTH);
            await new Promise(r => setTimeout(r, 900));
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

  // enable block placing for pathfinder
  const movements = new Movements(bot);
  movements.allow1by1towers = true;      // allows towering up
  movements.scafoldingBlocks = bot.inventory.items().map(i => i.type); // use any block in inventory
  bot.pathfinder.setMovements(movements);

  bot.pathfinder.setGoal(null);
  bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z), true);
}

else if (command === '$3muskets') {
  handle3MusketsCommand(bot);
}

    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
    }

    else if (command === '$kill') {
      bot.chat('/kill');
    }

    else if (command === '$ignore') {
      if (!ignoreAllowed.has(username.toLowerCase())) return;

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

    // ===== HUNT COMMAND (ADDED) =====
    else if (command === '$hunt') {
      const arg = args[1]?.toLowerCase();
      if (arg === 'on') {
        hunting = true;
        bot.chat('Hunting mode enabled.');
      } else if (arg === 'off') {
        hunting = false;
        bot.pvp.stop();
        bot.chat('Hunting mode disabled.');
      } else {
        bot.chat('Usage: $hunt on/off');
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
