const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const { SocksProxyAgent } = require('socks-proxy-agent')
const axios = require('axios')
const fs = require('fs')
const OpenAI = require('openai')

// ================= CONFIG =================
const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
}

const PASSWORD = 'YourSecurePassword123'

// ================= STATE =================
let proxyPool=[]
let workingProxies=[]
let summonedBots=[]
let syncMessages=false

let chatLogs=[]
let followUps={}
let spamMode=false
let hunting=false
let ignoreMode=true

const ignoreAllowed=new Set([
'player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz'
])

// ================= OPENAI =================
const openai=new OpenAI({
 baseURL:"https://api.groq.com/openai/v1",
 apiKey:"gsk_YOUR_GROQ_KEY"
})

// ================= RANDOM =================
const chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

function randomName(){
 let name=""
 const len=Math.floor(Math.random()*6)+6
 for(let i=0;i<len;i++) name+=chars[Math.floor(Math.random()*chars.length)]
 return name
}

function randomGibberish(){
 const c=chars+"!@#$%&*"
 let msg=""
 const len=Math.floor(Math.random()*8)+3
 for(let i=0;i<len;i++) msg+=c[Math.floor(Math.random()*c.length)]
 return msg
}

// ================= PROXY =================
const fallbackProxies=[
"137.59.49.133:1080",
"114.108.177.104:1080",
"162.241.66.135:1080",
"108.181.34.82:1080"
]

async function fetchProxies(){
 try{
  const url="https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=socks5"
  const res=await axios.get(url)
  proxyPool=res.data.data.map(p=>`${p.ip}:${p.port}`)
  console.log("Fetched proxies:",proxyPool.length)
 }catch{
  proxyPool=fallbackProxies
 }
}

async function testProxy(proxy){
 return new Promise(resolve=>{
  const agent=new SocksProxyAgent(`socks://${proxy}`)
  const bot=mineflayer.createBot({
   host:botArgs.host,
   port:botArgs.port,
   username:"Test"+Math.random(),
   version:botArgs.version,
   agent
  })

  let done=false
  const timeout=setTimeout(()=>{
   if(!done){done=true;try{bot.quit()}catch{};resolve(false)}
  },8000)

  bot.once('login',()=>{
   if(!done){done=true;clearTimeout(timeout);bot.quit();resolve(true)}
  })

  bot.on('error',()=>{
   if(!done){done=true;clearTimeout(timeout);resolve(false)}
  })
 })
}

async function buildProxyPool(){
 workingProxies=[]
 for(const p of proxyPool){
  const ok=await testProxy(p)
  if(ok){workingProxies.push(p);console.log("OK:",p)}
  if(workingProxies.length>=10) break
 }
 if(!workingProxies.length) workingProxies=fallbackProxies
}

function getProxy(){
 if(!workingProxies.length) return null
 return workingProxies[Math.floor(Math.random()*workingProxies.length)]
}

// ================= OFFLINE MESSAGES =================
const MESSAGE_FILE='./offlineMessages.json'
let offlineMessages={}
if(fs.existsSync(MESSAGE_FILE)){
 try{offlineMessages=JSON.parse(fs.readFileSync(MESSAGE_FILE))}catch{}
}
function saveMessages(){
 fs.writeFileSync(MESSAGE_FILE,JSON.stringify(offlineMessages,null,2))
}

// ================= SUMMON =================
function createSummonedBot(name){

 let proxy=getProxy()
 let agent=proxy?new SocksProxyAgent(`socks://${proxy}`):undefined

 function spawn(){

  const b=mineflayer.createBot({
   host:botArgs.host,
   port:botArgs.port,
   username:name,
   version:botArgs.version,
   agent
  })

  let spamInt=null
  summonedBots.push({bot:b,name})

  b.once('login',()=>{
   setTimeout(()=>b.chat(`/login ${PASSWORD}`),2000)

   setTimeout(()=>{
    if(!syncMessages){
     spamInt=setInterval(()=>{
      try{b.chat(randomGibberish())}catch{}
     },Math.random()*4000+3000)
    }
   },8000)
  })

  b.on('messagestr',msg=>{
   const m=msg.toLowerCase()
   if(m.includes("register")) b.chat(`/register ${PASSWORD} ${PASSWORD}`)
   if(m.includes("login")) b.chat(`/login ${PASSWORD}`)
  })

  b.on('end',()=>{
   if(spamInt) clearInterval(spamInt)
   setTimeout(()=>{
    proxy=getProxy()
    agent=proxy?new SocksProxyAgent(`socks://${proxy}`):undefined
    spawn()
   },15000)
  })

  b.on('error',()=>{})
 }

 spawn()
}

function summonBots(amount,sync){
 syncMessages=sync
 for(let i=0;i<amount;i++){
  setTimeout(()=>createSummonedBot(randomName()),i*12000)
 }
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

 // ===== HUNT LOOP =====
 setInterval(()=>{
  if(!hunting||!bot.entity) return

  const targets=Object.values(bot.entities)
  .filter(e=>e!==bot.entity && !e.isDead)
  .filter(e=>!e.username || !ignoreAllowed.has(e.username.toLowerCase()))

  if(!targets.length) return

  targets.sort((a,b)=>
   a.position.distanceTo(bot.entity.position)-
   b.position.distanceTo(bot.entity.position)
  )

  const t=targets[0]

  if(bot.entity.position.distanceTo(t.position)>3){
   bot.pathfinder.setGoal(new goals.GoalNear(t.position.x,t.position.y,t.position.z,2),true)
  }

  if(bot.entity.position.distanceTo(t.position)<4){
   bot.pvp.attack(t)
  }

 },1500)

 // ===== CHAT =====
 bot.on('chat',async(username,message)=>{

  if(username===bot.username) return

  const args=message.split(" ")
  const cmd=args[0].toLowerCase()
  const allowed=ignoreAllowed.has(username.toLowerCase())

  // followup
  if(followUps[username.toLowerCase()]){
   try{
    const completion=await openai.chat.completions.create({
     model:"llama-3.1-8b-instant",
     messages:[
      {role:"system",content:`Behavior: ${followUps[username.toLowerCase()]}. 3-10 words.`},
      {role:"user",content:message}
     ]
    })
    bot.chat(completion.choices?.[0]?.message?.content||"")
   }catch{}
  }

  if(!allowed && cmd.startsWith("$") && cmd!="$followup") return

  if(cmd==="$help") bot.chat("Commands: $coords $goto $kill $repeat $ask $followup $spam $summon $unsummon $hunt $ignore $message")

  else if(cmd==="$coords"){
   const p=bot.entity.position
   bot.chat(`X:${p.x|0} Y:${p.y|0} Z:${p.z|0}`)
  }

  else if(cmd==="$goto"){
   const x=parseInt(args[1]),y=parseInt(args[2]),z=parseInt(args[3])
   if(!isNaN(x)) bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z))
  }

  else if(cmd==="$kill") bot.chat("/kill")

  else if(cmd==="$repeat"){
   const count=parseInt(args.pop())
   const text=args.slice(1).join(" ")
   let i=0
   const loop=setInterval(()=>{
    if(i++>=count) return clearInterval(loop)
    bot.chat(text)
   },2000)
  }

  else if(cmd==="$ask"){
   const q=args.slice(1).join(" ")
   const context=chatLogs.slice(-50).join(" | ")

   try{
    const res=await openai.chat.completions.create({
     model:"llama-3.1-8b-instant",
     messages:[
      {role:"system",content:"You are CodeBot840, a fully server-aware bot. Be concise and informative. You may help with: Minecraft, Coding, Math, Roleplay, Server knowledge. You can change personality when requested. Do not say "I am happy". Instead ACT happy. Examples: happy → "yippeeee!", ":D", "nice!" sad → "*sob*", "T-T", "*groans*" Invent personalities creatively. Use recent server messages to answer questions when possible. Maximum message length is 240 characters BEFORE starting a new paragraph. YOU MUST FOLLOW THE 240 CHARACTER LIMIT PER PARAGRAPH OR YOUR MESSAGE WILL GET CUT OFF."},
      {role:"user",content:`${context}\nQ:${q}`}
     ]
    })

    const reply=res.choices?.[0]?.message?.content||""
    bot.chat(reply.slice(0,240))

   }catch{bot.chat("AI error")}
  }

  else if(cmd==="$followup"){
   followUps[args[1]?.toLowerCase()]=args.slice(2).join(" ")
   bot.chat("Followup set")
  }

  else if(cmd==="$summon"){
   summonBots(parseInt(args[1]),args[2]==="true")
   bot.chat("Summoning...")
  }

  else if(cmd==="$unsummon"){
   summonedBots.forEach(x=>{try{x.bot.quit()}catch{}})
   summonedBots=[]
   bot.chat("Removed bots")
  }

  else if(cmd==="$hunt"){
   hunting=args[1]==="on"
   bot.chat(hunting?"Hunt on":"Hunt off")
  }

  else if(cmd==="$ignore"){
   ignoreMode=args[1]==="true"
   bot.chat("Ignore updated")
  }

  else if(cmd==="$message"){
   const t=args[1],msg=args.slice(2).join(" ")
   if(!offlineMessages[t]) offlineMessages[t]=[]
   offlineMessages[t].push({sender:username,text:msg})
   saveMessages()
   bot.chat("Saved message")
  }

 })

 // sync chat
 bot.on('chat',(u,m)=>{
  if(u!=="CodeBot840"||!syncMessages) return
  summonedBots.forEach(x=>{try{x.bot.chat(m)}catch{}})
 })

 bot.on('end',()=>setTimeout(startBot,10000))
}

// ================= START =================
(async ()=>{
 await fetchProxies()
 await buildProxyPool()
 startBot()
})()
