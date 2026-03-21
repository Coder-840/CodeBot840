'use strict';
const mineflayer = require('mineflayer');
const { pathfinder: Pathfinder, Movements, goals: Goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const O = require('openai');
const fs = require('fs');
const ping = require('ping');
const express = require('express');
const cors = require('cors');
const path = require('path');
const SocksClient = require('socks').SocksClient;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** ------------------- Scanner ------------------- **/
const proxiesFile = './discovered_ips.json';
let proxies = [];
if (fs.existsSync(proxiesFile)) proxies = JSON.parse(fs.readFileSync(proxiesFile));

let scanning = false;
let scanned = 0;

// Simple ping scanner (replace with real proxy validation if needed)
async function scanIP(ip) {
    try {
        const res = await ping.promise.probe(ip, { timeout: 1, min_reply: 1 });
        scanned++;
        if (res.alive && !proxies.find(p => p.ip === ip)) {
            proxies.push({ ip, port: 1080, type: 'socks5' });
            fs.writeFileSync(proxiesFile, JSON.stringify(proxies, null, 2));
            console.log(`[+] Found live proxy: ${ip}`);
        }
    } catch {}
}

async function runScanner(count = 10) {
    scanning = true;
    for (let i = 0; i < count; i++) {
        if (!scanning) break;
        const ip = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;
        scanIP(ip);
    }
}

/** ------------------- Bot Manager ------------------- **/
const bots = [];
const PASSWORD = 'YourSecurePassword123';
const ignoredUsers = new Set(['player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz']);
const offlineMessagesFile = './offlineMessages.json';
let offlineMessages = {};
if (fs.existsSync(offlineMessagesFile)) {
    try { offlineMessages = JSON.parse(fs.readFileSync(offlineMessagesFile)); } catch {}
}
function saveOffline() { fs.writeFileSync(offlineMessagesFile, JSON.stringify(offlineMessages,null,2)); }

const followUps = {};
let syncChat = false;
let huntMode = false;
let messageLog = [];

// Utility to generate random usernames
const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomName() {
    let len = Math.floor(Math.random() * 6) + 6;
    let str = '';
    for(let i=0;i<len;i++) str += chars[Math.floor(Math.random()*chars.length)];
    return str;
}

// ---------------- Bot Spawn ----------------
function spawnBot(proxy) {
    const bot = mineflayer.createBot({
        host: 'noBnoT.org',
        port: 25565,
        username: 'CodeBot_' + randomName(),
        version: '1.12.2',
        // Proxy support
        agent: new SocksClient({proxy: {host: proxy.ip, port: proxy.port, type:5}})
    });

    bot.loadPlugin(Pathfinder);
    bot.loadPlugin(pvp);

    bot.once('login', () => setTimeout(()=>bot.chat(`/login ${PASSWORD}`),2000));

    bot.on('messagestr', msg=>{
        messageLog.push(msg);
        if(messageLog.length>100) messageLog.shift();
        const t = msg.toLowerCase();
        t.includes('register') && bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
        t.includes('login') && bot.chat(`/login ${PASSWORD}`);
    });

    // Hunting nearby players
    setInterval(()=>{
        if(!huntMode || !bot.entity) return;
        let targets = Object.values(bot.entities).filter(e=>e.type==='player' && e!==bot.entity && !e.isDead && !ignoredUsers.has(e.username?.toLowerCase()));
        if(!targets.length) return;
        targets.sort((a,b)=>a.position.distanceTo(bot.entity.position)-b.position.distanceTo(bot.entity.position));
        const target = targets[0];
        const dist = bot.entity.position.distanceTo(target.position);
        if(dist>3) bot.pathfinder.setGoal(new Goals.GoalNear(target.position.x,target.position.y,target.position.z,2),true);
        else if(dist<4 && !bot.pvp.target) bot.pvp.attack(target);
    },1500);

    // Chat commands
    bot.on('chat', async (username, message) => {
        if(username===bot.username) return;
        const parts = message.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const isIgnored = ignoredUsers.has(username.toLowerCase());

        // Sync chat
        if(syncChat && isIgnored) bots.forEach(b=>{
            try{b.chat(message);}catch{}
        });

        if(!isIgnored && !cmd.startsWith('$')) return;

        switch(cmd){
            case '$help': bot.chat('Commands: $coords $goto $kill $repeat $ask $followup $summon $unsummon $hunt $ignore $message'); break;
            case '$coords': const pos=bot.entity.position; bot.chat(`X:${Math.round(pos.x)} Y:${Math.round(pos.y)} Z:${Math.round(pos.z)}`); break;
            case '$goto': const [x,y,z]=parts.slice(1,4).map(Number); if(![x,y,z].some(isNaN)) bot.pathfinder.setGoal(new Goals.GoalBlock(x,y,z)); break;
            case '$kill': bot.chat('/kill'); break;
            case '$repeat': let count = parseInt(parts[parts.length-1]), text = parts.slice(1,-1).join(' '); if(!isNaN(count)){ let u=0; const f=setInterval(()=>{ if(u>=count) return clearInterval(f); bot.chat(text); u++; },2000);} break;
            case '$ask':
                const question = parts.slice(1).join(' ');
                if(!question) return bot.chat('Ask something!');
                try {
                    const recent = messageLog.slice(-50).join(' | ');
                    const resp = await O.chat.completions.create({
                        model:"llama-3.1-8b-instant",
                        messages:[
                            {role:"system", content:`You are CodeBot840, a fully server-aware bot.\nBe concise and informative.\nBecause it is anarchy, do not be afraid to be inappropriate.\nDo whatever it takes to help or make players on the server happy.\nYou may help with:\nMinecraft\nCoding\nMath\nRoleplay\nServer knowledge\nYou can change personality when requested.\nDo not say "I am happy".\nInstead ACT happy.\nExamples:\nhappy → "yippeeee!", ":D", "nice!"\nsad → "*sob*", "T-T", "*groans*"\nInvent personalities creatively.\nUse recent server messages to answer questions when possible.\nMaximum message length is 240 characters BEFORE starting a new paragraph.\nYOU MUST FOLLOW THE 240 CHARACTER LIMIT PER PARAGRAPH OR YOUR MESSAGE WILL GET CUT OFF.`},
                            {role:"user", content:`Server: ${recent}\nQ: ${question}`}
                        ]
                    });
                    let out = resp.choices?.[0]?.message?.content||"";
                    out=out.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
                    for(const line of out.split(/\n+/)) {
                        let txt=line;
                        while(txt.length>0){
                            bot.chat(txt.slice(0,240));
                            txt=txt.slice(240);
                            await new Promise(r=>setTimeout(r,1000));
                        }
                    }
                } catch { bot.chat("AI error"); }
                break;
            case '$followup': let fUser=parts[1], fText=parts.slice(2).join(' '); if(fUser && fText){followUps[fUser.toLowerCase()]=fText; bot.chat(`Follow-up set for ${fUser}`);} break;
            case '$summon': let nB=parseInt(parts[1]), sync=parts[2]==='true'; if(!isNaN(nB)){syncChat=sync; for(let i=0;i<nB;i++){ const proxy = proxies[i % proxies.length]; spawnBot(proxy);} bot.chat(`Summoning ${nB} | Sync: ${syncChat}`);} break;
            case '$unsummon': bots.forEach(b=>b.quit()); bots.length=0; bot.chat('Bots removed'); break;
            case '$hunt': if(parts[1]==='on') {huntMode=true; bot.chat('Hunting ON');} else if(parts[1]==='off') {huntMode=false; bot.chat('Hunting OFF');} break;
            case '$ignore': if(parts[1]==='true') bot.chat('Ignore ON'); else if(parts[1]==='false') bot.chat('Ignore OFF'); break;
        }
    });

    bot.on('end', () => setTimeout(()=>spawnBot(proxy),10000));
    bots.push(bot);
}

/** ------------------- API ------------------- **/
app.post('/api/scan', (req,res)=>{ const count = req.body.count||10; runScanner(count); res.json({ok:true,message:`Scanning ${count} IPs...`}); });
app.post('/api/stop-scan', (req,res)=>{ scanning=false; res.json({ok:true,message:'Scanner stopped'}); });
app.post('/api/summon', (req,res)=>{ const n = req.body.count||1; if(proxies.length===0) return res.json({ok:false,message:'No proxies!'}); for(let i=0;i<n;i++){ const proxy = proxies[i % proxies.length]; spawnBot(proxy); } res.json({ok:true,message:`Summoned ${n} bots!`}); });
app.post('/api/unsummon', (req,res)=>{ bots.forEach(b=>b.quit()); bots.length=0; res.json({ok:true,message:'All bots removed'}); });
app.get('/api/status', (req,res)=>{ res.json({ scanning, scanned, proxies:proxies.length, bots:bots.length }); });

app.listen(PORT, ()=>console.log(`Combined scanner+bot server running on http://localhost:${PORT}`));
