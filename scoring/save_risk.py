from datetime import datetime

from data.schema import SessionLocal, Member, Attendance, RiskScore, ChurchSettings, init_db
from scoring.churn import calculate_risk


def save_risk_scores():
    init_db()
    db = SessionLocal()

    try:
        church_settings = db.query(ChurchSettings).first()
        members = db.query(Member).all()

        for member in members:
            attendance_records = (
                db.query(Attendance)
                .filter(Attendance.member_pco_id == member.pco_id)
                .all()
            )

            risk = calculate_risk(member, attendance_records, church_settings=church_settings)
            reasons_text = ", ".join(risk["reasons"])

            existing_risk = (
                db.query(RiskScore)
                .filter(RiskScore.member_pco_id == member.pco_id)
                .first()
            )

            if existing_risk:
                existing_risk.score = risk["score"]
                existing_risk.tier = risk["tier"]
                existing_risk.reasons = reasons_text
                existing_risk.updated_at = datetime.utcnow()
            else:
                db.add(
                    RiskScore(
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
