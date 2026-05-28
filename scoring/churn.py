from datetime import datetime, timedelta, timezone


DEFAULT_CHURCH_SETTINGS = {
    "main_service_frequency": "weekly",
    "watch_missed_services": 2,
    "at_risk_missed_services": 4,
    "critical_missed_services": 6,
}


def get_tier(score):
    if score <= 20:
        return "Healthy"
    if score <= 40:
        return "Watch"
    if score <= 60:
        return "At Risk"
    return "Critical"


def normalize_attendance_dates(attendance_records=None):
    attendance_records = attendance_records or []
    attendance_dates = []

    for record in attendance_records:
        attended_at = record.attended_at
        if attended_at is None:
            continue
        if attended_at.tzinfo is not None:
            attended_at = attended_at.astimezone(timezone.utc).replace(tzinfo=None)
        attendance_dates.append(attended_at)

    return attendance_dates


def calculate_attendance_velocity(attendance_records=None, now=None):
    now = now or datetime.utcnow()
    attendance_dates = normalize_attendance_dates(attendance_records)

    recent_start = now - timedelta(days=28)
    previous_start = now - timedelta(days=56)

    recent_count = 0
    previous_count = 0

    for attended_at in attendance_dates:
        if attended_at >= recent_start:
            recent_count += 1
        elif previous_start <= attended_at < recent_start:
            previous_count += 1

    drop_percentage = None
    if previous_count > 0:
        drop_percentage = (previous_count - recent_count) / previous_count

    return {
        "recent_count": recent_count,
        "previous_count": previous_count,
        "drop_percentage": drop_percentage,
    }


def calculate_attendance_consistency(attendance_dates, now=None):
    now = now or datetime.utcnow()
    window_start = now - timedelta(days=56)
    active_weeks = set()

    for attended_at in attendance_dates:
        if attended_at < window_start or attended_at > now:
            continue

        days_ago = (now - attended_at).days
        if days_ago < 0 or days_ago > 56:
            continue

        week_index = min(days_ago // 7, 7)
        active_weeks.add(week_index)

    return len(active_weeks)


def _get_service_interval_days(main_service_frequency):
    if main_service_frequency == "twice_weekly":
        return 3.5
    if main_service_frequency == "monthly":
        return 30
    return 7


def _get_setting(church_settings, key):
    if church_settings is None:
        return DEFAULT_CHURCH_SETTINGS.get(key)

    value = getattr(church_settings, key, None)
    if value is None:
        return DEFAULT_CHURCH_SETTINGS.get(key)
    return value


def calculate_risk(member, attendance_records=None, church_settings=None):
    now = datetime.utcnow()
    reasons = []

    attendance_dates = normalize_attendance_dates(attendance_records)
    attendance_count = len(attendance_dates)

    breakdown = {
        "attendance_recency": 0,
        "attendance_velocity": 0,
        "attendance_consistency": 0,
        "status_risk": 0,
        "data_confidence": 0,
    }

    main_service_frequency = _get_setting(church_settings, "main_service_frequency")
    watch_missed_services = int(_get_setting(church_settings, "watch_missed_services"))
    at_risk_missed_services = int(_get_setting(church_settings, "at_risk_missed_services"))
    critical_missed_services = int(_get_setting(church_settings, "critical_missed_services"))
    service_interval_days = _get_service_interval_days(main_service_frequency)

    if not attendance_dates:
        breakdown["attendance_recency"] = 30
        reasons.append("No attendance history")
    else:
        last_attended = max(attendance_dates)
        days_since_last_attendance = (now - last_attended).days
        missed_services = days_since_last_attendance / service_interval_days

        if missed_services >= critical_missed_services:
            breakdown["attendance_recency"] = 30
            reasons.append(
                f"Missed about {missed_services:.1f} services since last attendance"
            )
        elif missed_services >= at_risk_missed_services:
            breakdown["attendance_recency"] = 20
            reasons.append(
                f"Missed about {missed_services:.1f} services since last attendance"
            )
        elif missed_services >= watch_missed_services:
            breakdown["attendance_recency"] = 10
            reasons.append(
                f"Missed about {missed_services:.1f} services since last attendance"
            )

    velocity = calculate_attendance_velocity(attendance_records, now=now)
    drop_percentage = velocity["drop_percentage"]
    if drop_percentage is not None:
        drop_percent_value = round(drop_percentage * 100)
        if drop_percentage >= 0.75:
            breakdown["attendance_velocity"] = 30
            reasons.append(
                f"Attendance dropped by {drop_percent_value}% compared to previous 4 weeks"
            )
        elif drop_percentage >= 0.50:
            breakdown["attendance_velocity"] = 20
            reasons.append(
                f"Attendance dropped by {drop_percent_value}% compared to previous 4 weeks"
            )
        elif drop_percentage >= 0.25:
            breakdown["attendance_velocity"] = 10
            reasons.append(
                f"Attendance dropped by {drop_percent_value}% compared to previous 4 weeks"
            )

    active_week_count = calculate_attendance_consistency(attendance_dates, now=now)
    if active_week_count <= 1:
        breakdown["attendance_consistency"] = 20
        reasons.append(f"Only active in {active_week_count} of last 8 weeks")
    elif active_week_count == 2:
        breakdown["attendance_consistency"] = 15
        reasons.append("Only active in 2 of last 8 weeks")
    elif active_week_count == 3:
        breakdown["attendance_consistency"] = 10
        reasons.append("Only active in 3 of last 8 weeks")
    elif active_week_count == 4:
        breakdown["attendance_consistency"] = 5
        reasons.append("Only active in 4 of last 8 weeks")

    if member.status != "active":
        breakdown["status_risk"] = 10
        reasons.append("Member status is not active")

    if not getattr(member, "email", None):
        breakdown["data_confidence"] += 5
        reasons.append("Missing email")

    if attendance_count < 2:
        breakdown["data_confidence"] += 5
        reasons.append("Limited attendance history")

    score = sum(breakdown.values())
    score = min(score, 100)
    tier = get_tier(score)

    return {
        "score": score,
        "tier": tier,
        "reasons": reasons,
        "breakdown": breakdown,
    }
