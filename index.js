const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');
const fs = require('fs');

// ===== BOT CONFIG =====
const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
};

const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];
let ignoreMode = true;
const ignoreAllowed = new Set([
  'player_840', 'chickentender', 'ig_t3v_2k', 'lightdrag3x',
  'lightdrag3n', '1234NPC1234', 'k0ngaz'
]);
let hunting = false;

// ===== GIBBERISH GENERATOR =====
const gibberishChars = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
  '§ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ'.split('')
];

function randomGibberish() {
  let msg = "";
  const len = Math.floor(Math.random() * 6) + 3;
  for (let i = 0; i < len; i++)
    msg += gibberishChars[Math.floor(Math.random() * gibberishChars.length)];
  return msg;
}

// ===== SPAM BOT SYSTEM =====
let spamBots = [];
let lastMasterMessage = null;

// Function to generate random bot names
function randomBotName() {
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let name = "";
  for (let i = 0; i < 8; i++) {
    name += letters[Math.floor(Math.random() * letters.length)];
  }
  return name;
}

// Function to spawn a single spam bot
function spawnSpamBot(syncMessages = false) {
  const username = randomBotName();
  const b = mineflayer.createBot({
    host: botArgs.host,
    port: botArgs.port,
    username,
    version: botArgs.version
  });

  spamBots.push({ bot: b, sync: syncMessages });

  let loggedIn = false;

  b.once('spawn', () => {
    setTimeout(() => b.chat(`/login ${PASSWORD}`), 1500);

    if (!syncMessages) {
      const interval = setInterval(() => {
        if (!b.entity) return;
        b.chat(randomGibberish());
      }, Math.random() * 4000 + 2000);
    }
  });

  b.on('messagestr', msg => {
    const m = msg.toLowerCase();
    if (m.includes("register")) b.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (m.includes("login")) b.chat(`/login ${PASSWORD}`);
    if (m.includes("welcome") || m.includes("success")) loggedIn = true;
  });

  setInterval(() => {
    if (!loggedIn) b.chat(`/login ${PASSWORD}`);
  }, 5000);

  b.on('kicked', reason => {
    console.log(username + " kicked:", reason);
    // Respawn only if bots should still be active
    setTimeout(() => spawnSpamBot(syncMessages), 8000);
  });

  b.on('end', () => console.log(username + " disconnected."));
  b.on('error', err => console.log(username + " error:", err.message));
}

// Command listener for $spam
bot.on('chat', (username, message) => {
  if (username !== bot.username) return;

  const args = message.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '$spam') {
    const amount = parseInt(args[1]);
    const syncFlag = args[2]?.toLowerCase() === 'true';

    if (isNaN(amount) || amount <= 0) {
      bot.chat("Usage: $spam <amount> [true/false]");
      return;
    }

    bot.chat(`Spawning ${amount} bot(s), sync: ${syncFlag}`);

    for (let i = 0; i < amount; i++) {
      setTimeout(() => spawnSpamBot(syncFlag), i * 1000); // stagger join
    }
  }
});

// Keep track of last message from CodeBot840 for syncing
bot.on('chat', (username, message) => {
  if (username === bot.username) {
    lastMasterMessage = message;

    // Sync message to all bots that have sync = true
    for (const { bot: b, sync } of spamBots) {
      if (sync && b.entity) {
        b.chat(message);
      }
    }
  }
});

// ===== FOLLOW-UP SYSTEM =====
const followUps = {}; // key: lowercase username, value: topic

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: "YOUR_GROQ_API_KEY_HERE" // <-- replace locally with your real key
});

// ===== MAIN BOT START =====
function startBot() {
  const bot = mineflayer.createBot(botArgs);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  let loggedIn = false;

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    bot.pvp.movements = new Movements(bot, mcData);
    bot.pvp.movements.canDig = true;
    console.log('CodeBot840 spawned. Combat/Movement ready.');

    setTimeout(() => bot.chat(`/login ${PASSWORD}`), 1500);

    // ===== HUNT LOOP =====
    setInterval(() => {
      if (!hunting || !bot.entity || !bot.entity.position) return;

      const targets = Object.values(bot.entities)
        .filter(e => e && e !== bot.entity && e.position && !e.isDead)
        .filter(e => !e.username || !ignoreAllowed.has(e.username.toLowerCase()));

      if (!targets.length) return;

      targets.sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position));

      const target = targets[0];

      if (bot.entity.position.distanceTo(target.position) > 3)
        bot.pathfinder.setGoal(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2), true);

      if (bot.entity.position.distanceTo(target.position) < 4)
        bot.pvp.attack(target);

    }, 1500);

    // ===== AUTO EQUIP =====
    setInterval(() => {
      const items = bot.inventory.items();
      const armorSlots = {
        head: ["helmet"], torso: ["chestplate", "elytra"], legs: ["leggings"], feet: ["boots"]
      };

      for (const slot in armorSlots) {
        const match = items.find(item => armorSlots[slot].some(name => item.name.toLowerCase().includes(name)));
        if (match) bot.equip(match, slot).catch(() => {});
      }

      const sword = items.filter(i => i.name.includes("sword")).sort((a, b) => b.durabilityUsed - a.durabilityUsed)[0];
      if (sword) bot.equip(sword, "hand").catch(() => {});

    }, 4000);

    // ===== CHAT LISTENER =====
    bot.on('chat', async (username, message) => {
      if (username === bot.username) return;

      const args = message.trim().split(/\s+/);
      const command = args[0].toLowerCase();
      const allowed = ignoreAllowed.has(username.toLowerCase());

      // ===== FOLLOW-UP HANDLING (works for everyone) =====
      const follow = followUps[username.toLowerCase()];
      if (follow) {
        try {
          const completion = await openai.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: `You are CodeBot840. Respond briefly. Behavior: ${follow}. 3-10 words.` },
              { role: "user", content: message }
            ]
          });

          const reply = completion.choices?.[0]?.message?.content;
          if (reply) bot.chat(reply);
        } catch {}
      }

      if (!allowed && command.startsWith('$')) return bot.chat(`You don't have permission to use commands, ${username}.`);

      // ===== COMMANDS =====
      switch (command) {
        case '$help':
          bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $kill, $ignore [true/false], $spam <amount> <sync>, $message [player] [message], $hunt [on/off], $followup [player] [prompt]');
          break;

        case '$followup': {
          const target = args[1];
          const topic = args.slice(2).join(' ');
          if (!target || !topic) return bot.chat("Usage: $followup <player> <topic>");
          followUps[target.toLowerCase()] = topic;
          bot.chat(`Follow-up set for ${target}.`);
          break;
        }

        case '$repeat': {
          const count = parseInt(args[args.length - 1]);
          const repeatMsg = args.slice(1, -1).join(' ');
          if (isNaN(count)) return;
          let i = 0;
          const interval = setInterval(() => { if (i >= count) return clearInterval(interval); bot.chat(repeatMsg); i++; }, 2000);
          break;
        }

        case '$ask': {
          const question = args.slice(1).join(' ');
          if (!question) return bot.chat("Ask me a question!");
          try {
            const context = chatLogs.slice(-50).join(' | ');
            const completion = await openai.chat.completions.create({
              model: "llama-3.1-8b-instant",
              messages: [
                { role: "system", content: `You are CodeBot840. Be concise, informative. Maximum 240 chars per paragraph.` },
                { role: "user", content: `Server messages:\n${context}\nQuestion:\n${question}` }
              ]
            });
            let answer = completion?.choices?.[0]?.message?.content || "";
            answer = answer.replace(/<think>[\s\S]*?<\/think>/g,"").trim();
            if (!answer) return bot.chat("AI returned empty response.");
            answer.split(/\n+/).forEach(async para => {
              while (para.length > 0) {
                const chunk = para.slice(0,240); bot.chat(chunk); para = para.slice(240);
                await new Promise(r=>setTimeout(r,1000));
              }
            });
          } catch (err) {
            console.error("AI ERROR:", err);
            bot.chat("AI Error: " + (err.message || "unknown"));
          }
          break;
        }

        case '$goto': {
          const x = parseInt(args[1]), y = parseInt(args[2]), z = parseInt(args[3]);
          if (isNaN(x)) return;
          const mcData = require('minecraft-data')(bot.version);
          const movements = new Movements(bot, mcData);
          movements.allow1by1towers = true;
          movements.scafoldingBlocks = bot.inventory.items().map(i=>i.type);
          bot.pathfinder.setMovements(movements);
          bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z), true);
          break;
        }

        case '$spam':
          handleSpamCommand(bot, args);
          break;

        case '$coords': {
          const p = bot.entity.position;
          bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`);
          break;
        }

        case '$kill':
          bot.chat('/kill');
          break;

        case '$message': {
          const rawTarget = args[1];
          const targetKey = rawTarget?.toLowerCase();
          const msg = args.slice(2).join(' ');
          if (!rawTarget || !msg) return bot.chat("Usage: $message <player> <message>");
          if (!offlineMessages[targetKey]) offlineMessages[targetKey] = [];
          offlineMessages[targetKey].push({ sender: username, text: msg, originalName: rawTarget });
          saveMessages();
          bot.chat(`Message saved for ${rawTarget}.`);
          break;
        }

        case '$hunt': {
          const arg = args[1]?.toLowerCase();
          if (arg==='on') { hunting=true; bot.chat('Hunting enabled.'); }
          else if(arg==='off') { hunting=false; bot.pvp.stop(); bot.chat('Hunting disabled.'); }
          break;
        }

        case '$ignore': {
          const state = args[1]?.toLowerCase();
          if (state==='true') { ignoreMode=true; bot.chat('Ignore mode enabled.'); }
          else if(state==='false') { ignoreMode=false; bot.chat('Ignore mode disabled.'); }
          else bot.chat('Usage: $ignore true/false');
          break;
        }
      }
    });
  });

  bot.on('messagestr', (message) => {
    console.log(`SERVER: ${message}`);
    chatLogs.push(`SERVER: ${message}`);
    if (chatLogs.length>100) chatLogs.shift();

    if(message.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if(message.includes('/login')) bot.chat(`/login ${PASSWORD}`);

    const m = message.toLowerCase();
    if(m.includes("register")) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if(m.includes("login")) bot.chat(`/login ${PASSWORD}`);
    if(m.includes("welcome") || m.includes("success")) loggedIn = true;

    const joinMatch = message.match(/(\w+) joined/i);
    if(joinMatch){
      const joinedName = joinMatch[1];
      const key = joinedName.toLowerCase();
      if(offlineMessages[key]){
        offlineMessages[key].forEach(m=>{
          bot.chat(`/msg ${joinedName} ${m.sender} said "${m.text}"`);
        });
        delete offlineMessages[key];
        saveMessages();
      }
    }

    if(message.toLowerCase().includes("lost connection")){
      console.log("Detected connection loss. Reconnecting...");
      bot.quit();
    }

    // Save last message for $spam sync
    bot.lastMessage = message;
  });

  setInterval(()=>{ if(!loggedIn) bot.chat(`/login ${PASSWORD}`); },5000);

  let reconnecting=false;
  function safeReconnect(){
    if(reconnecting) return;
    reconnecting=true;
    setTimeout(()=>{ reconnecting=false; startBot(); },10000);
  }

  bot.on('end', safeReconnect);
  bot.on('kicked', safeReconnect);
  bot.on('error', safeReconnect);
}

startBot();
