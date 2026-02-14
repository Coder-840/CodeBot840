from quarry.net.client import ClientFactory, ClientProtocol
from quarry.net.auth import OfflineProfile
from twisted.internet import reactor
import time

# =========================
# HARD-CODED SETTINGS
# =========================
SERVER = "noBnoT.org"
PORT = 25565
USERNAME = "codeBot840"
PASSWORD = "BotPassword123"  # change to whatever you want


# =========================
# BOT CLASS
# =========================
class Bot(ClientProtocol):

    def connection_made(self):
        print("[*] Connected to server.")

    def connection_lost(self, reason):
        print("[*] Disconnected:", reason)
        reactor.stop()

    def packet_system_chat_message(self, buff):
        msg = buff.unpack_chat().to_string()
        print("[CHAT]", msg)

        lower = msg.lower()

        # Auto-register if needed
        if "register" in lower:
            print("[*] Registering...")
            self.send_chat(f"/register {PASSWORD} {PASSWORD}")
            time.sleep(0.5)

        # Auto-login if needed
        elif "login" in lower:
            print("[*] Logging in...")
            self.send_chat(f"/login {PASSWORD}")
            time.sleep(0.5)

        # Normal chat response
        elif "hello" in lower:
            self.send_chat("Hello 👋 I am a Python bot.")

    def send_chat(self, message):
        self.send_packet("chat_message", self.buff_type.pack_string(message))


# =========================
# FACTORY + CONNECTION
# =========================
profile = OfflineProfile(USERNAME)
factory = ClientFactory(profile)
factory.protocol = Bot

print("[*] Starting bot...")
factory.connect(SERVER, PORT)
reactor.run()
