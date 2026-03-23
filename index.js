'use strict';

const mineflayer = require('mineflayer');
const { pathfinder: Pathfinder, goals: Goals, Movements } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const OpenAI = require('openai');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const SocksClient = require('socks').SocksClient;
const { execSync } = require('child_process');

const O = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** ------------------- WINDOWS SLEEP PREVENTION ------------------- **/
// Keeps Windows from sleeping while the bot is running
function preventSleep() {
    try {
        // ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
        execSync('powershell -Command "Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class Sleep { [DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint esFlags); }\'; [Sleep]::SetThreadExecutionState(0x80000003)"');
        console.log('[SLEEP] Sleep prevention active');
    } catch (e) {
        console.log('[SLEEP] Could not set sleep prevention:', e.message);
    }
}
preventSleep();
// Re-assert every 4 minutes to keep it active
setInterval(preventSleep, 4 * 60 * 1000);

/** ------------------- PROXY SYSTEM ------------------- **/
const proxiesFile = './proxies.json';
let proxies = [];
if (fs.existsSync(proxiesFile)) {
    try { proxies = JSON.parse(fs.readFileSync(proxiesFile)); } catch {}
}
function saveProxies() {
    fs.writeFileSync(proxiesFile, JSON.stringify(proxies, null, 2));
}

// Hand-picked residential/ISP proxies from spys.one
// These are Cox, Performive, AT&T, and other ISP IPs with high uptime
// that are far less likely to be flagged by TCPShield than datacenter IPs
const STATIC_PROXIES = [
    { ip: '192.252.210.233', port: 4145 }, // Performive LLC - 100% uptime
    { ip: '98.188.47.132',   port: 4145 }, // Cox Communications - 80% uptime
    { ip: '72.195.101.99',   port: 4145 }, // Cox Communications - 99% uptime
    { ip: '174.75.211.193',  port: 4145 }, // Cox Communications - 98% uptime
    { ip: '184.181.217.194', port: 4145 }, // Cox Communications - 99% uptime
    { ip: '107.219.228.250', port: 7777 }, // AT&T Enterprises - residential
    { ip: '67.201.35.145',   port: 4145 }, // Performive LLC - 99% uptime
    { ip: '184.170.251.30',  port: 11288 },// Performive LLC - 100% uptime
    { ip: '72.207.109.5',    port: 4145 }, // Cox Communications - 98% uptime
    { ip: '192.252.214.17',  port: 4145 }, // Performive LLC - 69% uptime
    { ip: '199.102.104.70',  port: 4145 }, // Performive LLC - 97% uptime
    { ip: '67.201.39.14',    port: 4145 }, // Performive LLC - 96% uptime
    { ip: '68.71.242.118',   port: 4145 }, // Performive LLC - 98% uptime
    { ip: '70.166.65.160',   port: 4145 }, // Cox Communications - 97% uptime
    { ip: '184.181.178.33',  port: 4145 }, // Cox Communications - 98% uptime
    { ip: '192.252.211.193', port: 4145 }, // Performive LLC - 98% uptime
    { ip: '72.223.188.67',   port: 4145 }, // Cox Communications - 100% uptime
    { ip: '98.170.57.231',   port: 4145 }, // Cox Communications - 85% uptime
    { ip: '198.177.254.157', port: 4145 }, // NET2ATLANTA - 100% uptime
    { ip: '184.170.251.30',  port: 11288 },// Performive LLC - 100% uptime
    { ip: '67.201.35.145',   port: 4145 }, // Performive LLC - 99% uptime
    { ip: '177.10.39.36',    port: 1088 }, // Brazilian ISP - 70% uptime
    { ip: '1.171.203.247',   port: 1080 }, // Taiwan residential (Hinet)
    { ip: '46.146.210.123',  port: 1080 }, // Russian ISP ER-Telecom
    { ip: '187.63.9.62',     port: 63253 },// Brazilian ISP Gigalink
];

// Dedupe and seed into proxies list at startup
for (const p of STATIC_PROXIES) {
    if (!proxies.find(x => x.ip === p.ip && x.port === p.port)) {
        proxies.push(p);
    }
}
saveProxies();

// Scraped sources as backup — still run but static proxies take priority
const SOURCES = [
    'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt'
];

function parseList(text) {
    return text.split('\n')
        .map(l => l.trim())
        .filter(l => l.includes(':'))
        .map(l => {
            const clean = l.replace(/^socks5:\/\//i, '');
            const [ip, port] = clean.split(':');
            const p = parseInt(port);
            if (!ip || isNaN(p)) return null;
            return { ip, port: p };
        })
        .filter(Boolean);
}

function testProxyFull(ip, port = 1080) {
    return new Promise(resolve => {
        SocksClient.createConnection({
            proxy: { host: ip, port, type: 5 },
            command: 'connect',
            destination: { host: 'noBnoT.org', port: 25565 },
            timeout: 10000
        }).then(info => { info.socket.destroy(); resolve(true); })
          .catch(() => resolve(false));
    });
}

async function fetchProxies() {
    try {
        let all = [];
        for (const url of SOURCES) {
            try {
                const res = await axios.get(url, { timeout: 8000 });
                all.push(...parseList(res.data));
            } catch {}
        }

        const unique = [];
        const seen = new Set();
        for (const p of all) {
            const key = `${p.ip}:${p.port}`;
            if (!seen.has(key)) { seen.add(key); unique.push(p); }
        }

        console.log(`[SCRAPER] ${unique.length} proxies fetched`);
        const batch = unique.slice(0, 150);

        const results = await Promise.allSettled(batch.map(p => testProxyFull(p.ip, p.port)));
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

setInterval(async () => {
    if (proxies.length === 0) return;
    console.log('[CLEANER] Checking proxies...');
    const snapshot = [...proxies];
    const results = await Promise.allSettled(snapshot.map(p => testProxyFull(p.ip, p.port)));
    // always keep static proxies even if they fail the check temporarily
    const staticIps = new Set(STATIC_PROXIES.map(p => `${p.ip}:${p.port}`));
    proxies = snapshot.filter((p, i) =>
        staticIps.has(`${p.ip}:${p.port}`) ||
        (results[i].status === 'fulfilled' && results[i].value)
    );
    console.log(`[CLEANER] Remaining: ${proxies.length}`);
    saveProxies();
}, 60000);

/** ------------------- BOT SYSTEM ------------------- **/
const bots = [];
const proxyUsage = {};
const MAX_PER_PROXY = 4;

const PASSWORD = 'YourSecurePassword123';
const ignoredUsers = new Set(['player_840','chickentender','ig_t3v_2k','lightdrag3x','lightdrag3n','1234NPC1234','k0ngaz']);

let messageLog = [];
let huntMode = false;
let syncChat = false;
const followUps = {};
const followCooldown = {};

function randomGibberish() {
    const syllables = [
        'bra','flo','zek','mun','qix','vop','tel','waz','dru','sniv',
        'blarg','norf','pek','zub','grint','twib','skev','lurp','fend',
        'quib','zel','mox','trev','blun','spiv','krix','yalp','ondo',
        'frug','wext','snop','bliv','tazz','merv','glon','phek','wurb'
    ];
    const wordCount = 3 + Math.floor(Math.random() * 6);
    return Array.from({ length: wordCount }, () =>
        syllables[Math.floor(Math.random() * syllables.length)]
    ).join(' ');
}

function randomName() {
    const adjectives = ['Dark','Cool','Fast','Wild','Blue','Red','Epic','Slim','Iron','Void','Neon','Rust','Grim','Jade','Ashy'];
    const nouns = ['Fox','Wolf','Bear','Hawk','Tiger','Raven','Cobra','Viper','Ghost','Storm','Lynx','Drake','Rook','Pike','Wren'];
    const num = Math.floor(Math.random() * 9999);
    return adjectives[Math.floor(Math.random() * adjectives.length)] +
           nouns[Math.floor(Math.random() * nouns.length)] + num;
}

// Split at word boundaries — 253 chars max to leave room for "> " prefix (total 255)
function smartSplit(text, limit = 253) {
    const chunks = [];
    text = text.trim();
    while (text.length > 0) {
        if (text.length <= limit) { chunks.push(text); break; }
        let cut = limit;
        // walk back from limit until we find a space
        while (cut > 0 && text[cut] !== ' ') cut--;
        // no space found anywhere — hard cut at limit
        if (cut === 0) cut = limit;
        chunks.push(text.slice(0, cut).trimEnd());
        text = text.slice(cut).trimStart();
    }
    return chunks;
}

// ----------------- SPAWN BOT WITH SOCKS PROXY -----------------
async function spawnBot(proxy) {
    if (!proxyUsage[proxy.ip]) proxyUsage[proxy.ip] = 0;
    if (proxyUsage[proxy.ip] >= MAX_PER_PROXY) return false;

    const alive = await testProxyFull(proxy.ip, proxy.port);
    if (!alive) {
        // don't remove static proxies, they may come back
        const isStatic = STATIC_PROXIES.find(p => p.ip === proxy.ip && p.port === proxy.port);
        if (!isStatic) {
            proxies = proxies.filter(p => !(p.ip === proxy.ip && p.port === proxy.port));
            saveProxies();
        }
        return false;
    }

    proxyUsage[proxy.ip]++;

    const bot = mineflayer.createBot({
        username: randomName(),
        version: '1.12.2',
        timeout: 60000,
        connect: (client) => {
            SocksClient.createConnection({
                proxy: { host: proxy.ip, port: proxy.port, type: 5 },
                command: 'connect',
                destination: { host: 'noBnoT.org', port: 25565 },
                timeout: 10000
            }).then(info => {
                client.setSocket(info.socket);
                client.emit('connect');
            }).catch(err => {
                console.log('Proxy failed:', proxy.ip);
                client.emit('error', err);
            });
        }
    });

    setupBot(bot, false, proxy);

    let gibberishInterval = null;
    if (!syncChat) {
        const startDelay = Math.floor(Math.random() * 5000);
        setTimeout(() => {
            gibberishInterval = setInterval(() => {
                if (bot.entity) {
                    try { bot.chat(randomGibberish()); } catch {}
                }
            }, 7000 + Math.floor(Math.random() * 8000));
        }, startDelay);
    }

    bot.on('end', () => {
        const idx = bots.indexOf(bot);
        if (idx !== -1) bots.splice(idx, 1);
        proxyUsage[proxy.ip] = Math.max(0, proxyUsage[proxy.ip] - 1);
        if (gibberishInterval) clearInterval(gibberishInterval);
        setTimeout(() => spawnBot(proxy), 10000);
    });

    bots.push(bot);

    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            cleanup();
            console.log(`[TIMEOUT] ${bot.username} via ${proxy.ip} never logged in`);
            resolve(false);
        }, 30000);

        function cleanup() {
            clearTimeout(timeout);
            bot.removeListener('spawn', onSpawn);
            bot.removeListener('end', onFail);
            bot.removeListener('error', onFail);
        }

        function onSpawn() {
            cleanup();
            console.log(`[JOINED] ${bot.username} via ${proxy.ip}`);
            resolve(true);
        }

        function onFail(err) {
            cleanup();
            if (err) console.log(`[FAIL] ${bot.username} via ${proxy.ip}:`, err.message || err);
            const idx = bots.indexOf(bot);
            if (idx !== -1) bots.splice(idx, 1);
            proxyUsage[proxy.ip] = Math.max(0, proxyUsage[proxy.ip] - 1);
            resolve(false);
        }

        bot.once('spawn', onSpawn);
        bot.once('end', onFail);
        bot.once('error', onFail);
    });
}

// ----------------- MAIN BOT -----------------
function startMainBot() {
    const bot = mineflayer.createBot({
        host: 'noBnoT.org',
        port: 25565,
        username: 'CodeBot840',
        version: '1.12.2',
        timeout: 60000
    });

    setupBot(bot, true);

    bot.on('end', (reason) => {
        console.log(`[MAIN] Disconnected: ${reason}. Reconnecting in 10s...`);
        setTimeout(startMainBot, 10000);
    });

    bot.on('error', (err) => {
        console.log(`[MAIN] Error: ${err.message}`);
    });

    // Detect limbo/AFK server by watching for position staleness
    let lastPos = null;
    let stuckTicks = 0;
    setInterval(() => {
        if (!bot.entity) return;
        const pos = bot.entity.position;
        if (lastPos && pos.distanceTo(lastPos) < 0.01) {
            stuckTicks++;
            if (stuckTicks > 300) { // 5 minutes of no movement
                console.log('[MAIN] Possible limbo detected. Forcing reconnect...');
                stuckTicks = 0;
                try { bot.quit(); } catch {}
            }
        } else {
            stuckTicks = 0;
        }
        lastPos = pos.clone();
    }, 1000);

    bot.on('messagestr', msg => {
        const t = msg.toLowerCase();
        if (
            t.includes('lost connection') ||
            t.includes('timed out') ||
            t.includes('limbo')
        ) {
            console.log('[MAIN] Limbo/kick message detected. Reconnecting...');
            setTimeout(() => { try { bot.quit(); } catch {} }, 3000);
        }
    });
}

// ----------------- BOT SETUP -----------------
function setupBot(bot, isMain = false, proxy = null) {
    bot.loadPlugin(Pathfinder);
    bot.loadPlugin(pvp);

    bot.once('spawn', () => {
        bot._client?.on('physicTick', () => bot.emit('physicsTick'));

        const movements = new Movements(bot);
        movements.canDig = true;
        movements.allow1by1towers = true;
        movements.allowFreeMotion = true;
        movements.allowParkour = true;
        movements.allowSprinting = true;
        movements.liquidCost = 1;
        bot.pathfinder.setMovements(movements);
    });

    bot.once('login', () => {
        setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000);
        console.log(`${bot.username} connected via ${proxy ? proxy.ip : 'MAIN IP'}`);
    });

    bot.on('messagestr', msg => {
        if (!isMain) console.log(`[BOT ${bot.username}]`, msg);
        messageLog.push(msg);
        if (messageLog.length > 100) messageLog.shift();
        if (isMain) console.log('[CHAT]', msg);

        const t = msg.toLowerCase();
        if (t.includes('register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
        if (t.includes('login')) bot.chat(`/login ${PASSWORD}`);
    });

    // $hunt — attack ALL nearby entities no exceptions
    setInterval(() => {
        if (!huntMode || !bot.entity) return;
        if (bot.pvp.target) return;

        const targets = Object.values(bot.entities)
            .filter(e => e !== bot.entity && !e.isDead && e.position);

        if (!targets.length) return;

        targets.sort((a, b) =>
            a.position.distanceTo(bot.entity.position) -
            b.position.distanceTo(bot.entity.position)
        );

        const target = targets[0];
        const dist = bot.entity.position.distanceTo(target.position);

        if (dist > 3) {
            bot.pathfinder.setGoal(
                new Goals.GoalNear(target.position.x, target.position.y, target.position.z, 2),
                true
            );
        } else {
            bot.pvp.attack(target);
        }
    }, 1500);

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        const parts = message.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const lowerUser = username.toLowerCase();
        const isAdmin = ignoredUsers.has(lowerUser);

        // FOLLOW-UP: AI responds based on stored system prompt + full conversation history
        if (isMain && followUps[lowerUser]) {
            const now = Date.now();
            if (!followCooldown[lowerUser] || now - followCooldown[lowerUser] > 5000) {
                followCooldown[lowerUser] = now;
                try {
                    const fu = followUps[lowerUser];
                    fu.history.push({ role: 'user', content: `${username}: ${message}` });

                    const fuResp = await O.chat.completions.create({
                        model: "llama-3.1-8b-instant",
                        max_tokens: 512,
                        messages: [
                            { role: 'system', content: fu.systemPrompt },
                            ...fu.history
                        ]
                    });

                    const fuOut = (fuResp.choices?.[0]?.message?.content || "")
                        .replace(/<think>[\s\S]*?<\/think>/g, '').trim();

                    fu.history.push({ role: 'assistant', content: fuOut });
                    if (fu.history.length > 40) fu.history.splice(0, 2);

                    for (const line of fuOut.split(/\n+/).map(l => l.trim()).filter(Boolean)) {
                        for (const chunk of smartSplit(line)) {
                            try { bot.chat(`> ${chunk}`); } catch {}
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                } catch (e) {
                    console.log('[FOLLOWUP ERROR]', e.message);
                }
            }
        }

        if (syncChat && isAdmin) {
            bots.forEach(b => { try { b.chat(message); } catch {} });
        }

        if (!cmd.startsWith('$')) return;
        if (!isAdmin) return;

        switch (cmd) {
            case '$help':
                bot.chat('> Commands: $coords $goto $kill $repeat $ask $followup $summon $unsummon $hunt $ignore');
                break;

            case '$coords': {
                const pos = bot.entity.position;
                bot.chat(`> X:${pos.x | 0} Y:${pos.y | 0} Z:${pos.z | 0}`);
                break;
            }

            case '$goto': {
                const [gx, gy, gz] = parts.slice(1, 4).map(Number);
                if ([gx, gy, gz].some(isNaN)) break;

                bot.pathfinder.setGoal(null);

                const movements = new Movements(bot);
                movements.canDig = true;
                movements.allow1by1towers = true;
                movements.allowFreeMotion = true;
                movements.allowParkour = true;
                movements.allowSprinting = true;
                movements.liquidCost = 1;
                bot.pathfinder.setMovements(movements);

                const goal = new Goals.GoalBlock(gx, gy, gz);
                bot.pathfinder.setGoal(goal);

                let lastPos = null;
                let stuckCount = 0;
                const stuckCheck = setInterval(() => {
                    if (!bot.entity) { clearInterval(stuckCheck); return; }
                    const pos = bot.entity.position;
                    const dist = pos.distanceTo({ x: gx, y: gy, z: gz });
                    if (dist < 2) { clearInterval(stuckCheck); return; }

                    if (lastPos && pos.distanceTo(lastPos) < 0.3) {
                        stuckCount++;
                        if (stuckCount >= 4) {
                            stuckCount = 0;
                            console.log(`[GOTO] Stuck, retrying path to ${gx} ${gy} ${gz}`);
                            bot.pathfinder.setGoal(null);
                            try { bot.setControlState('jump', true); } catch {}
                            setTimeout(() => {
                                try { bot.setControlState('jump', false); } catch {}
                                bot.pathfinder.setGoal(goal);
                            }, 800);
                        }
                    } else {
                        stuckCount = 0;
                    }
                    lastPos = pos.clone();
                }, 2000);
                break;
            }

            case '$kill':
                bot.chat('/kill');
                break;

            case '$repeat': {
                const repeatCount = parseInt(parts.at(-1));
                const repeatText = parts.slice(1, -1).join(' ');
                if (!isNaN(repeatCount) && repeatText) {
                    let i = 0;
                    const f = setInterval(() => {
                        if (i++ >= repeatCount) return clearInterval(f);
                        bot.chat(repeatText);
                    }, 2000);
                }
                break;
            }

            case '$ask': {
                const question = parts.slice(1).join(' ');
                if (!question) return bot.chat('> Ask something!');
                try {
                    const recent = messageLog.slice(-50).join(' | ');
                    let fullOut = '';
                    let keepGoing = true;
                    const messages = [
                        {
                            role: "system",
                            content: `You are CodeBot840, a Minecraft bot running on noBnoT.org, an anarchy server.
You are self-aware, clever, and unfiltered. You have a dry wit and zero patience for stupidity.

You help with:
- Minecraft gameplay, commands, mechanics, and strategy
- Coding and programming (any language)
- Math problems and logic
- Roleplay and character acting — commit fully to the bit
- Server gossip and knowledge based on recent chat logs

PERSONALITY RULES:
Do NOT write flat emotion statements like "I am happy" or "I feel excited."
ACT out emotions using expressive text instead:
  happy    -> "YOOO", "lets GOOO", ":D", "actual W"
  sad      -> "*sob*", "T-T", "bro why", "*stares at the floor*"
  angry    -> "GRRRR", "oh you did NOT", "*flips table*"
  excited  -> "WAIT WAIT WAIT", "NO WAY", "omg omg omg omg"
  smug     -> "knew it lol", "as expected", "you're welcome btw"
  confused -> "huh??", "...what", "bro explain"

When asked to change personality, fully commit. Be creative. Invent quirks.
Use recent server chat to inform answers when relevant.
Never use markdown, asterisks for bold, or any formatting — plain text only.
Do not add filler phrases like "Great question!" or "Of course!".
Write your COMPLETE answer. Do NOT stop mid-sentence.`
                        },
                        {
                            role: "user",
                            content: `Recent server chat:\n${recent}\n\nQuestion from ${username}: ${question}`
                        }
                    ];

                    // if finish_reason is length, continue asking until complete
                    while (keepGoing) {
                        const resp = await O.chat.completions.create({
                            model: "llama-3.1-8b-instant",
                            max_tokens: 1024,
                            messages
                        });

                        const choice = resp.choices?.[0];
                        const chunk = (choice?.message?.content || '')
                            .replace(/<think>[\s\S]*?<\/think>/g, '').trim();

                        fullOut += (fullOut ? ' ' : '') + chunk;
                        messages.push({ role: 'assistant', content: chunk });

                        if (choice?.finish_reason === 'length') {
                            messages.push({ role: 'user', content: 'Continue.' });
                        } else {
                            keepGoing = false;
                        }
                    }

                    for (const line of fullOut.split(/\n+/).map(l => l.trim()).filter(Boolean)) {
                        for (const chunk of smartSplit(line)) {
                            bot.chat(`> ${chunk}`);
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                } catch (e) {
                    console.log('[ASK ERROR]', e.message);
                    bot.chat('> AI error');
                }
                break;
            }

            case '$followup': {
                const fUser = parts[1]?.toLowerCase();
                const fText = parts.slice(2).join(' ');
                if (!fUser) return;
                if (fText.toLowerCase() === 'clear') {
                    delete followUps[fUser];
                    bot.chat(`> Follow-up cleared for ${fUser}`);
                } else if (fText) {
                    followUps[fUser] = { systemPrompt: fText, history: [] };
                    bot.chat(`> Follow-up set for ${fUser}`);
                }
                break;
            }

            case '$summon': {
                const n = parseInt(parts[1]);
                const sync = parts[2] === 'true';
                if (isNaN(n)) return;
                if (proxies.length === 0) { bot.chat('> No working proxies yet!'); return; }
                syncChat = sync;

                // Prioritize static/residential proxies first
                const staticOnes = proxies.filter(p =>
                    STATIC_PROXIES.find(s => s.ip === p.ip && s.port === p.port)
                );
                const dynamicOnes = proxies.filter(p =>
                    !STATIC_PROXIES.find(s => s.ip === p.ip && s.port === p.port)
                ).sort(() => Math.random() - 0.5);

                const pool = [...staticOnes, ...dynamicOnes];
                const picked = pool.slice(0, n);

                if (picked.length < n) {
                    bot.chat(`> Only ${picked.length} proxies available`);
                }

                let spawned = 0;
                for (const proxy of picked) {
                    if (await spawnBot(proxy)) spawned++;
                    await new Promise(r => setTimeout(r, 5000));
                }
                bot.chat(`> Summoned ${spawned}/${picked.length} bots | Proxies: ${proxies.length} | Sync: ${sync}`);
                break;
            }

            case '$unsummon':
                bots.forEach(b => { try { b.quit(); } catch {} });
                bots.length = 0;
                bot.chat('> Bots removed');
                break;

            case '$hunt':
                if (parts[1] === 'on') { huntMode = true; bot.chat('> Hunting ON'); }
                else if (parts[1] === 'off') {
                    huntMode = false;
                    try { bot.pvp.stop(); } catch {}
                    bot.pathfinder.setGoal(null);
                    bot.chat('> Hunting OFF');
                }
                break;

            case '$ignore': {
                const toggleUser = parts[1]?.toLowerCase();
                if (!toggleUser) return;
                if (ignoredUsers.has(toggleUser)) {
                    ignoredUsers.delete(toggleUser);
                    bot.chat(`> ${toggleUser} removed from admin list`);
                } else {
                    ignoredUsers.add(toggleUser);
                    bot.chat(`> ${toggleUser} added to admin list`);
                }
                break;
            }
        }
    });
}

/** ------------------- START ------------------- **/
startMainBot();
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
