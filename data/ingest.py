import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from data.schema import (
    Attendance,
    Church,
    IntegrationToken,
    Member,
    SessionLocal,
    get_or_create_default_church,
    init_db,
)
from utils.planning_center import get_people, get_checkins


VISITOR_STATUS_FIRST_TIME = "first_time"
VISITOR_STATUS_RETURNED = "returned"
VISITOR_STATUS_CONVERTED = "converted"
VISITOR_STATUS_NONE = "none"

MEMBER_LIFECYCLE_NEW_NO_ATTENDANCE = "new_no_attendance"
MEMBER_LIFECYCLE_FIRST_TIME_VISITOR = "first_time_visitor"
MEMBER_LIFECYCLE_RETURNED_VISITOR = "returned_visitor"
MEMBER_LIFECYCLE_ESTABLISHED_MEMBER = "established_member"
MEMBER_LIFECYCLE_NEEDS_FIRST_FOLLOWUP = "needs_first_followup"


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
    authenticated_sync = _active_church_id_from_env() is not None
    token = (
        db.query(IntegrationToken)
        .filter(
            IntegrationToken.provider == "planning_center",
            IntegrationToken.church_id == church_id,
        )
        .first()
    )
    if token is None and not authenticated_sync:
        token = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id.is_(None),
            )
            .first()
        )
    if token is None and not authenticated_sync:
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


def _attendance_summary(db, church_id, member_pco_id):
    if not member_pco_id:
        return 0, None

    attendance_count, first_visit_date = (
        db.query(func.count(Attendance.id), func.min(Attendance.attended_at))
        .filter(
            Attendance.church_id == church_id,
            Attendance.member_pco_id == member_pco_id,
            Attendance.attended_at.isnot(None),
        )
        .one()
    )

    return int(attendance_count or 0), first_visit_date


def _is_recent_pco_person(pco_created_at, now):
    if pco_created_at is None:
        return False

    if pco_created_at.tzinfo is not None:
        pco_created_at = pco_created_at.astimezone(timezone.utc).replace(tzinfo=None)

    return pco_created_at >= now - timedelta(days=14)


def _apply_member_lifecycle(member, attendance_count, first_visit_date, now=None):
    now = now or datetime.utcnow()

    if attendance_count <= 0:
        member.first_visit_date = None
        member.visitor_status = VISITOR_STATUS_NONE
        member.member_lifecycle = (
            MEMBER_LIFECYCLE_NEW_NO_ATTENDANCE
            if _is_recent_pco_person(member.pco_created_at, now)
            else MEMBER_LIFECYCLE_NEEDS_FIRST_FOLLOWUP
        )
        return

    member.first_visit_date = first_visit_date

    if attendance_count == 1:
        member.visitor_status = VISITOR_STATUS_FIRST_TIME
        member.member_lifecycle = MEMBER_LIFECYCLE_FIRST_TIME_VISITOR
        return

    if attendance_count == 2:
        member.visitor_status = VISITOR_STATUS_RETURNED
        member.member_lifecycle = MEMBER_LIFECYCLE_RETURNED_VISITOR
        return

    member.visitor_status = VISITOR_STATUS_CONVERTED
    member.member_lifecycle = MEMBER_LIFECYCLE_ESTABLISHED_MEMBER


def _classify_member_lifecycles(db, church_id):
    now = datetime.utcnow()
    members = (
        db.query(Member)
        .filter(
            Member.church_id == church_id,
            Member.source == "planning_center",
        )
        .all()
    )

    for member in members:
        attendance_count, first_visit_date = _attendance_summary(
            db,
            church_id,
            member.pco_id,
        )
        _apply_member_lifecycle(member, attendance_count, first_visit_date, now=now)

    return len(members)


def save_people():
    init_db()
    db = SessionLocal()
    active_church_id = None
    authenticated_sync = _active_church_id_from_env() is not None

    try:
        active_church_id = _get_active_church_id(db)

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
            parsed_pco_created_at = parse_pco_datetime(person.get("pco_created_at"))
            existing_member = (
                db.query(Member)
                .filter(
                    Member.church_id == active_church_id,
                    Member.pco_id == person["pco_id"],
                )
                .first()
            )
            if existing_member is None and not authenticated_sync:
                existing_member = (
                    db.query(Member)
                    .filter(
                        Member.church_id.is_(None),
                        Member.pco_id == person["pco_id"],
                    )
                    .first()
                )

            if existing_member:
                existing_member.church_id = active_church_id
                existing_member.name = person["name"]
                existing_member.email = person.get("email")
                existing_member.status = person["status"]
                existing_member.source = "planning_center"
                if parsed_pco_created_at is not None:
                    existing_member.pco_created_at = parsed_pco_created_at
            else:
                existing_member = Member(
                    church_id=active_church_id,
                    pco_id=person["pco_id"],
                    name=person["name"],
                    email=person.get("email"),
                    status=person["status"],
                    source="planning_center",
                    pco_created_at=parsed_pco_created_at,
                )
                db.add(existing_member)

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
                    Attendance.church_id == active_church_id,
                    Attendance.pco_checkin_id == pco_checkin_id,
                )
                .first()
            )
            if existing_checkin is None and not authenticated_sync:
                existing_checkin = (
                    db.query(Attendance)
                    .filter(
                        Attendance.church_id.is_(None),
                        Attendance.pco_checkin_id == pco_checkin_id,
                    )
                    .first()
                )

            if existing_checkin:
                existing_checkin.church_id = active_church_id
                if existing_checkin.attended_at is None:
                    parsed_attended_at = parse_pco_datetime(checkin.get("attended_at"))
                    if parsed_attended_at is not None:
                        existing_checkin.attended_at = parsed_attended_at
                continue

            db.add(
                Attendance(
                    church_id=active_church_id,
                    pco_checkin_id=pco_checkin_id,
                    member_pco_id=checkin.get("member_pco_id"),
                    attended_at=parse_pco_datetime(checkin.get("attended_at")),
                    source="planning_center",
                )
            )
            saved_attendance_count += 1

        db.flush()
        classified_members_count = _classify_member_lifecycles(db, active_church_id)

        token = _get_or_create_planning_center_token(db, active_church_id)
        token.connection_status = "connected"
        token.last_sync_at = datetime.utcnow()
        token.members_imported = saved_members_count
        token.attendance_imported = saved_attendance_count
        token.updated_at = datetime.utcnow()

        db.commit()

        print(f"People imported: {saved_members_count}")
        print(f"Attendance imported: {saved_attendance_count}")
        print(f"Lifecycles updated: {classified_members_count}")
        print(f"Emails found: {emails_found_count}")
        print(f"Missing emails: {saved_members_count - emails_found_count}")
    except Exception:
        db.rollback()
        try:
            fallback_church_id = active_church_id or _get_active_church_id(db)
            token = _get_or_create_planning_center_token(db, fallback_church_id)
            if token is not None:
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
