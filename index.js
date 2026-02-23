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

// ===== OFFLINE MESSAGE SYSTEM =====
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
const followUps = {}; // key: lowercase username, value: topic

const openai = new OpenAI({
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
          const completion = await openai.chat.completions.create({
            model: "openrouter/auto",
            messages: [
              {
                role: "system",
                content: `You are CodeBot840. Respond briefly and naturally. Behavior instruction: ${follow}. Answer in 3-10 words.`
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

      // ===== COMMANDS =====
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

      else if (command === '$repeat') {
        const count = parseInt(args[args.length - 1]);
        const repeatMsg = args.slice(1, -1).join(' ');
        if (isNaN(count)) return;

        let i = 0;
        const interval = setInterval(() => {
          if (i >= count) return clearInterval(interval);
          bot.chat(repeatMsg);
          i++;
        }, 2000);
      }

      else if (command === '$ask') {
        const question = args.slice(1).join(' ');
        if (!question) return bot.chat("Ask me a question!");

        try {
          const context = chatLogs.slice(-50).join(' | ');

          const completion = await openai.chat.completions.create({
            model: "llama3-70b-8192",
            messages: [
              {
                role: "system",
                content:
`You are CodeBot840, a fully server-aware bot.

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
Math`
              },
              {
                role: "user",
                content: `Server messages (players + events):
${context}

Question:
${question}`
              }
            ]
          });

          let answer = completion?.choices?.[0]?.message?.content || "";

          // remove thinking tags if model sends them
          answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

          if (!answer) {
            bot.chat("AI returned empty response.");
            return;
          }

          // split by paragraphs first
          const paragraphs = answer.split(/\n+/);

          const MAX = 240;

          for (let para of paragraphs) {
            while (para.length > 0) {
              const chunk = para.slice(0, MAX);
              bot.chat(chunk);
              para = para.slice(MAX);

              await new Promise(r => setTimeout(r, 1000)); // anti-spam delay
            }
          }

        } catch (err) {
          console.error("AI ERROR FULL:", err);

          if (err?.status === 401)
            bot.chat("AI Error: Invalid API key.");
          else if (err?.status === 429)
            bot.chat("AI Error: Rate limited.");
          else if (err?.status >= 500)
            bot.chat("AI Error: AI server down.");
          else
            bot.chat("AI Error: " + (err.message || "unknown"));
        }
      }

      else if (command === '$goto') {
        const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
        if (isNaN(x)) return;

        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.allow1by1towers = true;
        movements.scafoldingBlocks = bot.inventory.items().map(i => i.type);

        bot.pathfinder.setMovements(movements);
        bot.pathfinder.setGoal(null);
        bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z), true);
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

      else if (command === '$message') {
        const rawTarget = args[1];
        const targetKey = rawTarget?.toLowerCase();
        const msg = args.slice(2).join(' ');

        if (!rawTarget || !msg) {
          bot.chat("Usage: $message <player> <message>");
          return;
        }

        if (!offlineMessages[targetKey]) offlineMessages[targetKey] = [];

        offlineMessages[targetKey].push({
          sender: username,
          text: msg,
          originalName: rawTarget
        });

        saveMessages();
        bot.chat(`Message saved for ${rawTarget}.`);
      }

      else if (command === '$hunt') {
        const arg = args[1]?.toLowerCase();
        if (arg === 'on') {
          hunting = true;
          bot.chat('Hunting enabled.');
        } else if (arg === 'off') {
          hunting = false;
          bot.pvp.stop();
          bot.chat('Hunting disabled.');
        }
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
