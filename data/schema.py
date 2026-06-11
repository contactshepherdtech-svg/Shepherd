import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, UniqueConstraint, inspect, text
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


class Church(Base):
    __tablename__ = "churches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    planning_center_org_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (UniqueConstraint("church_id", "pco_id", name="uq_members_church_pco_id"),)

    id = Column(Integer, primary_key=True, index=True)
    church_id = Column(Integer, index=True)
    pco_id = Column(String, index=True)
    name = Column(String)
    email = Column(String)
    status = Column(String)
    source = Column(String)
    pco_created_at = Column(DateTime)
    first_visit_date = Column(DateTime)
    visitor_status = Column(String, default="none")
    member_lifecycle = Column(String)
    last_followup_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("church_id", "pco_checkin_id", name="uq_attendance_church_pco_checkin"),)

    id = Column(Integer, primary_key=True, index=True)
    church_id = Column(Integer, index=True)
    pco_checkin_id = Column(String, index=True)
    member_pco_id = Column(String, index=True)
    attended_at = Column(DateTime)
    source = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    church_id = Column(Integer, index=True)
    member_pco_id = Column(String, index=True)
    score = Column(Integer)
    tier = Column(String)
    reasons = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ChurchSettings(Base):
    __tablename__ = "church_settings"

    id = Column(Integer, primary_key=True, index=True)
    church_id = Column(Integer, index=True)
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
    __table_args__ = (UniqueConstraint("church_id", "provider", name="uq_integration_tokens_church_provider"),)

    id = Column(Integer, primary_key=True, index=True)
    church_id = Column(Integer, index=True)
    provider = Column(String, index=True)
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


def get_or_create_default_church(db):
    default_name = "Shepherd Demo Church"
    church = db.query(Church).filter(Church.name == default_name).first()
    if church is None:
        church = Church(name=default_name)
        db.add(church)
        db.commit()
        db.refresh(church)
    return church


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema initialized successfully.")
    except Exception as error:
        logger.exception("Failed to initialize database schema.")
        raise RuntimeError("Unable to initialize database schema.") from error

    inspector = inspect(engine)
    member_columns = {column["name"] for column in inspector.get_columns("members")}
    attendance_columns = {column["name"] for column in inspector.get_columns("attendance")}
    risk_columns = {column["name"] for column in inspector.get_columns("risk_scores")}
    settings_columns = {column["name"] for column in inspector.get_columns("church_settings")}
    integration_columns = {column["name"] for column in inspector.get_columns("integration_tokens")}
    church_columns = {column["name"] for column in inspector.get_columns("churches")}

    with engine.begin() as connection:
        if "email" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN email VARCHAR")
            logger.info("Added missing members.email column.")
        if "church_id" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN church_id INTEGER")
        if "pco_created_at" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN pco_created_at TIMESTAMPTZ")
            logger.info("Added missing members.pco_created_at column.")
        if "first_visit_date" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN first_visit_date TIMESTAMPTZ")
            logger.info("Added missing members.first_visit_date column.")
        if "visitor_status" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN visitor_status TEXT DEFAULT 'none'")
            logger.info("Added missing members.visitor_status column.")
        if "member_lifecycle" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN member_lifecycle TEXT")
            logger.info("Added missing members.member_lifecycle column.")
        if "last_followup_at" not in member_columns:
            connection.exec_driver_sql("ALTER TABLE members ADD COLUMN last_followup_at TIMESTAMPTZ")
            logger.info("Added missing members.last_followup_at column.")
        connection.exec_driver_sql("UPDATE members SET visitor_status = 'none' WHERE visitor_status IS NULL")
        if "church_id" not in attendance_columns:
            connection.exec_driver_sql("ALTER TABLE attendance ADD COLUMN church_id INTEGER")
        if "church_id" not in risk_columns:
            connection.exec_driver_sql("ALTER TABLE risk_scores ADD COLUMN church_id INTEGER")
        if "church_id" not in settings_columns:
            connection.exec_driver_sql("ALTER TABLE church_settings ADD COLUMN church_id INTEGER")
        if "church_id" not in integration_columns:
            connection.exec_driver_sql("ALTER TABLE integration_tokens ADD COLUMN church_id INTEGER")
        if "connection_status" not in integration_columns:
            connection.exec_driver_sql("ALTER TABLE integration_tokens ADD COLUMN connection_status VARCHAR")
        if "last_sync_at" not in integration_columns:
            connection.exec_driver_sql("ALTER TABLE integration_tokens ADD COLUMN last_sync_at TIMESTAMP")
        if "members_imported" not in integration_columns:
            connection.exec_driver_sql("ALTER TABLE integration_tokens ADD COLUMN members_imported INTEGER")
        if "attendance_imported" not in integration_columns:
            connection.exec_driver_sql("ALTER TABLE integration_tokens ADD COLUMN attendance_imported INTEGER")
        if "planning_center_org_id" not in church_columns:
            connection.exec_driver_sql("ALTER TABLE churches ADD COLUMN planning_center_org_id VARCHAR")

    if os.getenv("SHEPHERD_ACTIVE_CHURCH_ID"):
        logger.info(
            "SHEPHERD_ACTIVE_CHURCH_ID is set; skipping default church setup and backfill."
        )
        return

    db = SessionLocal()
    try:
        default_church = get_or_create_default_church(db)

        existing_settings = (
            db.query(ChurchSettings)
            .filter(ChurchSettings.church_id == default_church.id)
            .first()
        )
        if existing_settings is None:
            existing_settings = (
                db.query(ChurchSettings)
                .filter(ChurchSettings.church_id.is_(None))
                .first()
            )
            if existing_settings is not None:
                existing_settings.church_id = default_church.id
                db.commit()
        if existing_settings is None:
            db.add(
                ChurchSettings(
                    church_id=default_church.id,
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

        db.query(Member).filter(Member.church_id.is_(None)).update(
            {Member.church_id: default_church.id},
            synchronize_session=False,
        )
        db.query(Attendance).filter(Attendance.church_id.is_(None)).update(
            {Attendance.church_id: default_church.id},
            synchronize_session=False,
        )
        db.query(RiskScore).filter(RiskScore.church_id.is_(None)).update(
            {RiskScore.church_id: default_church.id},
            synchronize_session=False,
        )
        db.query(ChurchSettings).filter(ChurchSettings.church_id.is_(None)).update(
            {ChurchSettings.church_id: default_church.id},
            synchronize_session=False,
        )
        db.query(IntegrationToken).filter(IntegrationToken.church_id.is_(None)).update(
            {IntegrationToken.church_id: default_church.id},
            synchronize_session=False,
        )
        db.commit()
    finally:
        db.close()
