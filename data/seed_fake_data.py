from datetime import datetime, timedelta
from random import Random
from uuid import uuid4

from data.schema import SessionLocal, init_db, Member, Attendance


FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph",
    "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Daniel", "Nancy", "Matthew",
    "Lisa", "Anthony", "Betty", "Mark", "Dorothy", "Paul", "Sandra"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Walker"
]

GROUPS = [
    ("healthy", 15),
    ("watch", 15),
    ("at_risk", 10),
    ("critical", 10),
]


def get_attendance_dates(pattern, now):
    recent_weeks = [now - timedelta(days=days) for days in (4, 11, 18, 25)]
    previous_weeks = [now - timedelta(days=days) for days in (32, 39, 46, 53)]

    if pattern == "healthy":
        return previous_weeks + recent_weeks
    if pattern == "watch":
        return previous_weeks + recent_weeks[:3]
    if pattern == "at_risk":
        return previous_weeks + recent_weeks[:2]

    return [now - timedelta(days=63), now - timedelta(days=70)]


def get_next_fake_ids(existing_ids, total_needed):
    fake_ids = []
    sequence = 1

    while len(fake_ids) < total_needed:
        candidate_id = f"fake_member_{sequence:04d}"
        if candidate_id not in existing_ids:
            fake_ids.append(candidate_id)
        sequence += 1

    return fake_ids


def seed_fake_data():
    init_db()
    db = SessionLocal()
    rng = Random(42)
    now = datetime.utcnow().replace(second=0, microsecond=0)

    created_members = 0
    created_attendance = 0

    try:
        existing_member_ids = {pco_id for (pco_id,) in db.query(Member.pco_id).all()}
        fake_ids = get_next_fake_ids(existing_member_ids, 50)
        fake_id_index = 0

        for group_name, group_size in GROUPS:
            for _ in range(group_size):
                pco_id = fake_ids[fake_id_index]
                fake_id_index += 1

                first_name = rng.choice(FIRST_NAMES)
                last_name = rng.choice(LAST_NAMES)
                name = f"{first_name} {last_name}"

                member = Member(
                    pco_id=pco_id,
                    name=name,
                    status="active",
                    source="planning_center",
                )
                db.add(member)
                created_members += 1

                attendance_dates = get_attendance_dates(group_name, now)
                for base_date in attendance_dates:
                    attended_at = base_date.replace(
                        hour=rng.randint(8, 19),
                        minute=rng.randint(0, 59),
                    )
                    attendance = Attendance(
                        pco_checkin_id=f"fake_checkin_{uuid4().hex}",
                        member_pco_id=pco_id,
                        attended_at=attended_at,
                        source="planning_center",
                    )
                    db.add(attendance)
                    created_attendance += 1

        db.commit()
        print(f"Created {created_members} members")
        print(f"Created {created_attendance} attendance records")
    finally:
        db.close()


if __name__ == "__main__":
    seed_fake_data()
