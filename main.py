import os
from quarry.net.client import ClientFactory, ClientProtocol
from twisted.internet import reactor

SERVER = os.getenv("MC_SERVER")
PORT = int(os.getenv("MC_PORT", 25565))
USERNAME = os.getenv("MC_USERNAME", "RailwayBot")

class Bot(ClientProtocol):

    def packet_system_chat_message(self, buff):
        msg = buff.unpack_chat().to_string()
        print("CHAT:", msg)

        if "hello" in msg.lower():
            self.send_chat("Hello from Railway 👋")

        if "who" in msg.lower():
            self.send_chat("I'm a Python bot running 24/7.")

    def send_chat(self, message):
        self.send_packet("chat_message", self.buff_type.pack_string(message))


class BotFactory(ClientFactory):
    protocol = Bot


print("Starting bot...")
factory = BotFactory()
factory.connect(SERVER, PORT)
reactor.run()
