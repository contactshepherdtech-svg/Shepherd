import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required. Set it to your Supabase Postgres connection string.")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

try:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    logger.info("Database connection established successfully.")
except Exception as error:
    logger.exception("Database connection failed.")
    raise RuntimeError("Failed to connect to the database. Verify DATABASE_URL and database availability.") from error

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    pco_id = Column(String, unique=True, index=True)
    name = Column(String)
    email = Column(String)
    status = Column(String)
    source = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    pco_checkin_id = Column(String, unique=True, index=True)
    member_pco_id = Column(String, index=True)
    attended_at = Column(DateTime)
    source = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    member_pco_id = Column(String, index=True)
    score = Column(Integer)
    tier = Column(String)
    reasons = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ChurchSettings(Base):
    __tablename__ = "church_settings"

    id = Column(Integer, primary_key=True, index=True)
    church_name = Column(String)
    main_service_frequency = Column(String)
    watch_missed_services = Column(Integer)
    at_risk_missed_services = Column(Integer)
    critical_missed_services = Column(Integer)
    small_groups_enabled = Column(Boolean)
    small_group_frequency = Column(String)
    volunteer_tracking_enabled = Column(Boolean)
    volunteer_importance = Column(String)
    giving_enabled = Column(Boolean)
    email_engagement_enabled = Column(Boolean)
    preferred_followup_style = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntegrationToken(Base):
    __tablename__ = "integration_tokens"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, unique=True, index=True)
    access_token = Column(String)
    refresh_token = Column(String)
    expires_at = Column(DateTime)
    scope = Column(String)
    connection_status = Column(String, default="connected")
    last_sync_at = Column(DateTime)
    members_imported = Column(Integer, default=0)
    attendance_imported = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema initialized successfully.")
    except Exception as error:
        logger.exception("Failed to initialize database schema.")
        raise RuntimeError("Unable to initialize database schema.") from error

    inspector = inspect(engine)
    column_names = {column["name"] for column in inspector.get_columns("members")}

    if "email" not in column_names:
        with engine.begin() as connection:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN email VARCHAR")
        logger.info("Added missing members.email column.")

    integration_columns = {
        column["name"] for column in inspector.get_columns("integration_tokens")
    }
    with engine.begin() as connection:
        if "connection_status" not in integration_columns:
            connection.exec_driver_sql(
                "ALTER TABLE integration_tokens ADD COLUMN connection_status VARCHAR"
            )
        if "last_sync_at" not in integration_columns:
            connection.exec_driver_sql(
                "ALTER TABLE integration_tokens ADD COLUMN last_sync_at TIMESTAMP"
            )
        if "members_imported" not in integration_columns:
            connection.exec_driver_sql(
                "ALTER TABLE integration_tokens ADD COLUMN members_imported INTEGER"
            )
        if "attendance_imported" not in integration_columns:
            connection.exec_driver_sql(
                "ALTER TABLE integration_tokens ADD COLUMN attendance_imported INTEGER"
            )

    db = SessionLocal()
    try:
        existing_settings = db.query(ChurchSettings).first()
        if existing_settings is None:
            db.add(
                ChurchSettings(
                    church_name="Shepherd Demo Church",
                    main_service_frequency="weekly",
                    watch_missed_services=2,
                    at_risk_missed_services=4,
                    critical_missed_services=6,
                    small_groups_enabled=False,
                    small_group_frequency="weekly",
                    volunteer_tracking_enabled=False,
                    volunteer_importance="medium",
                    giving_enabled=False,
                    email_engagement_enabled=False,
                    preferred_followup_style="soft and friendly",
                )
            )
            db.commit()
            logger.info("Default church settings created.")
    finally:
        db.close()
