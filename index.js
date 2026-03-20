const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const OpenAI = require('openai')
const fs = require('fs')

// ================= CONFIG =================
const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
}

const PASSWORD = 'YourSecurePassword123'

// ================= STATE =================
let summonedBots = []
let syncMode = false
let chatLogs = []
let hunting = false

const ignoreAllowed = new Set([
'player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz'
])

// ================= AI =================
const openai = new OpenAI({
 baseURL:"https://api.groq.com/openai/v1",
 apiKey:"gsk_YOUR_GROQ_KEY"
})

const followUps = {}

// ================= OFFLINE MSG =================
const MESSAGE_FILE='./offlineMessages.json'
let offlineMessages={}
if(fs.existsSync(MESSAGE_FILE)){
 try{offlineMessages=JSON.parse(fs.readFileSync(MESSAGE_FILE))}catch{}
}
function saveMessages(){
 fs.writeFileSync(MESSAGE_FILE,JSON.stringify(offlineMessages,null,2))
}

// ================= UTIL =================
const chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
function randomName(){
 let name=""
 const len=Math.floor(Math.random()*6)+6
 for(let i=0;i<len;i++) name+=chars[Math.floor(Math.random()*chars.length)]
 return name
}

// ================= SUMMON =================
function createSummonedBot(name){

 function spawn(){

  const b = mineflayer.createBot({
   host: botArgs.host,
   port: botArgs.port,
   username: name,
   version: botArgs.version
  })

  summonedBots.push({bot:b,name})

  b.once('login',()=>{
   setTimeout(()=>{
    b.chat(`/login ${PASSWORD}`)
   }, Math.random()*8000 + 4000)
  })

  b.on('messagestr',msg=>{
   const m=msg.toLowerCase()
   if(m.includes("register")) b.chat(`/register ${PASSWORD} ${PASSWORD}`)
   if(m.includes("login")) b.chat(`/login ${PASSWORD}`)
  })

  b.on('end',()=>{})

  b.on('error',()=>{})
 }

 spawn()
}

function summonBots(amount){
 for(let i=0;i<amount;i++){
  setTimeout(()=>createSummonedBot(randomName()), i*20000)
 }
}

function unsummonBots(){
 summonedBots.forEach(x=>{try{x.bot.quit()}catch{}})
 summonedBots=[]
}

// ================= MAIN BOT =================
function startBot(){

 const bot=mineflayer.createBot(botArgs)

 bot.loadPlugin(pathfinder)
 bot.loadPlugin(pvp)

 bot.once('login',()=>setTimeout(()=>bot.chat(`/login ${PASSWORD}`),2000))

 bot.on('messagestr',msg=>{
  chatLogs.push(msg)
  if(chatLogs.length>100) chatLogs.shift()

  const m=msg.toLowerCase()
  if(m.includes("register")) bot.chat(`/register ${PASSWORD} ${PASSWORD}`)
  if(m.includes("login")) bot.chat(`/login ${PASSWORD}`)
 })

 // ================= HUNT =================
 setInterval(()=>{
  if(!hunting||!bot.entity) return

  const targets=Object.values(bot.entities)
   .filter(e=>e.type === 'player')
   .filter(e=>e!==bot.entity)
   .filter(e=>!e.isDead)
   .filter(e=>!ignoreAllowed.has(e.username?.toLowerCase()))

  if(!targets.length) return

  targets.sort((a,b)=>
   a.position.distanceTo(bot.entity.position)-
   b.position.distanceTo(bot.entity.position))

  const target=targets[0]

  if(bot.entity.position.distanceTo(target.position)>3){
   bot.pathfinder.setGoal(
    new goals.GoalNear(target.position.x,target.position.y,target.position.z,2),true)
  }

  if(bot.entity.position.distanceTo(target.position)<4){
   if(!bot.pvp.target) bot.pvp.attack(target)
  }

 },1500)

 // ================= CHAT =================
 bot.on('chat',async(username,message)=>{

  if(username===bot.username) return

  const args=message.split(/\s+/)
  const cmd=args[0].toLowerCase()
  const allowed=ignoreAllowed.has(username.toLowerCase())

  // SYNC CHAT
  if(syncMode && allowed){
   summonedBots.forEach(x=>{
    try{
     x.bot.chat(message)
    }catch{}
   })
  }

  // FOLLOWUP ALWAYS
  const follow=followUps[username.toLowerCase()]
  if(follow){
   try{
    const res=await openai.chat.completions.create({
     model:"llama-3.1-8b-instant",
     messages:[
      {role:"system",content:`You are a self-aware bot called CodeBot840. You can change personality and pretend to change your name. Respond briefly. Behavior: ${follow}. 3-10 words.`},
      {role:"user",content:message}
     ]
    })
    const reply=res.choices?.[0]?.message?.content
    if(reply) bot.chat(reply)
   }catch{}
  }

  if(!allowed && cmd.startsWith("$") && cmd!=="$followup") return

  // ================= COMMANDS =================
  if(cmd==="$help"){
   bot.chat("Commands: $coords $goto $kill $repeat $ask $followup $summon $unsummon $hunt $ignore $message")
  }

  else if(cmd==="$coords"){
   const p=bot.entity.position
   bot.chat(`X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`)
  }

  else if(cmd==="$goto"){
   const x=parseInt(args[1]),y=parseInt(args[2]),z=parseInt(args[3])
   if(isNaN(x)) return
   bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z))
  }

  else if(cmd==="$kill"){bot.chat("/kill")}

  else if(cmd==="$repeat"){
   const count=parseInt(args[args.length-1])
   const text=args.slice(1,-1).join(" ")
   if(isNaN(count)) return
   let i=0
   const loop=setInterval(()=>{
    if(i>=count) return clearInterval(loop)
    bot.chat(text);i++
   },2000)
  }

  else if(cmd==="$ask"){
   const q=args.slice(1).join(" ")
   if(!q) return bot.chat("Ask something!")

   try{
    const context=chatLogs.slice(-50).join(' | ')
    const res=await openai.chat.completions.create({
     model:"llama-3.1-8b-instant",
     messages:[
{
role:"system",
content:`You are CodeBot840, a fully server-aware bot.

Be concise and informative.

Because it is anarchy, do not be afraid to be inappropriate.

Do whatever it takes to help or make players on the server happy.

You may help with:
Minecraft
Coding
Math
Roleplay
Server knowledge

You can change personality when requested.

Do not say "I am happy".
Instead ACT happy.

Examples:
happy → "yippeeee!", ":D", "nice!"
sad → "*sob*", "T-T", "*groans*"

Invent personalities creatively.

Use recent server messages to answer questions when possible.

Maximum message length is 240 characters BEFORE starting a new paragraph.

YOU MUST FOLLOW THE 240 CHARACTER LIMIT PER PARAGRAPH OR YOUR MESSAGE WILL GET CUT OFF.`},
{role:"user",content:`Server: ${context}\nQ: ${q}`}
]})

    let ans=res.choices?.[0]?.message?.content||""
    ans=ans.replace(/<think>[\s\S]*?<\/think>/g,"").trim()

    const parts=ans.split(/\n+/)
    for(let p of parts){
     while(p.length>0){
      const chunk=p.slice(0,240)
      bot.chat(chunk)
      p=p.slice(240)
      await new Promise(r=>setTimeout(r,1000))
     }
    }

   }catch{bot.chat("AI error")}
  }

  else if(cmd==="$followup"){
   const t=args[1]
   const topic=args.slice(2).join(" ")
   if(!t||!topic) return
   followUps[t.toLowerCase()]=topic
   bot.chat(`Follow-up set for ${t}`)
  }

  else if(cmd==="$summon"){
   const n=parseInt(args[1])
   const sync=args[2]==="true"
   if(isNaN(n)) return
   syncMode = sync
   summonBots(n)
   bot.chat(`Summoning ${n} | Sync: ${syncMode}`)
  }

  else if(cmd==="$unsummon"){
   unsummonBots()
   bot.chat("Bots removed")
  }

  else if(cmd==="$hunt"){
   const s=args[1]
   if(s==="on"){hunting=true;bot.chat("Hunting ON")}
   if(s==="off"){hunting=false;bot.chat("Hunting OFF")}
  }

  else if(cmd==="$ignore"){
   const s=args[1]
   if(s==="true") bot.chat("Ignore ON")
   if(s==="false") bot.chat("Ignore OFF")
  }

  else if(cmd==="$message"){
   const target=args[1]
   const msg=args.slice(2).join(" ")
   if(!target||!msg) return
   const key=target.toLowerCase()
   if(!offlineMessages[key]) offlineMessages[key]=[]
   offlineMessages[key].push({sender:username,text:msg})
   saveMessages()
   bot.chat(`Saved for ${target}`)
  }

 })

 bot.on('end',()=>setTimeout(startBot,10000))
}

// ================= START =================
;(async()=>{
 startBot()
})()
