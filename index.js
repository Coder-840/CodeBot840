const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'noBnoT.org',
  port: 25565,
  username: 'CodeBot840',
  version: '1.8.8'
});

const PASSWORD = 'YourSecurePassword123';

bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Don't reply to self

  const msg = message.toLowerCase();
  
  // Basic Auto-Auth Logic
  if (msg.includes('/register')) {
    bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
  } else if (msg.includes('/login')) {
    bot.chat(`/login ${PASSWORD}`);
  }
});

// Handle messages sent by the server (Action Bars/System Messages)
bot.on('messagestr', (message) => {
  console.log('Server:', message);
  if (message.includes('/register')) {
    bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
  } else if (message.includes('/login')) {
    bot.chat(`/login ${PASSWORD}`);
  }
});

bot.on('spawn', () => {
  console.log('CodeBot840 spawned!');
  // Wait 5 seconds to ensure we are logged in before saying Hello
  setTimeout(() => {
    bot.chat('Hello');
  }, 5000);
});

// Keep-alive and error handling
bot.on('error', (err) => console.log('Error:', err));
bot.on('kicked', (reason) => console.log('Kicked:', reason));
