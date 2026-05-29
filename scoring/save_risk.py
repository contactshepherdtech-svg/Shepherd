from datetime import datetime

from data.schema import (
    Attendance,
    ChurchSettings,
    Member,
    RiskScore,
    SessionLocal,
    get_or_create_default_church,
    init_db,
)
from scoring.churn import calculate_risk


def save_risk_scores():
    init_db()
    db = SessionLocal()

    try:
        active_church = get_or_create_default_church(db)
        church_settings = (
            db.query(ChurchSettings)
            .filter(ChurchSettings.church_id == active_church.id)
            .first()
        )
        if church_settings is None:
            church_settings = (
                db.query(ChurchSettings)
                .filter(ChurchSettings.church_id.is_(None))
                .first()
            )
            if church_settings is not None:
                church_settings.church_id = active_church.id
                db.commit()
        members = db.query(Member).filter(Member.church_id == active_church.id).all()

        for member in members:
            attendance_records = (
                db.query(Attendance)
                .filter(
                    Attendance.church_id == active_church.id,
                    Attendance.member_pco_id == member.pco_id,
                )
                .all()
            )

            risk = calculate_risk(member, attendance_records, church_settings=church_settings)
            reasons_text = ", ".join(risk["reasons"])

            existing_risk = (
                db.query(RiskScore)
                .filter(
                    RiskScore.church_id == active_church.id,
                    RiskScore.member_pco_id == member.pco_id,
                )
                .first()
            )
            if existing_risk is None:
                existing_risk = (
                    db.query(RiskScore)
                    .filter(
                        RiskScore.church_id.is_(None),
                        RiskScore.member_pco_id == member.pco_id,
                    )
                    .first()
                )

            if existing_risk:
                existing_risk.church_id = active_church.id
                existing_risk.score = risk["score"]
                existing_risk.tier = risk["tier"]
                existing_risk.reasons = reasons_text
                existing_risk.updated_at = datetime.utcnow()
            else:
                db.add(
                    RiskScore(
                        church_id=active_church.id,
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
