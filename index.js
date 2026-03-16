const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const OpenAI = require('openai')
const fs = require('fs')

// =================
// CONFIG
// =================
const botArgs = {
 host: 'noBnoT.org',
 port: 25565,
 username: 'CodeBot840',
 version: '1.12.2'
}

const PASSWORD = 'YourSecurePassword123'
let chatLogs = []
let ignoreMode = true
let hunting = false
let spamMode = false

const ignoreAllowed = new Set([
  'player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz'
])

// =================
// RANDOM UTILITIES
// =================
const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

function randomName() {
  let name = ""
  const len = Math.floor(Math.random()*6)+6
  for(let i=0;i<len;i++) name += chars[Math.floor(Math.random()*chars.length)]
  return name
}

const gibberishChars = [...chars,"!","@","#","$","%","&","*"]
function randomGibberish() {
  let msg = ""
  const len = Math.floor(Math.random()*8)+3
  for(let i=0;i<len;i++) msg += gibberishChars[Math.floor(Math.random()*gibberishChars.length)]
  return msg
}

// =================
// SUMMON SYSTEM
// =================
let summonedBots = []
let syncMessages = false

function createSummonedBot(name){
  function spawn(){
    const b = mineflayer.createBot({
      host: botArgs.host,
      port: botArgs.port,
      username: name,
      version: botArgs.version
    })
    summonedBots.push(b)
    let logged = false

    b.once('spawn', () => {
      try {
        console.log(`${name} spawned`)
        setTimeout(()=>b.chat(`/login ${PASSWORD}`),1500)

        if(!syncMessages){
          const spam = setInterval(()=>{
            if(!syncMessages) b.chat(randomGibberish())
          }, Math.random()*4000+2000)
          b.on('end', ()=>clearInterval(spam))
        }
      } catch(e){ console.log(`${name} spawn error:`, e) }
    })

    b.on('messagestr', msg => {
      const m = msg.toLowerCase()
      if(m.includes("register")) b.chat(`/register ${PASSWORD} ${PASSWORD}`)
      if(m.includes("login")) b.chat(`/login ${PASSWORD}`)
      if(m.includes("welcome")||m.includes("success")) logged = true
    })

    setInterval(()=>{ if(!logged) b.chat(`/login ${PASSWORD}`) },5000)
    b.on('kicked', ()=>setTimeout(spawn,8000))
  }
  spawn()
}

function summonBots(amount, sync){
  syncMessages = sync
  for(let i=0;i<amount;i++) createSummonedBot(randomName())
}

function unsummonBots(){
  summonedBots.forEach(b=>{try{b.quit()}catch{} })
  summonedBots = []
}

// =================
// OFFLINE MESSAGES
// =================
const MESSAGE_FILE = './offlineMessages.json'
let offlineMessages = {}
if(fs.existsSync(MESSAGE_FILE)){
  try{ offlineMessages = JSON.parse(fs.readFileSync(MESSAGE_FILE)) } catch{}
}
function saveMessages(){ fs.writeFileSync(MESSAGE_FILE, JSON.stringify(offlineMessages,null,2)) }

// =================
// FOLLOW-UP SYSTEM
// =================
const followUps = {}
const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: "gsk_YOUR_GROQ_KEY"
})

// =================
// MAIN BOT
// =================
function startBot(){
  const bot = mineflayer.createBot(botArgs)

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvp)

  let loggedIn = false

  // =================
  // DEBUG / LOGGING
  // =================
  bot.on('login', ()=>console.log("Connected to server"))
  bot.on('spawn', ()=>console.log("Spawned in world"))
  bot.on('kicked', r=>console.log("KICKED:", r))
  bot.on('end', ()=>{ console.log("Disconnected, reconnecting..."); setTimeout(startBot,10000) })
  bot.on('error', e=>{ console.log("ERROR:", e); setTimeout(startBot,10000) })

  // =================
  // SERVER MESSAGES / AUTO LOGIN
  // =================
  bot.on('messagestr', message => {
    console.log("SERVER:", message)
    chatLogs.push(message)
    if(chatLogs.length>100) chatLogs.shift()

    const m = message.toLowerCase()
    if(m.includes("register")) bot.chat(`/register ${PASSWORD} ${PASSWORD}`)
    if(m.includes("login")) bot.chat(`/login ${PASSWORD}`)
    if(m.includes("welcome")||m.includes("success")) loggedIn = true
  })

  setInterval(()=>{ if(!loggedIn) bot.chat(`/login ${PASSWORD}`) },5000)

  // =================
  // CHAT COMMANDS
  // =================
  bot.on('chat', async(username, message)=>{
    if(username===bot.username) return
    const args = message.trim().split(/\s+/)
    const command = args[0].toLowerCase()
    const allowed = ignoreAllowed.has(username.toLowerCase())

    // FOLLOW-UP ALWAYS WORKS
    const follow = followUps[username.toLowerCase()]
    if(follow){
      try{
        const completion = await openai.chat.completions.create({
          model:"llama-3.1-8b-instant",
          messages:[
            {role:"system", content:`You are a self-aware bot called CodeBot840. You can change personality and pretend to change your name. Respond briefly. Behavior: ${follow}. 3-10 words.`},
            {role:"user", content: message}
          ]
        })
        const reply = completion.choices?.[0]?.message?.content
        if(reply) bot.chat(reply)
      }catch{}
    }

    if(!allowed && command.startsWith("$") && command !== "$followup") return

    // =================
    // COMMAND LIST
    // =================
    if(command==="$help") bot.chat("Commands: $coords $goto $kill $repeat $ask $followup $spam $summon $unsummon $hunt $ignore $message")

    else if(command==="$coords"){
      const p = bot.entity.position
      bot.chat(`I am at X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z)}`)
    }

    else if(command==="$goto"){
      const x = parseInt(args[1]), y=parseInt(args[2]), z=parseInt(args[3])
      if(isNaN(x)) return
      bot.pathfinder.setGoal(new goals.GoalBlock(x,y,z))
    }

    else if(command==="$kill"){ bot.chat("/kill") }

    else if(command==="$repeat"){
      const count = parseInt(args[args.length-1])
      const text = args.slice(1,-1).join(" ")
      if(isNaN(count)) return
      let i=0
      const loop = setInterval(()=>{
        if(i>=count) return clearInterval(loop)
        bot.chat(text)
        i++
      },2000)
    }

    else if(command==="$spam"){
      const state=args[1]
      if(state==="on"){spamMode=true;bot.chat("Spam enabled")}
      if(state==="off"){spamMode=false;bot.chat("Spam disabled")}
    }

    else if(command==="$ask"){
      const question=args.slice(1).join(" ")
      if(!question) return bot.chat("Ask me a question!")

      try{
        const context=chatLogs.slice(-50).join(' | ')
        const completion=await openai.chat.completions.create({
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

YOU MUST FOLLOW THE 240 CHARACTER LIMIT PER PARAGRAPH OR YOUR MESSAGE WILL GET CUT OFF.`
            },
            {
              role:"user",
              content:`Server messages: ${context}

Question: ${question}`
            }
          ]
        })

        let answer=completion?.choices?.[0]?.message?.content||""
        answer=answer.replace(/<think>[\s\S]*?<\/think>/g,"").trim()
        const paragraphs=answer.split(/\n+/)
        for(let para of paragraphs){
          while(para.length>0){
            const chunk=para.slice(0,240)
            bot.chat(chunk)
            para=para.slice(240)
            await new Promise(r=>setTimeout(r,1000))
          }
        }
      }catch(e){bot.chat("AI error")}
    }

    else if(command==="$followup"){
      const target=args[1]
      const topic=args.slice(2).join(" ")
      if(!target||!topic) return
      followUps[target.toLowerCase()]=topic
      bot.chat(`Follow-up set for ${target}`)
    }

    else if(command==="$summon"){
      const amount=parseInt(args[1])
      const sync=args[2]==="true"
      if(isNaN(amount)) return
      summonBots(amount,sync)
      bot.chat(`Summoned ${amount} bots.`)
    }

    else if(command==="$unsummon"){
      unsummonBots()
      bot.chat("Bots removed.")
    }

    else if(command==="$hunt"){
      const state=args[1]
      if(state==="on"){hunting=true;bot.chat("Hunting enabled")}
      if(state==="off"){hunting=false;bot.chat("Hunting disabled")}
    }

    else if(command==="$ignore"){
      const state=args[1]
      if(state==="true"){ignoreMode=true;bot.chat("Ignore enabled")}
      if(state==="false"){ignoreMode=false;bot.chat("Ignore disabled")}
    }

    else if(command==="$message"){
      const target=args[1]
      const msg=args.slice(2).join(" ")
      if(!target||!msg) return
      const key=target.toLowerCase()
      if(!offlineMessages[key]) offlineMessages[key]=[]
      offlineMessages[key].push({sender:username,text:msg})
      saveMessages()
      bot.chat(`Message saved for ${target}`)
    }
  })

  // =================
  // SYNC BOT CHAT
  // =================
  bot.on('chat', (username, message)=>{
    if(username!=="CodeBot840") return
    if(!syncMessages) return
    summonedBots.forEach(b=>{
      try{b.chat(message)}catch{}
    })
  })
}

startBot()
