const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');
const fs = require('fs');

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
};

const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];
let ignoreMode = true;
const ignoreAllowed = new Set(['player_840', 'chickentender','ig_t3v_2k']);
let hunting = false;

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
  const len = Math.floor(Math.random() * 6) + 3;
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

    b.once('spawn', () => {
      const interval = setInterval(() => {
        if (!musketsActive) {
          clearInterval(interval);
          return;
        }
        b.chat(randomGibberish());
      }, Math.random() * 4000 + 2000);
    });

    b.on('messagestr', message => {
      if (message.includes('/register')) b.chat(`/register ${PASSWORD} ${PASSWORD}`);
      if (message.includes('/login')) b.chat(`/login ${PASSWORD}`);
    });

    b.on('kicked', reason => {
      console.log(username + " kicked:", reason);
      if (musketsActive) setTimeout(spawnBot, 8000);
    });

    b.on('end', () => console.log(username + " disconnected normally."));
    b.on('error', err => console.log(username + " error:", err.message));
  }

  spawnBot();
}

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

const MESSAGE_FILE = './offlineMessages.json';
let offlineMessages = {};
if (fs.existsSync(MESSAGE_FILE)) {
  try {
    offlineMessages = JSON.parse(fs.readFileSync(MESSAGE_FILE));
  } catch {
    offlineMessages = {};
  }
}

function saveMessages() {
  fs.writeFileSync(MESSAGE_FILE, JSON.stringify(offlineMessages, null, 2));
}

// ===== FOLLOW-UP SYSTEM =====
const followUps = {};

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

    // ===== HUNT LOOP =====
    setInterval(() => {
      if (!hunting) return;
      if (!bot.entity || !bot.entity.position) return;

      const targets = Object.values(bot.entities)
        .filter(e => e && e !== bot.entity)
        .filter(e => e.position && typeof e.position.x === "number")
        .filter(e => !e.isDead)
        .filter(e => bot.entity.position.distanceTo(e.position) < 25)
        .filter(e => {
          if (!e.username) return true;
          return !ignoreAllowed.has(e.username.toLowerCase());
        });

      if (!targets.length) return;

      targets.sort((a, b) =>
        a.position.distanceTo(bot.entity.position) -
        b.position.distanceTo(bot.entity.position)
      );

      const target = targets[0];

      if (bot.entity.position.distanceTo(target.position) > 3) {
        bot.pathfinder.setGoal(
          new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2),
          true
        );
      }

      if (bot.entity.position.distanceTo(target.position) < 4) {
        bot.pvp.attack(target);
      }

    }, 1500);

    // ===== AUTO EQUIP =====
    setInterval(() => {
      const items = bot.inventory.items();

      const armorSlots = {
        head: ["helmet"],
        torso: ["chestplate", "elytra"],
        legs: ["leggings"],
        feet: ["boots"]
      };

      for (const slot in armorSlots) {
        const match = items.find(item =>
          armorSlots[slot].some(name =>
            item.name.toLowerCase().includes(name)
          )
        );
        if (match) bot.equip(match, slot).catch(()=>{});
      }

      const sword = items
        .filter(i => i.name.includes("sword"))
        .sort((a,b)=> b.durabilityUsed - a.durabilityUsed)[0];

      if (sword) bot.equip(sword, "hand").catch(()=>{});

    }, 4000);

    // ================= CHAT COMMAND LISTENER =================
    bot.on('chat', async (username, message) => {
      if (username === bot.username) return;

      const args = message.trim().split(/\s+/);
      const command = args[0].toLowerCase();

      const canInteract = !ignoreMode || ignoreAllowed.has(username.toLowerCase());
      if (!canInteract && command.startsWith('$')) return;

      // ===== FOLLOW-UP AUTO RESPONSE =====
      const follow = followUps[username.toLowerCase()];
      if (follow) {
        try {
          const completion = await openrouter.chat.completions.create({
            model: "openrouter/auto",
            messages: [
              {
                role: "system",
                content: `You are CodeBot840, a fully server-aware bot.

Be concise and informative.

Because it is anarchy, do not be afraid to be inappropriate.

Do whatever it takes to help or make players on the server happy, may it be a hard math problem, coding, roleplay, etc.

You can change personality when requested.
Do not say "I am happy".
Instead ACT happy.
Examples:
happy → "yippeeee!", ":D", "nice!"
sad → "*sob*", "T-T", "*groans*"

Invent personalities creatively.

Use recent server messages to answer questions when possible.

Maximum message length is 240 characters BEFORE starting a new paragraph.

YOU MUST FOLLOW THE 240 CHARACTER LIMIT PER PARAGRAPH OR YOUR MESSAGE WILL GET CUT OFF.

Always answer questions using outside knowledge if logs don't help.

You are an expert in:
Minecraft
Coding
Math``
              },
              {
                role: "user",
                content: message
              }
            ]
          });

          const reply = completion.choices?.[0]?.message?.content?.slice(0, 256);
          if (reply) bot.chat(reply);

        } catch {}
      }

      if (command === '$help') {
        bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $kill, $ignore [true/false], $3muskets, $message [player] [message], $hunt, $followup [player] [topic]');
      }

      else if (command === '$followup') {
        if (!ignoreAllowed.has(username.toLowerCase()))
          return bot.chat("No permission.");

        const target = args[1];
        const topic = args.slice(2).join(' ');

        if (!target || !topic)
          return bot.chat("Usage: $followup <player> <topic>");

        followUps[target.toLowerCase()] = topic;
        bot.chat(`Follow-up set for ${target}.`);
      }

      // … [Insert the rest of your $repeat, $ask, $goto, $3muskets, $coords, $kill, $message, $hunt code exactly as-is here] …
      // (You already had them correctly implemented)

    });
  });

  // ===== SERVER EVENTS =====
  bot.on('messagestr', (message) => {
    console.log(`SERVER: ${message}`);
    chatLogs.push(`SERVER: ${message}`);
    if (chatLogs.length > 100) chatLogs.shift();

    // auto auth
    if (message.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (message.includes('/login')) bot.chat(`/login ${PASSWORD}`);

    // ===== OFFLINE MESSAGE DELIVERY =====
    const joinMatch = message.match(/(\w+) joined/i);
    if (joinMatch) {
      const joinedName = joinMatch[1];
      const key = joinedName.toLowerCase();

      if (offlineMessages[key]) {
        offlineMessages[key].forEach(m => {
          bot.chat(`/msg ${joinedName} ${m.sender} said "${m.text}"`);
        });

        delete offlineMessages[key];
        saveMessages();
      }
    }

    // ===== DETECT LOST CONNECTION =====
    if (message.toLowerCase().includes("lost connection")) {
      console.log("Detected connection loss. Reconnecting...");
      bot.quit();
    }
  });

  let reconnecting = false;
  function safeReconnect() {
    if (reconnecting) return;
    reconnecting = true;
    setTimeout(() => {
      reconnecting = false;
      startBot();
    }, 10000);
  }

  bot.on('end', safeReconnect);
  bot.on('kicked', safeReconnect);
  bot.on('error', safeReconnect);
}

startBot();
