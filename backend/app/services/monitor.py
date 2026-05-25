import asyncio
import logging

from backend.app.core.config import get_settings
from backend.app.db.session import SessionLocal
from backend.app.models import User
from backend.app.services.gmail_service import GmailService

logger = logging.getLogger(__name__)


class MailMonitor:
    def __init__(self):
        self.settings = get_settings()
        self.running = False
        self.task: asyncio.Task | None = None
        self.gmail = GmailService()

    def start(self):
        if self.task and not self.task.done():
            return
        self.running = True
        self.task = asyncio.create_task(self._loop())

    def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()

    async def _loop(self):
        # Allow Uvicorn to fully bind port 8000 and start serving requests first
        await asyncio.sleep(5.0)
        while self.running:
            # 1. Fetch user list quickly in a short-lived session
            users = []
            db = SessionLocal()
            try:
                users = db.query(User).all()
            except Exception as exc:
                logger.exception("Failed to query users list for mailbox polling: %s", exc)
            finally:
                db.close()

            # 2. Loop over users and poll each one using a dedicated session
            for user in users:
                if not self.running:
                    break
                user_db = SessionLocal()
                try:
                    # Reload user in this session context to be attached properly
                    loaded_user = user_db.query(User).filter(User.id == user.id).first()
                    if loaded_user:
                        await self.gmail.poll_user_mailbox(user_db, loaded_user)
                except Exception as exc:
                    logger.exception("Mailbox polling failed for user %s: %s", user.id, exc)
                finally:
                    user_db.close()

            await asyncio.sleep(self.settings.poll_interval_seconds)


monitor = MailMonitor()
