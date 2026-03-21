'use strict';
const mineflayer = require('mineflayer');
const { pathfinder: Pathfinder, goals: Goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const O = require('openai');
const fs = require('fs');
const ping = require('ping');
const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** ------------------- Proxy DB ------------------- **/
const proxiesFile = './proxies.json';
let proxies = [];
if (fs.existsSync(proxiesFile)) {
    try { proxies = JSON.parse(fs.readFileSync(proxiesFile)); } catch {}
}

function saveProxies() {
    fs.writeFileSync(proxiesFile, JSON.stringify(proxies,null,2));
}

/** ------------------- Scanner ------------------- **/
let scanning = true;
let scanned = 0;

// 🔥 REAL proxy test (checks if SOCKS port responds)
function testProxy(ip, port=1080, timeout=2000) {
    return new Promise(resolve=>{
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, ip);
    });
}

async function scanIP(ip) {
    try {
        const res = await ping.promise.probe(ip,{timeout:1});
        scanned++;

        if(!res.alive) return;

        const works = await testProxy(ip);

        if(works && !proxies.find(p=>p.ip===ip)){
            proxies.push({ip,port:1080});
            saveProxies();
            console.log(`[VALID PROXY] ${ip}:1080 | Total: ${proxies.length}`);
        }
    } catch {}
}

function randomIP(){
    return `${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`;
}

// 🔁 continuous scanning
setInterval(()=>{
    if(!scanning) return;
    for(let i=0;i<5;i++) scanIP(randomIP());
},2000);

/** ------------------- Bot System ------------------- **/
const bots = [];
const PASSWORD = 'YourSecurePassword123';
const ignoredUsers = new Set(['player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz']);
let messageLog=[];
let huntMode=false;
let syncChat=false;
const followUps={};

function randomName(){
    const c="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({length:6+Math.random()*6|0},()=>c[Math.random()*c.length|0]).join('');
}

// 🔥 spawn proxy bot
function spawnBot(proxy){
    const bot = mineflayer.createBot({
        host:'noBnoT.org',
        port:25565,
        username:'CodeBot_'+randomName(),
        version:'1.12.2',
        agent:new SocksProxyAgent(`socks5://${proxy.ip}:${proxy.port}`)
    });

    setupBot(bot);
    bots.push(bot);
}

// 🔥 main bot (NO proxy)
function startMainBot(){
    const bot = mineflayer.createBot({
        host:'noBnoT.org',
        port:25565,
        username:'CodeBot840',
        version:'1.12.2'
    });

    setupBot(bot,true);

    bot.on('end',()=>setTimeout(startMainBot,10000));
}

// 🔥 shared bot logic
function setupBot(bot,isMain=false){

    bot.loadPlugin(Pathfinder);
    bot.loadPlugin(pvp);

    bot.once('login',()=>setTimeout(()=>bot.chat(`/login ${PASSWORD}`),2000));

    bot.on('messagestr',msg=>{
        messageLog.push(msg);
        if(messageLog.length>100) messageLog.shift();
        if(isMain) console.log('[CHAT]',msg);

        const t=msg.toLowerCase();
        t.includes('register')&&bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
        t.includes('login')&&bot.chat(`/login ${PASSWORD}`);
    });

    // hunt system
    setInterval(()=>{
        if(!huntMode||!bot.entity)return;
        let t=Object.values(bot.entities).filter(e=>e.type==='player'&&e!==bot.entity&&!e.isDead&&!ignoredUsers.has(e.username?.toLowerCase()));
        if(!t.length)return;
        t.sort((a,b)=>a.position.distanceTo(bot.entity.position)-b.position.distanceTo(bot.entity.position));
        const n=t[0],d=bot.entity.position.distanceTo(n.position);
        d>3?bot.pathfinder.setGoal(new Goals.GoalNear(n.position.x,n.position.y,n.position.z,2),true)
        :d<4&&!bot.pvp.target&&bot.pvp.attack(n);
    },1500);

    bot.on('chat',async(u,m)=>{
        if(u===bot.username)return;
        const p=m.split(/\s+/),cmd=p[0].toLowerCase(),ign=ignoredUsers.has(u.toLowerCase());

        if(syncChat&&ign) bots.forEach(b=>{try{b.chat(m)}catch{}});

        if(!ign&&!cmd.startsWith('$'))return;

        switch(cmd){

            case '$help':bot.chat('Commands: $coords $goto $kill $repeat $ask $followup $summon $unsummon $hunt $ignore');break;

            case '$coords':let pos=bot.entity.position;bot.chat(`X:${pos.x|0} Y:${pos.y|0} Z:${pos.z|0}`);break;

            case '$goto':
                let [x,y,z]=p.slice(1,4).map(Number);
                if(![x,y,z].some(isNaN))bot.pathfinder.setGoal(new Goals.GoalBlock(x,y,z));
            break;

            case '$kill':bot.chat('/kill');break;

            case '$repeat':
                let n=parseInt(p.at(-1)),txt=p.slice(1,-1).join(' ');
                if(!isNaN(n)){let i=0;let f=setInterval(()=>{if(i++>=n)return clearInterval(f);bot.chat(txt)},2000);}
            break;

            case '$ask':
                let q=p.slice(1).join(' ');
                if(!q)return bot.chat('Ask something!');
                try{
                    let recent=messageLog.slice(-50).join(' | ');
                    let r=await O.chat.completions.create({
                        model:"llama-3.1-8b-instant",
                        messages:[
{role:"system",content:`You are CodeBot840, a fully server-aware bot.
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
{role:"user",content:`Server: ${recent}\nQ: ${q}`}
]});
                    let out=r.choices?.[0]?.message?.content||"";
                    out=out.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
                    for(let line of out.split(/\n+/)){
                        while(line.length){
                            bot.chat(line.slice(0,240));
                            line=line.slice(240);
                            await new Promise(r=>setTimeout(r,1000));
                        }
                    }
                }catch{bot.chat("AI error")}
            break;

            case '$followup':
                let f=p[1],t=p.slice(2).join(' ');
                if(f&&t){followUps[f.toLowerCase()]=t;bot.chat(`Follow-up set for ${f}`);}
            break;

            case '$summon':
                let count=parseInt(p[1]),sync=p[2]==='true';
                if(isNaN(count))return;

                if(proxies.length===0){
                    bot.chat("No working proxies yet!");
                    return;
                }

                syncChat=sync;

                for(let i=0;i<count;i++){
                    spawnBot(proxies[i%proxies.length]);
                }

                bot.chat(`Summoned ${count} bots | Proxies: ${proxies.length}`);
            break;

            case '$unsummon':
                bots.forEach(b=>b.quit());
                bots.length=0;
                bot.chat('Bots removed');
            break;

            case '$hunt':
                if(p[1]==='on'){huntMode=true;bot.chat('Hunting ON')}
                else if(p[1]==='off'){huntMode=false;bot.chat('Hunting OFF')}
            break;
        }
    });
}

/** ------------------- Start ------------------- **/
startMainBot();

app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
