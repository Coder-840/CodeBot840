const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');
const fs = require('fs');

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: false
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

    // =========================
    // ✅ ADDED CHAT LISTENER
    // =========================
    bot.on('chat', async (username, message) => {
      if (username === bot.username) return;

      const args = message.trim().split(/\s+/);
      const command = args[0].toLowerCase();

    // ===== COMMANDS =====
