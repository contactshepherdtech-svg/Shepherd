from data.schema import SessionLocal, Member, Attendance, init_db
from scoring.churn import calculate_risk

init_db()
db = SessionLocal()

members = db.query(Member).all()

for member in members:
    attendance_records = (
        db.query(Attendance)
        .filter(Attendance.member_pco_id == member.pco_id)
        .all()
    )
    risk = calculate_risk(member, attendance_records)

    print("\nMember name:", member.name)
    print("Total attendance records:", len(attendance_records))
    print("Score:", risk["score"])
    print("Tier:", risk["tier"])
    print("Breakdown:", risk["breakdown"])
    print("Reasons:", risk["reasons"])

db.close()
