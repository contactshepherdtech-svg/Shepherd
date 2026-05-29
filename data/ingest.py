from datetime import datetime, timezone

from data.schema import (
    Attendance,
    IntegrationToken,
    Member,
    SessionLocal,
    get_or_create_default_church,
    init_db,
)
from utils.planning_center import get_people, get_checkins


def parse_pco_datetime(timestamp):
    if not timestamp:
        return None

    if isinstance(timestamp, datetime):
        parsed = timestamp
    else:
        raw_value = str(timestamp).strip()
        if raw_value.endswith("Z"):
            raw_value = raw_value[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(raw_value)
        except ValueError:
            return None

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)

    return parsed


def _get_or_create_planning_center_token(db, church_id):
    token = (
        db.query(IntegrationToken)
        .filter(
            IntegrationToken.provider == "planning_center",
            IntegrationToken.church_id == church_id,
        )
        .first()
    )
    if token is None:
        token = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id.is_(None),
            )
            .first()
        )
    if token is None:
        token = (
            db.query(IntegrationToken)
            .filter(IntegrationToken.provider == "planning_center")
            .first()
        )
    if token is None:
        token = IntegrationToken(
            provider="planning_center",
            church_id=church_id,
        )
        db.add(token)

    token.church_id = church_id
    return token


def save_people():
    init_db()
    db = SessionLocal()

    try:
        active_church = get_or_create_default_church(db)
        token = _get_or_create_planning_center_token(db, active_church.id)

        people = get_people(10)
        checkins = get_checkins(25)

        print(f"Pulled {len(people)} people from Planning Center")
        print(f"Pulled {len(checkins)} check-ins from Planning Center")

        unique_people = {}
        for person in people:
            pco_id = person.get("pco_id")
            if pco_id:
                unique_people[pco_id] = person

        people_to_import = list(unique_people.values())

        saved_members_count = 0
        saved_attendance_count = 0
        emails_found_count = 0

        for person in people_to_import:
            existing_member = (
                db.query(Member)
                .filter(
                    Member.church_id == active_church.id,
                    Member.pco_id == person["pco_id"],
                )
                .first()
            )
            if existing_member is None:
                existing_member = (
                    db.query(Member)
                    .filter(
                        Member.church_id.is_(None),
                        Member.pco_id == person["pco_id"],
                    )
                    .first()
                )

            if existing_member:
                existing_member.church_id = active_church.id
                existing_member.name = person["name"]
                existing_member.email = person.get("email")
                existing_member.status = person["status"]
                existing_member.source = "planning_center"
            else:
                db.add(
                    Member(
                        church_id=active_church.id,
                        pco_id=person["pco_id"],
                        name=person["name"],
                        email=person.get("email"),
                        status=person["status"],
                        source="planning_center",
                    )
                )

            saved_members_count += 1
            if person.get("email"):
                emails_found_count += 1

        for checkin in checkins:
            pco_checkin_id = checkin.get("pco_checkin_id")
            if not pco_checkin_id:
                continue

            existing_checkin = (
                db.query(Attendance)
                .filter(
                    Attendance.church_id == active_church.id,
                    Attendance.pco_checkin_id == pco_checkin_id,
                )
                .first()
            )
            if existing_checkin is None:
                existing_checkin = (
                    db.query(Attendance)
                    .filter(
                        Attendance.church_id.is_(None),
                        Attendance.pco_checkin_id == pco_checkin_id,
                    )
                    .first()
                )

            if existing_checkin:
                existing_checkin.church_id = active_church.id
                continue

            db.add(
                Attendance(
                    church_id=active_church.id,
                    pco_checkin_id=pco_checkin_id,
                    member_pco_id=checkin.get("member_pco_id"),
                    attended_at=parse_pco_datetime(checkin.get("attended_at")),
                    source="planning_center",
                )
            )
            saved_attendance_count += 1

        token.connection_status = "connected"
        token.last_sync_at = datetime.utcnow()
        token.members_imported = saved_members_count
        token.attendance_imported = saved_attendance_count
        token.updated_at = datetime.utcnow()

        db.commit()

        print(f"Saved {saved_members_count} members")
        print(f"Saved {saved_attendance_count} attendance records")
        print(f"Members imported: {saved_members_count}")
        print(f"Emails found: {emails_found_count}")
        print(f"Missing emails: {saved_members_count - emails_found_count}")
    except Exception:
        db.rollback()
        try:
            active_church = get_or_create_default_church(db)
            token = _get_or_create_planning_center_token(db, active_church.id)
            token.connection_status = "error"
            token.updated_at = datetime.utcnow()
            db.commit()
        except Exception:
            db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    save_people()
