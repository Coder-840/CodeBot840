'use strict';

const mineflayer = require('mineflayer');
const { pathfinder: Pathfinder, goals: Goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const net = require('net');
const SocksProxyAgent = require('socks-proxy-agent');

const O = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** ------------------- PROXY SYSTEM ------------------- **/
const proxiesFile = './proxies.json';
let proxies = [];
if (fs.existsSync(proxiesFile)) {
    try { proxies = JSON.parse(fs.readFileSync(proxiesFile)); } catch {}
}
function saveProxies() {
    fs.writeFileSync(proxiesFile, JSON.stringify(proxies, null, 2));
}

let scanning = true;

// proxy sources
const SOURCES = [
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=2000&country=all',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'
];

function parseList(text) {
    return text.split('\n')
        .map(l => l.trim())
        .filter(l => l.includes(':'))
        .map(l => {
            const [ip, port] = l.split(':');
            return { ip, port: parseInt(port) || 1080 };
        });
}

function testProxy(ip, port = 1080, timeout = 2000) {
    return new Promise(resolve => {
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

async function fetchProxies() {
    try {
        let all = [];

        for (const url of SOURCES) {
            try {
                const res = await axios.get(url, { timeout: 5000 });
                all.push(...parseList(res.data));
            } catch {}
        }

        const unique = [];
        const seen = new Set();

        for (const p of all) {
            const key = `${p.ip}:${p.port}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(p);
            }
        }

        console.log(`[SCRAPER] ${unique.length} proxies fetched`);

        const batch = unique.slice(0, 100);

        const results = await Promise.allSettled(
            batch.map(p => testProxy(p.ip, p.port))
        );

        for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'fulfilled' && results[i].value) {
                const p = batch[i];
                if (!proxies.find(x => x.ip === p.ip && x.port === p.port)) {
                    proxies.push(p);
                    console.log(`[VALID] ${p.ip}:${p.port} | Total: ${proxies.length}`);
                }
            }
        }

        saveProxies();

    } catch (err) {
        console.log('[SCRAPER ERROR]', err.message);
    }
}

setInterval(fetchProxies, 10000);

// cleaner
setInterval(async () => {
    if (proxies.length === 0) return;

    console.log('[CLEANER] Checking proxies...');

    const results = await Promise.allSettled(
        proxies.map(p => testProxy(p.ip, p.port))
    );

    proxies = proxies.filter((p, i) =>
        results[i].status === 'fulfilled' && results[i].value
    );

    console.log(`[CLEANER] Remaining: ${proxies.length}`);
    saveProxies();

}, 60000);

/** ------------------- BOT SYSTEM ------------------- **/
const bots = [];
const PASSWORD = 'YourSecurePassword123';
const ignoredUsers = new Set(['player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz']);

let messageLog = [];
let huntMode = false;
let syncChat = false;
const followUps = {};

function randomName() {
    const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 6 + Math.random() * 6 | 0 }, () => c[Math.random() * c.length | 0]).join('');
}

function spawnBot(proxy) {
    const bot = mineflayer.createBot({
        host: 'noBnoT.org',
        port: 25565,
        username: 'CodeBot_' + randomName(),
        version: '1.12.2',
        agent: new SocksProxyAgent(`socks5://${proxy.ip}:${proxy.port}`)
    });

    setupBot(bot);
    bots.push(bot);
}

function startMainBot() {
    const bot = mineflayer.createBot({
        host: 'noBnoT.org',
        port: 25565,
        username: 'CodeBot840',
        version: '1.12.2'
    });

    setupBot(bot, true);

    bot.on('end', () => setTimeout(startMainBot, 10000));
}

function setupBot(bot, isMain = false) {

    bot.loadPlugin(Pathfinder);
    bot.loadPlugin(pvp);

    bot.once('login', () => setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000));

    bot.on('messagestr', msg => {
        messageLog.push(msg);
        if (messageLog.length > 100) messageLog.shift();
        if (isMain) console.log('[CHAT]', msg);

        const t = msg.toLowerCase();
        if (t.includes('register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
        if (t.includes('login')) bot.chat(`/login ${PASSWORD}`);
    });

    setInterval(() => {
        if (!huntMode || !bot.entity) return;

        let targets = Object.values(bot.entities)
            .filter(e => e.type === 'player' && e !== bot.entity && !e.isDead && !ignoredUsers.has(e.username?.toLowerCase()));

        if (!targets.length) return;

        targets.sort((a, b) =>
            a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position)
        );

        const target = targets[0];
        const dist = bot.entity.position.distanceTo(target.position);

        if (dist > 3)
            bot.pathfinder.setGoal(new Goals.GoalNear(target.position.x, target.position.y, target.position.z, 2), true);
        else if (dist < 4 && !bot.pvp.target)
            bot.pvp.attack(target);

    }, 1500);

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        const parts = message.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const isIgnored = ignoredUsers.has(username.toLowerCase());

        if (syncChat && isIgnored) bots.forEach(b => { try { b.chat(message); } catch {} });

        if (!isIgnored && !cmd.startsWith('$')) return;

        switch (cmd) {

            case '$help':
                bot.chat('Commands: $coords $goto $kill $repeat $ask $followup $summon $unsummon $hunt $ignore');
                break;

            case '$coords':
                const pos = bot.entity.position;
                bot.chat(`X:${pos.x|0} Y:${pos.y|0} Z:${pos.z|0}`);
                break;

            case '$goto':
                const [x,y,z] = parts.slice(1,4).map(Number);
                if (![x,y,z].some(isNaN))
                    bot.pathfinder.setGoal(new Goals.GoalBlock(x,y,z));
                break;

            case '$kill':
                bot.chat('/kill');
                break;

            case '$repeat':
                let count = parseInt(parts.at(-1));
                let text = parts.slice(1,-1).join(' ');
                if (!isNaN(count)) {
                    let i = 0;
                    let f = setInterval(() => {
                        if (i++ >= count) return clearInterval(f);
                        bot.chat(text);
                    }, 2000);
                }
                break;

            case '$ask':
                const question = parts.slice(1).join(' ');
                if (!question) return bot.chat('Ask something!');

                try {
                    const recent = messageLog.slice(-50).join(' | ');

                    const resp = await O.chat.completions.create({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            {
                                role: "system",
                                content: `You are CodeBot840, a fully server-aware bot.
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
                                role: "user",
                                content: `Server: ${recent}\nQ: ${question}`
                            }
                        ]
                    });

                    let out = resp.choices?.[0]?.message?.content || "";
                    out = out.replace(/<think>[\s\S]*?<\/think>/g,'').trim();

                    for (let line of out.split(/\n+/)) {
                        while (line.length) {
                            bot.chat(line.slice(0,240));
                            line = line.slice(240);
                            await new Promise(r => setTimeout(r,1000));
                        }
                    }

                } catch {
                    bot.chat("AI error");
                }
                break;

            case '$followup':
                const fUser = parts[1];
                const fText = parts.slice(2).join(' ');
                if (fUser && fText) {
                    followUps[fUser.toLowerCase()] = fText;
                    bot.chat(`Follow-up set for ${fUser}`);
                }
                break;

            case '$summon':
                let n = parseInt(parts[1]);
                let sync = parts[2] === 'true';

                if (isNaN(n)) return;

                if (proxies.length === 0) {
                    bot.chat("No working proxies yet!");
                    return;
                }

                syncChat = sync;

                for (let i = 0; i < n; i++) {
                    spawnBot(proxies[i % proxies.length]);
                }

                bot.chat(`Summoned ${n} bots | Proxies: ${proxies.length}`);
                break;

            case '$unsummon':
                bots.forEach(b => b.quit());
                bots.length = 0;
                bot.chat('Bots removed');
                break;

            case '$hunt':
                if (parts[1] === 'on') { huntMode = true; bot.chat('Hunting ON'); }
                else if (parts[1] === 'off') { huntMode = false; bot.chat('Hunting OFF'); }
                break;
        }
    });
}

/** ------------------- START ------------------- **/
startMainBot();

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
