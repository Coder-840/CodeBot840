const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const OpenAI = require('openai')
const fs = require('fs')

// ===== CONFIG =====
const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.12.2'
}

const PASSWORD = "YourSecurePassword123"
const GROQ_API_KEY = "PUT_YOUR_GROQ_API_KEY_HERE"

// ===== OPENAI (GROQ) =====
const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: GROQ_API_KEY
})

// ===== STATE =====
let chatLogs = []
let hunting = false
let ignoreMode = true

const ignoreAllowed = new Set([
  'player_840','chickentender','ig_t3v_2k',
  'lightdrag3x','lightdrag3n','1234npc1234','k0ngaz'
])

// ===== OFFLINE MESSAGES =====
let offlineMessages = {}

if (fs.existsSync("offlineMessages.json")) {
  offlineMessages = JSON.parse(fs.readFileSync("offlineMessages.json"))
}

function saveMessages(){
  fs.writeFileSync("offlineMessages.json", JSON.stringify(offlineMessages,null,2))
}

// ===== GIBBERISH =====
const gibberishChars = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  '§ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑ'.split('')
]

function randomGibberish(){
  let msg=""
  const len=Math.floor(Math.random()*6)+3
  for(let i=0;i<len;i++){
    msg+=gibberishChars[Math.floor(Math.random()*gibberishChars.length)]
  }
  return msg
}

// ===== SPAM BOTS =====
let spamBots=[]
let lastMasterMessage=null

function randomBotName(){
  const chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let name=""
  for(let i=0;i<8;i++){
    name+=chars[Math.floor(Math.random()*chars.length)]
  }
  return name
}

function spawnSpamBot(sync=false){

  const username=randomBotName()

  const b=mineflayer.createBot({
    host:botArgs.host,
    port:botArgs.port,
    username,
    version:botArgs.version
  })

  spamBots.push({bot:b,sync})

  let loggedIn=false

  b.once('spawn',()=>{
    setTimeout(()=>b.chat(`/login ${PASSWORD}`),1500)

    if(!sync){
      setInterval(()=>{
        if(!b.entity)return
        b.chat(randomGibberish())
      },Math.random()*4000+2000)
    }
  })

  b.on('messagestr',(msg)=>{
    const m=msg.toLowerCase()

    if(m.includes("register")) b.chat(`/register ${PASSWORD} ${PASSWORD}`)
    if(m.includes("login")) b.chat(`/login ${PASSWORD}`)

    if(m.includes("welcome")||m.includes("success")){
      loggedIn=true
    }
  })

  setInterval(()=>{
    if(!loggedIn){
      b.chat(`/login ${PASSWORD}`)
    }
  },5000)

  b.on('kicked',(r)=>{
    console.log(username,"kicked:",r)
    setTimeout(()=>spawnSpamBot(sync),8000)
  })

  b.on('error',(e)=>console.log(username,"error:",e.message))
  b.on('end',()=>console.log(username,"disconnected"))
}

// ===== FOLLOWUP SYSTEM =====
const followUps={}

// ===== START BOT =====
function startBot(){

console.log("Connecting to server...");
  
const bot = mineflayer.createBot(botArgs)

bot.on('login', () => console.log("Logged in"))
bot.on('spawn', () => console.log("Spawned in world"))
bot.on('kicked', r => console.log("Kicked:", r))
bot.on('error', e => console.log("Error:", e))
bot.on('end', () => console.log("Connection ended"))

bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)

let loggedIn=false

bot.once('spawn',()=>{

const mcData=require('minecraft-data')(bot.version)
bot.pvp.movements=new Movements(bot,mcData)

console.log("CodeBot840 spawned")

setTimeout(()=>bot.chat(`/login ${PASSWORD}`),1500)

// ===== HUNT LOOP =====
setInterval(()=>{

if(!hunting||!bot.entity)return

const targets=Object.values(bot.entities)
.filter(e=>e && e.position && !e.isDead)
.filter(e=>!e.username || !ignoreAllowed.has(e.username.toLowerCase()))

if(!targets.length)return

targets.sort((a,b)=>
a.position.distanceTo(bot.entity.position)-
b.position.distanceTo(bot.entity.position))

const target=targets[0]

if(bot.entity.position.distanceTo(target.position)>3){

bot.pathfinder.setGoal(
new goals.GoalNear(
target.position.x,
target.position.y,
target.position.z,
2
),true)

}

if(bot.entity.position.distanceTo(target.position)<4){
bot.pvp.attack(target)
}

},1500)

// ===== CHAT =====
bot.on('chat',async(username,message)=>{

if(username===bot.username){

lastMasterMessage=message

for(const entry of spamBots){
if(entry.sync && entry.bot.entity){
entry.bot.chat(message)
}
}

return
}

const args=message.trim().split(/\s+/)
const command=args[0].toLowerCase()

const allowed=ignoreAllowed.has(username.toLowerCase())

// ===== FOLLOWUP (works for everyone) =====
const follow=followUps[username.toLowerCase()]

if(follow){
try{

const completion=await openai.chat.completions.create({
model:"llama-3.1-8b-instant",
messages:[
{role:"system",content:`You are CodeBot840. Respond in 3-10 words. Behavior: ${follow}`},
{role:"user",content:message}
]
})

const reply=completion.choices?.[0]?.message?.content

if(reply) bot.chat(reply)

}catch{}
}

if(!allowed && command.startsWith('$') && ignoreMode){
bot.chat(`No permission ${username}`)
return
}

// ===== COMMANDS =====
switch(command){

case '$help':
bot.chat("Commands: $coords $repeat $ask $goto $kill $ignore $spam $message $hunt $followup")
break

case '$coords':
const p=bot.entity.position
bot.chat(`X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`)
break

case '$kill':
bot.chat("/kill")
break

case '$repeat':{

const count=parseInt(args[args.length-1])
const msg=args.slice(1,-1).join(' ')

if(isNaN(count)) return

let i=0

const interval=setInterval(()=>{
if(i>=count)return clearInterval(interval)
bot.chat(msg)
i++
},2000)

break
}

case '$goto':{

const x=parseInt(args[1])
const y=parseInt(args[2])
const z=parseInt(args[3])

if(isNaN(x))return

const mcData=require('minecraft-data')(bot.version)

const movements=new Movements(bot,mcData)

bot.pathfinder.setMovements(movements)

bot.pathfinder.setGoal(
new goals.GoalBlock(x,y,z)
)

break
}

case '$ignore':{

const state=args[1]

if(state==="true"){
ignoreMode=true
bot.chat("Ignore enabled")
}
else if(state==="false"){
ignoreMode=false
bot.chat("Ignore disabled")
}

break
}

case '$hunt':{

const state=args[1]

if(state==="on"){
hunting=true
bot.chat("Hunt enabled")
}

if(state==="off"){
hunting=false
bot.pvp.stop()
bot.chat("Hunt disabled")
}

break
}

case '$spam':{

const amount=parseInt(args[1])
const sync=args[2]==="true"

if(isNaN(amount)){
bot.chat("Usage $spam <amount> <true/false>")
return
}

bot.chat(`Spawning ${amount} bots`)

for(let i=0;i<amount;i++){
setTimeout(()=>spawnSpamBot(sync),i*1200)
}

break
}

case '$followup':{

const target=args[1]
const topic=args.slice(2).join(' ')

if(!target || !topic){
bot.chat("Usage $followup <player> <topic>")
return
}

followUps[target.toLowerCase()]=topic

bot.chat(`Followup set for ${target}`)

break
}

case '$ask':{

const question=args.slice(1).join(' ')

if(!question){
bot.chat("Ask something")
return
}

try{

const context=chatLogs.slice(-40).join(' | ')

const completion=await openai.chat.completions.create({
model:"llama-3.1-8b-instant",
messages:[
{
role:"system",
content:"You are CodeBot840. Answer briefly and clearly."
},
{
role:"user",
content:`Server context:\n${context}\nQuestion:\n${question}`
}
]
})

let answer=completion.choices?.[0]?.message?.content || ""

answer=answer.trim()

if(!answer){
bot.chat("AI returned nothing")
return
}

while(answer.length>0){
bot.chat(answer.slice(0,240))
answer=answer.slice(240)
}

}catch(err){
bot.chat("AI error")
console.log(err)
}

break
}

case '$message':{

const rawTarget=args[1]
const msg=args.slice(2).join(' ')

if(!rawTarget||!msg){
bot.chat("Usage $message <player> <msg>")
return
}

const key=rawTarget.toLowerCase()

if(!offlineMessages[key]){
offlineMessages[key]=[]
}

offlineMessages[key].push({
sender:username,
text:msg,
originalName:rawTarget
})

saveMessages()

bot.chat(`Saved for ${rawTarget}`)

break
}

}

})

// ===== SERVER MESSAGES =====
bot.on('messagestr',(msg)=>{

console.log("SERVER:",msg)

chatLogs.push(msg)
if(chatLogs.length>100) chatLogs.shift()

const m=msg.toLowerCase()

if(m.includes("register")){
bot.chat(`/register ${PASSWORD} ${PASSWORD}`)
}

if(m.includes("login")){
bot.chat(`/login ${PASSWORD}`)
}

if(m.includes("welcome")||m.includes("success")){
loggedIn=true
}

// deliver offline messages
const joinMatch=msg.match(/(\w+) joined/i)

if(joinMatch){

const name=joinMatch[1]
const key=name.toLowerCase()

if(offlineMessages[key]){

offlineMessages[key].forEach(m=>{
bot.chat(`/msg ${name} ${m.sender}: ${m.text}`)
})

delete offlineMessages[key]

saveMessages()

}

}

})

setInterval(()=>{
if(!loggedIn){
bot.chat(`/login ${PASSWORD}`)
}
},5000)

function reconnect(){
console.log("Reconnecting in 10s...")
setTimeout(startBot,10000)
}

bot.on('end',reconnect)
bot.on('kicked',reconnect)
bot.on('error',reconnect)

})

}

startBot()

