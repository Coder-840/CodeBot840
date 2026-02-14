const mineflayer = require('mineflayer');
const authn = require('mineflayer-auto-auth');

const bot = mineflayer.createBot({
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8' // Forced to 1.8.8 as requested
});

// Load the auto-auth plugin with a secure password
bot.loadPlugin(authn);
bot.autoAuth.password = 'YourSecurePassword123'; 

bot.on('spawn', () => {
  console.log('CodeBot840 has spawned!');
  // Wait 3 seconds after spawning to ensure the server is ready for chat
  setTimeout(() => {
    bot.chat('Hello');
  }, 3000);
});

// Basic error handling to prevent the bot from crashing on Railway
bot.on('error', (err) => console.log('Error:', err));
bot.on('kicked', (reason) => console.log('Kicked:', reason));
