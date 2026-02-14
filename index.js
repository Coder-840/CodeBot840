const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
};

const PASSWORD = 'YourSecurePassword123';

function startBot() {
  const bot = mineflayer.createBot(botArgs);
  
  // Load Pathfinder for $goto
  bot.loadPlugin(pathfinder);

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const args = message.split(' ');
    const command = args[0].toLowerCase();

    // 1. $help
    if (command === '$help') {
      bot.chat('Commands: $coords, $repeat [msg] [count], $goto [x] [y] [z]');
    }

    // 2. $coords
    else if (command === '$coords') {
      const p = bot.entity.position;
      bot.chat(`X: ${Math.round(p.x)} Y: ${Math.round(p.y)} Z: ${Math.round(p.z)}`);
    }

    // 3. $repeat <msg> <count>
    else if (command === '$repeat') {
      const count = parseInt(args[args.length - 1]);
      const repeatMsg = args.slice(1, -1).join(' ');
      if (isNaN(count) || !repeatMsg) return bot.chat('Usage: $repeat hello 3');
      
      let i = 0;
      const interval = setInterval(() => {
        bot.chat(repeatMsg);
        i++;
        if (i >= Math.min(count, 10)) clearInterval(interval); // Limit to 10 to avoid spam kick
      }, 1000);
    }

    // 4. $goto <x> <y> <z>
    else if (command === '$goto') {
      const x = parseInt(args[1]);
      const y = parseInt(args[2]);
      const z = parseInt(args[3]);

      if (isNaN(x) || isNaN(y) || isNaN(z)) return bot.chat('Usage: $goto 100 64 100');

      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      
      // Skill: This tells the bot it is allowed to break blocks to get there
      defaultMove.canDig = true; 
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
      bot.chat(`Heading to ${x}, ${y}, ${z}. I will mine blocks if needed!`);
    }
  });

  // Auth & Auto-Reconnect
  bot.on('messagestr', (m) => {
    if (m.includes('/register')) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (m.includes('/login')) bot.chat(`/login ${PASSWORD}`);
  });
  bot.on('kicked', () => setTimeout(startBot, 10000));
  bot.on('error', () => setTimeout(startBot, 10000));
}

startBot();
