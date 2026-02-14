import lodestone
import time

bot = lodestone.createBot(
    host='noBnoT.org',
    username='CodeBot840',
    version='1.8.8',
    auth='offline'
)

@bot.on('spawn')
def handle_spawn(*args):
    print("CodeBot840 successfully connected to noBnoT.org")
    time.sleep(2)
    bot.chat('/register P@ssword123 P@ssword123')
    bot.chat('/login P@ssword123')
    time.sleep(1)
    bot.chat('Hello! CodeBot840 is online via Railway.')

@bot.on('chat')
def handle_chat(this, user, message, *args):
    if user == bot.username: return
    print(f"Chat from {user}: {message}")
