const mineflayer = require('mineflayer');

const botArgs = {
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
};

const PASSWORD = 'YourSecurePassword123';

function startBot() {
  const bot = mineflayer.createBot(botArgs);

  // Reconnect logic: if kicked or errored, wait 10 seconds and try again
  bot.on('kicked', (reason) => {
    console.log(`Kicked for: ${reason}. Reconnecting in 10s...`);
    setTimeout(startBot, 10000);
  });

  bot.on('error', (err) => {
    console.log(`Error: ${err}. Reconnecting in 10s...`);
    setTimeout(startBot, 10000);
  });

  bot.on('messagestr', (message) => {
    console.log('Server:', message);
    if (message.includes('/register')) {
      bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    } else if (message.includes('/login')) {
      bot.chat(`/login ${PASSWORD}`);
    }
  });

  bot.on('spawn', () => {
    console.log('CodeBot840 is in!');
    setTimeout(() => bot.chat('Hello'), 5000);
  });
}

// Start the initial connection
startBot();
