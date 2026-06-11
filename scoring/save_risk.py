import os
from datetime import datetime, timedelta, timezone

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


MEMBER_LIFECYCLE_ESTABLISHED_MEMBER = "established_member"
MEMBER_LIFECYCLE_NEW_NO_ATTENDANCE = "new_no_attendance"
MEMBER_LIFECYCLE_FIRST_TIME_VISITOR = "first_time_visitor"
MEMBER_LIFECYCLE_RETURNED_VISITOR = "returned_visitor"
MEMBER_LIFECYCLE_NEEDS_FIRST_FOLLOWUP = "needs_first_followup"

VISITOR_STATUS_FIRST_TIME = "first_time"
VISITOR_STATUS_RETURNED = "returned"
VISITOR_STATUS_CONVERTED = "converted"
VISITOR_STATUS_NONE = "none"


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


def _normalized_lifecycle(member):
    lifecycle = getattr(member, "member_lifecycle", None)
    if not lifecycle:
        return None
    return str(lifecycle).strip().lower() or None


def _is_established_for_risk(member, attendance_records):
    lifecycle = _normalized_lifecycle(member)
    if lifecycle is not None:
        return lifecycle == MEMBER_LIFECYCLE_ESTABLISHED_MEMBER

    attendance_count = len(
        [record for record in attendance_records if record.attended_at is not None]
    )
    return attendance_count >= 3


def _is_recent_pco_person(pco_created_at, now):
    if pco_created_at is None:
        return False

    if pco_created_at.tzinfo is not None:
        pco_created_at = pco_created_at.astimezone(timezone.utc).replace(tzinfo=None)

    return pco_created_at >= now - timedelta(days=14)


def _apply_member_lifecycle(member, attendance_records, now=None):
    now = now or datetime.utcnow()
    attendance_dates = [
        record.attended_at for record in attendance_records if record.attended_at is not None
    ]
    attendance_count = len(attendance_dates)
    first_visit_date = min(attendance_dates) if attendance_dates else None

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


def _find_existing_risk(db, active_church_id, member_pco_id, authenticated_sync):
    existing_risk = (
        db.query(RiskScore)
        .filter(
            RiskScore.church_id == active_church_id,
            RiskScore.member_pco_id == member_pco_id,
        )
        .first()
    )
    if existing_risk is None and not authenticated_sync:
        existing_risk = (
            db.query(RiskScore)
            .filter(
                RiskScore.church_id.is_(None),
                RiskScore.member_pco_id == member_pco_id,
            )
            .first()
        )

    return existing_risk


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
            if not member.pco_id:
                print(f"Skipping risk scoring for {member.name}: missing Planning Center ID")
                continue

            attendance_records = (
                db.query(Attendance)
                .filter(
                    Attendance.church_id == active_church_id,
                    Attendance.member_pco_id == member.pco_id,
                )
                .all()
            )
            _apply_member_lifecycle(member, attendance_records)

            existing_risk = _find_existing_risk(
                db,
                active_church_id,
                member.pco_id,
                authenticated_sync,
            )

            if not _is_established_for_risk(member, attendance_records):
                if existing_risk:
                    db.delete(existing_risk)
                    print(
                        f"Removed stale risk score for {member.name}: "
                        f"lifecycle={member.member_lifecycle or 'not established'}"
                    )
                else:
                    print(
                        f"Skipping risk scoring for {member.name}: "
                        f"lifecycle={member.member_lifecycle or 'not established'}"
                    )
                continue

            risk = calculate_risk(
                member,
                attendance_records,
                church_settings=church_settings,
            )
            reasons_text = ", ".join(risk["reasons"])

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
