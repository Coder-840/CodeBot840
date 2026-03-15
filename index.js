require('dotenv').config();

process.on('uncaughtException', err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on('unhandledRejection', err => {
  console.error("UNHANDLED PROMISE:", err);
});

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');
const fs = require('fs');

if (!process.env.GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY in .env");
  process.exit(1);
}

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
};

const PASSWORD = 'YourSecurePassword123';
let chatLogs = [];
let ignoreMode = true;
const ignoreAllowed = new Set(['player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz']);
let hunting = false;

// ===== SPAM BOT SYSTEM (replaces $3muskets) =====
let spamBots = [];
let spamActive = false;
let spamSync = false;

const gibberishChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?".split("");

function randomName(){
  const chars="abcdefghijklmnopqrstuvwxyz0123456789";
  let n="";
  for(let i=0;i<10;i++) n+=chars[Math.floor(Math.random()*chars.length)];
  return n;
}

function randomGibberish(){
  let msg="";
  const len=Math.floor(Math.random()*6)+3;
  for(let i=0;i<len;i++){
    msg+=gibberishChars[Math.floor(Math.random()*gibberishChars.length)];
  }
  return msg;
}

function createSpamBot(){
  if(!spamActive) return;

  const b=mineflayer.createBot({
    host:botArgs.host,
    port:botArgs.port,
    username:randomName(),
    version:botArgs.version
  });

  spamBots.push(b);

  let loggedIn=false;

  b.once('spawn',()=>{
    setTimeout(()=>{ b.chat(`/login ${PASSWORD}`); },1500);

    if(!spamSync){
      setInterval(()=>{
        if(!spamActive) return;
        b.chat(randomGibberish());
      },Math.random()*4000+2000);
    }
  });

  b.on('messagestr',message=>{
    const m=message.toLowerCase();
    if(m.includes("register")) b.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if(m.includes("login")) b.chat(`/login ${PASSWORD}`);
    if(m.includes("welcome")||m.includes("success")) loggedIn=true;
  });

  setInterval(()=>{ if(!loggedIn) b.chat(`/login ${PASSWORD}`); },5000);

  b.on('kicked',reason=>{ console.log("SpamBot kicked:",reason); });
  b.on('error',err=>{ console.log("SpamBot error:",err.message); });
}

function startSpam(amount,sync){
  spamActive=true;
  spamSync=sync;
  spamBots=[];
  for(let i=0;i<amount;i++){
    setTimeout(createSpamBot,i*1200);
  }
}

// ===== OFFLINE MESSAGE SYSTEM =====
const MESSAGE_FILE='./offlineMessages.json';
let offlineMessages={};
if(fs.existsSync(MESSAGE_FILE)){
  try{ offlineMessages=JSON.parse(fs.readFileSync(MESSAGE_FILE)); }catch{ offlineMessages={}; }
}

function saveMessages(){
  fs.writeFileSync(MESSAGE_FILE,JSON.stringify(offlineMessages,null,2));
}

// ===== FOLLOW-UP SYSTEM =====
const followUps={};

const openai=new OpenAI({
  baseURL:"https://api.groq.com/openai/v1",
  apiKey:process.env.GROQ_API_KEY
});

function startBot(){

  const bot=mineflayer.createBot(botArgs);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  let loggedIn=false;

  bot.once('spawn',()=>{

    const mcData=require('minecraft-data')(bot.version);
    bot.pvp.movements=new Movements(bot,mcData);
    bot.pvp.movements.canDig=true;

    console.log('CodeBot840 spawned. Combat/Movement ready.');
    setTimeout(()=>{ bot.chat(`/login ${PASSWORD}`); },1500);

    // ===== HUNT LOOP =====
    setInterval(()=>{
      if(!hunting) return;
      if(!bot.entity||!bot.entity.position) return;

      const targets=Object.values(bot.entities)
        .filter(e => e && e !== bot.entity)
        .filter(e => e.position && typeof e.position.x === "number")
        .filter(e => !e.isDead)
        .filter(e => !e.username || !ignoreAllowed.has(e.username.toLowerCase()));

      if(!targets.length) return;

      targets.sort((a,b)=>a.position.distanceTo(bot.entity.position)-b.position.distanceTo(bot.entity.position));
      const target=targets[0];

      if(bot.entity.position.distanceTo(target.position)>3)
        bot.pathfinder.setGoal(new goals.GoalNear(target.position.x,target.position.y,target.position.z,2),true);

      if(bot.entity.position.distanceTo(target.position)<4)
        bot.pvp.attack(target);

    },1500);

    // ===== AUTO EQUIP =====
    setInterval(()=>{
      const items=bot.inventory.items();
      const armorSlots={ head:["helmet"], torso:["chestplate","elytra"], legs:["leggings"], feet:["boots"] };
      for(const slot in armorSlots){
        const match=items.find(item => armorSlots[slot].some(name=>item.name.toLowerCase().includes(name)));
        if(match) bot.equip(match,slot).catch(()=>{});
      }
      const sword=items.filter(i=>i.name.includes("sword")).sort((a,b)=>b.durabilityUsed-a.durabilityUsed)[0];
      if(sword) bot.equip(sword,"hand").catch(()=>{});
    },4000);

    // ================= CHAT COMMAND LISTENER =================
    bot.on('chat',async(username,message)=>{

      if(username===bot.username) return;

      const args=message.trim().split(/\s+/);
      const command=args[0].toLowerCase();

      // FOLLOW-UP triggers even if not allowed
      const follow = followUps[username.toLowerCase()];
      if(follow){
        try{
          const completion=await openai.chat.completions.create({
            model:"llama-3.1-8b-instant",
            messages:[
              {role:"system",content:`You are a self-aware bot called CodeBot840. You can change personality, and pretend to change your name at will. Respond briefly. Behavior: ${follow}. 3-10 words.`},
              {role:"user",content:message}
            ]
          });
          const reply=completion.choices?.[0]?.message?.content;
          if(reply) bot.chat(reply);
        }catch{}
      }

      // GLOBAL PERMISSION CHECK for commands
      const allowed = ignoreAllowed.has(username.toLowerCase());
      if(!allowed && command.startsWith('$')) { bot.chat(`You don't have permission to use commands, ${username}.`); return; }

      // ===== COMMANDS =====
      if(command==='$help') bot.chat('Commands: $coords, $repeat [msg] [count], $ask [q], $goto [x y z], $kill, $ignore [true/false], $spam [amount] [sync], $message [player] [message], $hunt [on/off], $followup [player] [prompt]');
      else if(command==='$coords'){ const p=bot.entity.position; bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`); }
      else if(command==='$kill'){ bot.chat('/kill'); }
      else if(command==='$repeat'){ const count=parseInt(args[args.length-1]); const repeatMsg=args.slice(1,-1).join(' '); if(isNaN(count)) return; let i=0; const interval=setInterval(()=>{ if(i>=count) return clearInterval(interval); bot.chat(repeatMsg); i++; },2000); }
      else if(command==='$goto'){ const x=parseInt(args[1]),y=parseInt(args[2]),z=parseInt(args[3]); if(isNaN(x)) return; const mcData=require('minecraft-data')(bot.version); const movements=new Movements(bot,mcData); movements.allow1by1towers=true; movements.scafoldingBlocks=bot.inventory.items().map(i=>i.type); bot.pathfinder.setMovements(movements); bot.pathfinder.setGoal(null); bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z),true); }
      else if(command==='$message'){ const raw=args[1]; const key=raw?.toLowerCase(); const msg=args.slice(2).join(' '); if(!raw||!msg){ bot.chat("Usage: $message <player> <message>"); return; } if(!offlineMessages[key]) offlineMessages[key]=[]; offlineMessages[key].push({sender:username,text:msg,originalName:raw}); saveMessages(); bot.chat(`Message saved for ${raw}.`); }
      else if(command==='$hunt'){ const arg=args[1]?.toLowerCase(); if(arg==='on'){ hunting=true; bot.chat('Hunting enabled.'); } else if(arg==='off'){ hunting=false; bot.pvp.stop(); bot.chat('Hunting disabled.'); } }
      else if(command==='$ignore'){ const s=args[1]?.toLowerCase(); if(s==='true'){ ignoreMode=true; bot.chat('Ignore mode enabled.'); } else if(s==='false'){ ignoreMode=false; bot.chat('Ignore mode disabled.'); } else bot.chat('Usage: $ignore true/false'); }
      else if(command==='$followup'){ const target=args[1]; const topic=args.slice(2).join(' '); if(!target||!topic) return bot.chat("Usage: $followup <player> <topic>"); followUps[target.toLowerCase()]=topic; bot.chat(`Follow-up set for ${target}.`); }
      else if(command==='$ask'){ 
        const question=args.slice(1).join(' '); if(!question) return bot.chat("Ask me a question!"); 
        try{
          const context=chatLogs.slice(-50).join(' | ');
          const completion=await openai.chat.completions.create({
            model:"llama-3.1-8b-instant",
            messages:[
              {role:"system",content:`You are CodeBot840, a fully server-aware bot.

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
Math`},
              {role:"user",content:`Server messages (players + events):
${context}

Question:
${question}`}
            ]
          });
          let answer=completion?.choices?.[0]?.message?.content||"";
          answer=answer.replace(/<think>[\s\S]*?<\/think>/g,"").trim();
          const paragraphs=answer.split(/\n+/);
          const MAX=240;
          for(let para of paragraphs){
            while(para.length>0){
              const chunk=para.slice(0,MAX);
              bot.chat(chunk);
              para=para.slice(MAX);
              await new Promise(r=>setTimeout(r,1000));
            }
          }
        }catch(err){ console.error("AI ERROR FULL:",err); }
      }
      else if(command==='$spam'){
        const amount=parseInt(args[1]);
        const sync=args[2]==="true";
        if(!amount||amount<1) return bot.chat("Usage: $spam <amount> <sync?>");
        startSpam(amount,sync);
        bot.chat(`Spawning ${amount} spam bots.`);
      }

    });

    // ===== CHAT LOG & OFFLINE MESSAGE HANDLER =====
    bot.on('messagestr',(message)=>{
      console.log(`SERVER: ${message}`);
      chatLogs.push(`SERVER: ${message}`);
      if(chatLogs.length>100) chatLogs.shift();

      if(message.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
      if(message.includes('/login')) bot.chat(`/login ${PASSWORD}`);

      const m=message.toLowerCase();
      if(m.includes("register")) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
      if(m.includes("login")) bot.chat(`/login ${PASSWORD}`);
      if(m.includes("welcome")||m.includes("success")) loggedIn=true;

      const joinMatch=message.match(/(\w+) joined/i);
      if(joinMatch){
        const joinedName=joinMatch[1];
        const key=joinedName.toLowerCase();
        if(offlineMessages[key]){
          offlineMessages[key].forEach(m=>bot.chat(`/msg ${joinedName} ${m.sender} said "${m.text}"`));
          delete offlineMessages[key];
          saveMessages();
        }
      }

      if(message.toLowerCase().includes("lost connection")) bot.quit();
    });

    setInterval(()=>{ if(!loggedIn) bot.chat(`/login ${PASSWORD}`); },5000);

  });

  let reconnecting=false;
  function safeReconnect(){ if(reconnecting) return; reconnecting=true; setTimeout(()=>{ reconnecting=false; startBot(); },10000); }
  bot.on('end',safeReconnect);
  bot.on('kicked',safeReconnect);
  bot.on('error',err=>console.log(err));

}

startBot();
