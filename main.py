from quarry.net.client import ClientFactory, ClientProtocol
from twisted.internet import reactor

# =========================
# HARD-CODED SETTINGS
# =========================
SERVER = "noBnoT.org"
PORT = 25565
USERNAME = "CodeBot840"


class Bot(ClientProtocol):

    def packet_system_chat_message(self, buff):
        msg = buff.unpack_chat().to_string()
        print("CHAT:", msg)

        if "hello" in msg.lower():
            self.send_chat("Hello 👋 I am a Python bot.")

        if "who" in msg.lower():
            self.send_chat("I am running on Railway 24/7.")

    def send_chat(self, message):
        self.send_packet("chat_message", self.buff_type.pack_string(message))


class BotFactory(ClientFactory):
    protocol = Bot


print("Starting bot...")
factory = BotFactory()
factory.connect(SERVER, PORT)
reactor.run()
