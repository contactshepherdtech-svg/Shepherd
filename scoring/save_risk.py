import os
from datetime import datetime

from data.schema import (
    Attendance,
    Church,
    ChurchSettings,
    Member,
    RiskScore,
    SessionLocal,
    get_or_create_default_church,
    init_db,
)
from scoring.churn import calculate_risk


def _active_church_id_from_env():
    raw_church_id = os.getenv("SHEPHERD_ACTIVE_CHURCH_ID")
    if not raw_church_id:
        return None

    try:
        church_id = int(raw_church_id)
    except ValueError as error:
        raise RuntimeError(
            f"Invalid SHEPHERD_ACTIVE_CHURCH_ID={raw_church_id!r}."
        ) from error

    if church_id <= 0:
        raise RuntimeError(
            f"Invalid SHEPHERD_ACTIVE_CHURCH_ID={raw_church_id!r}."
        )

    return church_id


def _get_active_church_id(db):
    env_church_id = _active_church_id_from_env()
    if env_church_id is not None:
        church = db.query(Church).filter(Church.id == env_church_id).first()
        if church is None:
            raise RuntimeError(f"Active church not found for church_id={env_church_id}.")
        print(f"Active church_id: {env_church_id}")
        return env_church_id

    default_church = get_or_create_default_church(db)
    print(f"Active church_id: {default_church.id}")
    return default_church.id


def save_risk_scores():
    init_db()
    db = SessionLocal()

    try:
        active_church_id = _get_active_church_id(db)
        authenticated_sync = _active_church_id_from_env() is not None
        church_settings = (
            db.query(ChurchSettings)
            .filter(ChurchSettings.church_id == active_church_id)
            .first()
        )
        if church_settings is None and not authenticated_sync:
            church_settings = (
                db.query(ChurchSettings)
                .filter(ChurchSettings.church_id.is_(None))
                .first()
            )
            if church_settings is not None:
                church_settings.church_id = active_church_id
                db.commit()
        members = db.query(Member).filter(Member.church_id == active_church_id).all()
        print(f"Risk scoring members count: {len(members)}")

        for member in members:
            attendance_records = (
                db.query(Attendance)
                .filter(
                    Attendance.church_id == active_church_id,
                    Attendance.member_pco_id == member.pco_id,
                )
                .all()
            )

            risk = calculate_risk(member, attendance_records, church_settings=church_settings)
            reasons_text = ", ".join(risk["reasons"])

            existing_risk = (
                db.query(RiskScore)
                .filter(
                    RiskScore.church_id == active_church_id,
                    RiskScore.member_pco_id == member.pco_id,
                )
                .first()
            )
            if existing_risk is None and not authenticated_sync:
                existing_risk = (
                    db.query(RiskScore)
                    .filter(
                        RiskScore.church_id.is_(None),
                        RiskScore.member_pco_id == member.pco_id,
                    )
                    .first()
                )

            if existing_risk:
                existing_risk.church_id = active_church_id
                existing_risk.score = risk["score"]
                existing_risk.tier = risk["tier"]
                existing_risk.reasons = reasons_text
                existing_risk.updated_at = datetime.utcnow()
            else:
                db.add(
                    RiskScore(
                        church_id=active_church_id,
                        member_pco_id=member.pco_id,
                        score=risk["score"],
                        tier=risk["tier"],
                        reasons=reasons_text,
                    )
                )

            print(f"Member: {member.name}")
            print(f"Score: {risk['score']}")
            print(f"Tier: {risk['tier']}")
            print(f"Reasons: {reasons_text}")
            print("Saved to database")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    save_risk_scores()
