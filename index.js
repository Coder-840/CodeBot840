const mineflayer = require('mineflayer');
const authn = require('mineflayer-auto-auth');

const bot = mineflayer.createBot({
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
});

// Pass the configuration object directly here
bot.loadPlugin(authn({
  password: 'YourSecurePassword123',
  ignoreRepeat: true,
  logging: true
}));

bot.on('spawn', () => {
  console.log('CodeBot840 spawned successfully!');
  // Wait a few seconds for the auth process to finish before talking
  setTimeout(() => {
    bot.chat('Hello');
  }, 5000);
});

bot.on('error', (err) => console.log('Bot Error:', err));
bot.on('kicked', (reason) => console.log('Bot Kicked:', reason));
