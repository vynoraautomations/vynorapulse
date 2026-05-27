import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.app.core.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()

db_url = settings.database_url
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {"check_same_thread": False, "timeout": 30} if db_url.startswith("sqlite") else {}
engine = create_engine(db_url, connect_args=connect_args)

from sqlalchemy import event
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if db_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
        except Exception:
            pass
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def upgrade_db_schema():
    with engine.connect() as conn:
        user_cols = [
            ("user_type", "VARCHAR(100) DEFAULT 'Engineering Students'"),
            ("user_mode", "VARCHAR(50) DEFAULT 'student'"),
            ("career_profile", "VARCHAR(255) DEFAULT 'AIML, Full Stack, Software Engineering'"),
            ("telegram_username", "VARCHAR(100) DEFAULT ''"),
            ("opportunities_tracked", "INTEGER DEFAULT 0"),
            ("applications_submitted", "INTEGER DEFAULT 0"),
            ("interviews_scheduled", "INTEGER DEFAULT 0"),
            ("responsiveness_score", "INTEGER DEFAULT 92"),
            ("spam_cleaned_count", "INTEGER DEFAULT 0"),
            ("selected_category", "VARCHAR(150) DEFAULT 'Engineering opportunities'"),
            ("subscription_plan", "VARCHAR(100) DEFAULT 'STUDENT BASIC — ₹29/month'"),
            ("approval_status", "VARCHAR(50) DEFAULT 'pending'"),
            ("payment_screenshot", "VARCHAR(500) DEFAULT ''"),
            ("is_admin", "BOOLEAN DEFAULT 0"),
            ("role", "VARCHAR(40) DEFAULT 'user'"),
            ("is_verified", "BOOLEAN DEFAULT 0"),
            ("last_login_at", "DATETIME"),
            ("interests", "VARCHAR(500) DEFAULT ''"),
            ("education_details", "VARCHAR(500) DEFAULT ''"),
            ("bio", "VARCHAR(500) DEFAULT ''"),
            ("avatar_url", "VARCHAR(500) DEFAULT ''"),
        ]
        for col, col_type in user_cols:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                logger.info(f"Added column {col} to users table.")
            except Exception:
                pass

        email_cols = [
            ("relevance_score", "INTEGER DEFAULT 92"),
            ("urgency", "VARCHAR(50) DEFAULT 'High'"),
            ("suggested_action", "VARCHAR(255) DEFAULT 'Review and apply within 24 hours.'"),
            ("opportunity_value", "VARCHAR(255) DEFAULT 'High Career Impact'"),
            ("company", "VARCHAR(255) DEFAULT 'Top Tech Partner'"),
            ("deadline", "DATETIME"),
            ("status", "VARCHAR(50) DEFAULT 'Pending'"),
            ("is_opened", "BOOLEAN DEFAULT 0"),
            ("is_ignored", "BOOLEAN DEFAULT 0"),
        ]
        for tbl in ["important_emails", "alerts"]:
            for col, col_type in email_cols:
                try:
                    conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_type}"))
                    logger.info(f"Added column {col} to {tbl} table.")
                except Exception:
                    pass
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
