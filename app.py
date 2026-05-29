from collections import defaultdict
from datetime import datetime, timedelta
from html import escape as html_escape
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys

import streamlit as st

from ai.outreach import generate_recommendation, generate_outreach_message
from data.schema import (
    Attendance,
    ChurchSettings,
    IntegrationToken,
    Member,
    RiskScore,
    SessionLocal,
    get_or_create_default_church,
    init_db,
)
from ui import (
    build_empty_state,
    build_key_value_card,
    build_member_card,
    build_onboarding_step_track,
    build_priority_card,
    build_recent_change_items,
    build_risk_distribution,
    build_tier_badge,
    format_display_date,
    format_relative_date,
    inject_app_styles,
    make_attendance_trend_chart,
    make_gauge_chart,
    make_recency_distribution_chart,
    render_metric_card,
    render_page_header,
    render_sidebar_nav,
)
from ui.components import build_inline_badge, render_html_block
from ui.icons import brand_lockup_html, icon_svg
from utils.gmail_client import create_gmail_draft
from utils.planning_center_oauth import build_authorization_url, exchange_code_for_token


SERVICE_FREQUENCY_OPTIONS = ["weekly", "twice_weekly", "monthly"]
SERVICE_FREQUENCY_LABELS = {
    "weekly": "Weekly",
    "twice_weekly": "Twice weekly",
    "monthly": "Monthly",
}

PLOTLY_CHART_CONFIG = {
    "displayModeBar": False,
    "responsive": True,
}


def render_surface_header(title, subtitle=None, eyebrow=None):
    eyebrow_html = (
        f"<div class='surface-eyebrow'>{html_escape(str(eyebrow))}</div>" if eyebrow else ""
    )
    subtitle_html = (
        f"<div class='surface-subtitle'>{html_escape(str(subtitle))}</div>" if subtitle else ""
    )
    render_html_block(
        f"""
        <div class="surface-head">
            <div>
                {eyebrow_html}
                <div class="surface-title">{html_escape(str(title))}</div>
                {subtitle_html}
            </div>
        </div>
        """
    )


def truncate_text(value, max_length=140):
    text = str(value or "").strip()
    if len(text) <= max_length:
        return text
    return f"{text[: max_length - 1].rstrip()}…"


def compute_avg_risk_score(member_rows):
    if not member_rows:
        return 0
    scores = [int(row["Risk score"] or 0) for row in member_rows]
    return round(sum(scores) / len(scores)) if scores else 0


def run_module(module_name):
    project_root = os.path.dirname(os.path.abspath(__file__))
    command = [sys.executable, "-m", module_name]
    result = subprocess.run(
        command,
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
    )
    output = (result.stdout or "") + (result.stderr or "")
    return result.returncode, output


def extract_sync_counts(ingest_output):
    output = str(ingest_output or "")
    members_match = re.search(r"Saved\s+(\d+)\s+members", output, re.IGNORECASE)
    attendance_match = re.search(
        r"Saved\s+(\d+)\s+attendance records", output, re.IGNORECASE
    )
    members_imported = int(members_match.group(1)) if members_match else 0
    attendance_imported = int(attendance_match.group(1)) if attendance_match else 0
    return {
        "members_imported": members_imported,
        "attendance_imported": attendance_imported,
    }


def get_active_church_id():
    db = SessionLocal()
    try:
        active_church = get_or_create_default_church(db)
        return active_church.id
    finally:
        db.close()


def get_planning_center_integration_summary(church_id=None):
    active_church_id = church_id or get_active_church_id()
    db = SessionLocal()
    try:
        token = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id == active_church_id,
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
            if token is not None:
                token.church_id = active_church_id
                db.commit()
        if not token:
            return {
                "provider": "Planning Center",
                "status": "Disconnected",
                "connected": False,
                "last_sync_at": None,
                "members_imported": 0,
                "attendance_imported": 0,
            }

        raw_status = str(token.connection_status or "").strip().lower()
        has_access_token = bool(token.access_token)

        if has_access_token and raw_status == "connected":
            resolved_status = "Connected"
        elif raw_status == "error":
            resolved_status = "Error"
        elif has_access_token:
            resolved_status = "Connected"
        else:
            resolved_status = "Disconnected"

        summary = {
            "provider": "Planning Center",
            "status": resolved_status,
            "connected": bool(has_access_token and resolved_status == "Connected"),
            "last_sync_at": token.last_sync_at,
            "members_imported": int(token.members_imported or 0),
            "attendance_imported": int(token.attendance_imported or 0),
        }
        return summary
    finally:
        db.close()


def update_planning_center_sync_summary(sync_counts=None, church_id=None):
    sync_counts = sync_counts or {"members_imported": 0, "attendance_imported": 0}
    active_church_id = church_id or get_active_church_id()
    db = SessionLocal()
    try:
        token = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id == active_church_id,
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
            token = IntegrationToken(
                provider="planning_center",
                church_id=active_church_id,
            )
            db.add(token)

        token.church_id = active_church_id
        token.connection_status = "connected"
        token.last_sync_at = datetime.utcnow()
        token.members_imported = int(sync_counts.get("members_imported") or 0)
        token.attendance_imported = int(sync_counts.get("attendance_imported") or 0)
        token.updated_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()


def build_planning_center_status_badge(summary=None):
    integration_summary = summary or get_planning_center_integration_summary()
    status_value = str(integration_summary.get("status") or "").strip().lower()
    sync_running = bool(st.session_state.get("planning_center_sync_running", False))

    if sync_running:
        return build_inline_badge("Connecting", tone="watch", icon_name="refresh")
    if integration_summary.get("connected") and status_value == "connected":
        return build_inline_badge("Connected", tone="healthy", icon_name="check")
    if status_value == "error":
        return build_inline_badge("Error", tone="critical", icon_name="alert")
    return build_inline_badge("Disconnected", tone="neutral", icon_name="clock")


def build_dashboard_insights(metrics, member_rows, settings):
    total_members = metrics["total_members"] or 0
    average_risk = compute_avg_risk_score(member_rows)
    church_health_score = max(0, min(100, 100 - average_risk))
    at_risk_total = metrics["at_risk"] + metrics["critical"]
    low_risk_pct = round(
        ((metrics["healthy"] + metrics["watch"]) / total_members) * 100
    ) if total_members else 0

    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=30)
    previous_cutoff = now - timedelta(days=60)

    active_recent_ids = set()
    active_previous_ids = set()
    attendance_events = []

    for row in member_rows:
        member_id = row["member_pco_id"]
        for attendance_date in row["Attendance history"]:
            if not isinstance(attendance_date, datetime):
                continue
            attendance_events.append((member_id, attendance_date))
            if attendance_date >= recent_cutoff:
                active_recent_ids.add(member_id)
            elif previous_cutoff <= attendance_date < recent_cutoff:
                active_previous_ids.add(member_id)

    attendance_coverage = round((len(active_recent_ids) / total_members) * 100) if total_members else 0
    previous_coverage = round((len(active_previous_ids) / total_members) * 100) if total_members else 0
    engagement_delta = attendance_coverage - previous_coverage
    engagement_score = round((attendance_coverage + church_health_score) / 2) if total_members else 0

    current_week_start = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    attendance_trend = []
    for offset in range(11, -1, -1):
        period_start = current_week_start - timedelta(weeks=offset)
        period_end = period_start + timedelta(days=7)
        weekly_events = [
            (member_id, attended_at)
            for member_id, attended_at in attendance_events
            if period_start <= attended_at < period_end
        ]
        attendance_trend.append(
            {
                "label": period_start.strftime("%b %d"),
                "records": len(weekly_events),
                "unique_members": len({member_id for member_id, _ in weekly_events}),
            }
        )

    recency_buckets = [
        {"label": "Seen this week", "count": 0, "color": "rgba(0,107,85,0.76)"},
        {"label": "8–30 days", "count": 0, "color": "rgba(26,139,106,0.64)"},
        {"label": "31–60 days", "count": 0, "color": "rgba(154,114,21,0.72)"},
        {"label": "61–90 days", "count": 0, "color": "rgba(184,94,42,0.72)"},
        {"label": "No recent activity", "count": 0, "color": "rgba(194,59,59,0.72)"},
    ]

    for row in member_rows:
        last_attended = row["Last attended"]
        if not isinstance(last_attended, datetime):
            recency_buckets[-1]["count"] += 1
            continue
        days_since = max((now - last_attended).days, 0)
        if days_since <= 7:
            recency_buckets[0]["count"] += 1
        elif days_since <= 30:
            recency_buckets[1]["count"] += 1
        elif days_since <= 60:
            recency_buckets[2]["count"] += 1
        elif days_since <= 90:
            recency_buckets[3]["count"] += 1
        else:
            recency_buckets[4]["count"] += 1

    distribution_rows = []
    for tier, count in [
        ("Healthy", metrics["healthy"]),
        ("Watch", metrics["watch"]),
        ("At Risk", metrics["at_risk"]),
        ("Critical", metrics["critical"]),
    ]:
        distribution_rows.append(
            {
                "tier": tier,
                "count": count,
                "percent": round((count / total_members) * 100) if total_members else 0,
            }
        )

    priority_rows = sorted(
        [row for row in member_rows if int(row["Risk score"] or 0) >= 40],
        key=lambda row: int(row["Risk score"] or 0),
        reverse=True,
    )

    recent_changes = []
    sorted_changes = sorted(
        member_rows,
        key=lambda row: row["Risk updated at"] or row["Member created at"] or datetime.min,
        reverse=True,
    )
    for row in sorted_changes[:6]:
        change_timestamp = row["Risk updated at"] or row["Member created at"]
        if row["Risk updated at"]:
            recent_changes.append(
                {
                    "title": f"{row['Member name'] or 'Member'} risk profile refreshed",
                    "meta": format_relative_date(change_timestamp),
                    "copy": f"{row['Tier']} tier · {truncate_text(row['Reasons'], 96)}",
                    "icon": "activity",
                }
            )
        else:
            recent_changes.append(
                {
                    "title": f"{row['Member name'] or 'Member'} added to Shepherd",
                    "meta": format_relative_date(change_timestamp),
                    "copy": f"{(row['Status'] or 'Unknown').title()} record from {row['Source'] or 'Planning Center'}",
                    "icon": "members",
                }
            )

    volunteer_enabled = bool(settings and settings.get("volunteer_tracking_enabled"))
    volunteer_status = {
        "enabled": volunteer_enabled,
        "title": "Volunteer signals are enabled" if volunteer_enabled else "Volunteer signals are not active",
        "copy": (
            "Serving patterns can contribute to member health as volunteer data becomes available."
            if volunteer_enabled
            else "Enable volunteer tracking in settings to factor serving consistency into engagement health."
        ),
    }

    last_sync_candidates = [
        row["Risk updated at"] or row["Last attended"] or row["Member created at"]
        for row in member_rows
        if row["Risk updated at"] or row["Last attended"] or row["Member created at"]
    ]
    last_sync = max(last_sync_candidates) if last_sync_candidates else None

    return {
        "average_risk": average_risk,
        "church_health_score": church_health_score,
        "attendance_coverage": attendance_coverage,
        "previous_coverage": previous_coverage,
        "engagement_delta": engagement_delta,
        "engagement_score": engagement_score,
        "low_risk_pct": low_risk_pct,
        "at_risk_total": at_risk_total,
        "attendance_trend": attendance_trend,
        "recency_buckets": recency_buckets,
        "distribution_rows": distribution_rows,
        "priority_rows": priority_rows,
        "recent_changes": recent_changes,
        "volunteer_status": volunteer_status,
        "members_without_email": sum(1 for row in member_rows if not row["Email"]),
        "queue_average_risk": round(
            sum(int(row["Risk score"] or 0) for row in priority_rows) / len(priority_rows)
        ) if priority_rows else 0,
        "critical_pct": round((metrics["critical"] / total_members) * 100) if total_members else 0,
        "last_sync": last_sync,
    }


def load_dashboard_data():
    db = SessionLocal()
    try:
        active_church = get_or_create_default_church(db)
        church_id = active_church.id

        settings = (
            db.query(ChurchSettings)
            .filter(ChurchSettings.church_id == church_id)
            .first()
        )
        total_members = db.query(Member).filter(Member.church_id == church_id).count()

        healthy_count = (
            db.query(RiskScore)
            .filter(RiskScore.church_id == church_id, RiskScore.tier == "Healthy")
            .count()
        )
        watch_count = (
            db.query(RiskScore)
            .filter(RiskScore.church_id == church_id, RiskScore.tier == "Watch")
            .count()
        )
        at_risk_count = (
            db.query(RiskScore)
            .filter(RiskScore.church_id == church_id, RiskScore.tier == "At Risk")
            .count()
        )
        critical_count = (
            db.query(RiskScore)
            .filter(RiskScore.church_id == church_id, RiskScore.tier == "Critical")
            .count()
        )

        members = db.query(Member).filter(Member.church_id == church_id).all()
        risk_rows = db.query(RiskScore).filter(RiskScore.church_id == church_id).all()
        risk_by_member_id = {risk.member_pco_id: risk for risk in risk_rows}

        attendance_rows = (
            db.query(Attendance.member_pco_id, Attendance.attended_at)
            .filter(Attendance.church_id == church_id)
            .order_by(Attendance.attended_at.desc())
            .all()
        )

        attendance_stats = defaultdict(
            lambda: {"attendance_count": 0, "last_attended": None, "history": []}
        )
        for member_pco_id, attended_at in attendance_rows:
            stats = attendance_stats[member_pco_id]
            stats["attendance_count"] += 1
            if attended_at:
                stats["history"].append(attended_at)
                if stats["last_attended"] is None or attended_at > stats["last_attended"]:
                    stats["last_attended"] = attended_at

        member_rows = []
        for member in members:
            risk = risk_by_member_id.get(member.pco_id)
            member_attendance = attendance_stats.get(
                member.pco_id,
                {"attendance_count": 0, "last_attended": None, "history": []},
            )
            member_rows.append(
                {
                    "member": member,
                    "risk": risk,
                    "member_pco_id": member.pco_id,
                    "Member name": member.name,
                    "Email": member.email,
                    "Status": member.status,
                    "Source": member.source,
                    "Risk score": risk.score if risk else 0,
                    "Tier": risk.tier if risk else "Healthy",
                    "Reasons": risk.reasons if risk else "No reasons available",
                    "Recommendation": generate_recommendation(member, risk),
                    "Attendance count": member_attendance["attendance_count"],
                    "Attendance history": member_attendance["history"],
                    "Last attended": member_attendance["last_attended"],
                    "Last attended display": format_display_date(member_attendance["last_attended"]),
                    "Risk updated at": risk.updated_at if risk else None,
                    "Member created at": member.created_at,
                }
            )

        metrics = {
            "total_members": total_members,
            "healthy": healthy_count,
            "watch": watch_count,
            "at_risk": at_risk_count,
            "critical": critical_count,
        }
        settings_payload = {
            "church_name": settings.church_name if settings else "Shepherd",
            "main_service_frequency": settings.main_service_frequency if settings else "weekly",
            "volunteer_tracking_enabled": settings.volunteer_tracking_enabled if settings else False,
            "small_groups_enabled": settings.small_groups_enabled if settings else False,
            "email_engagement_enabled": settings.email_engagement_enabled if settings else False,
            "giving_enabled": settings.giving_enabled if settings else False,
            "volunteer_importance": settings.volunteer_importance if settings else "medium",
            "church_id": church_id,
        }
        insights = build_dashboard_insights(metrics, member_rows, settings_payload)
        integration_summary = get_planning_center_integration_summary(church_id=church_id)
        insights["planning_center_sync"] = integration_summary
        if integration_summary["last_sync_at"]:
            insights["last_sync"] = integration_summary["last_sync_at"]
        return metrics, member_rows, settings_payload, insights
    finally:
        db.close()


def load_church_settings():
    db = SessionLocal()
    try:
        active_church = get_or_create_default_church(db)
        settings = (
            db.query(ChurchSettings)
            .filter(ChurchSettings.church_id == active_church.id)
            .first()
        )
        if settings is None:
            return None

        return {
            "id": settings.id,
            "church_name": settings.church_name,
            "main_service_frequency": settings.main_service_frequency,
            "watch_missed_services": settings.watch_missed_services,
            "at_risk_missed_services": settings.at_risk_missed_services,
            "critical_missed_services": settings.critical_missed_services,
            "small_groups_enabled": settings.small_groups_enabled,
            "small_group_frequency": settings.small_group_frequency,
            "volunteer_tracking_enabled": settings.volunteer_tracking_enabled,
            "volunteer_importance": settings.volunteer_importance,
            "giving_enabled": settings.giving_enabled,
            "email_engagement_enabled": settings.email_engagement_enabled,
            "preferred_followup_style": settings.preferred_followup_style,
            "created_at": settings.created_at,
            "updated_at": settings.updated_at,
        }
    finally:
        db.close()


def is_onboarding_settings_complete(settings_payload):
    if not settings_payload:
        return False

    required_text_fields = (
        "church_name",
        "main_service_frequency",
        "preferred_followup_style",
    )
    required_numeric_fields = (
        "watch_missed_services",
        "at_risk_missed_services",
        "critical_missed_services",
    )

    for field_name in required_text_fields:
        value = settings_payload.get(field_name)
        if value is None or not str(value).strip():
            return False

    for field_name in required_numeric_fields:
        if settings_payload.get(field_name) is None:
            return False

    return True


def update_church_settings(
    church_name,
    main_service_frequency,
    watch_missed_services,
    at_risk_missed_services,
    critical_missed_services,
    preferred_followup_style,
    small_groups_enabled,
    volunteer_tracking_enabled,
    giving_enabled,
    email_engagement_enabled,
):
    db = SessionLocal()
    try:
        active_church = get_or_create_default_church(db)
        settings = (
            db.query(ChurchSettings)
            .filter(ChurchSettings.church_id == active_church.id)
            .first()
        )
        if settings is None:
            settings = ChurchSettings(church_id=active_church.id)
            db.add(settings)

        settings.church_id = active_church.id
        settings.church_name = church_name
        settings.main_service_frequency = main_service_frequency
        settings.watch_missed_services = int(watch_missed_services)
        settings.at_risk_missed_services = int(at_risk_missed_services)
        settings.critical_missed_services = int(critical_missed_services)
        settings.preferred_followup_style = preferred_followup_style
        settings.small_groups_enabled = bool(small_groups_enabled)
        settings.volunteer_tracking_enabled = bool(volunteer_tracking_enabled)
        settings.giving_enabled = bool(giving_enabled)
        settings.email_engagement_enabled = bool(email_engagement_enabled)
        if not settings.small_group_frequency:
            settings.small_group_frequency = "weekly"
        if not settings.volunteer_importance:
            settings.volunteer_importance = "medium"
        settings.updated_at = datetime.utcnow()

        db.commit()
    finally:
        db.close()


def init_session_state():
    if "persisted_setup_loaded" not in st.session_state:
        persisted_settings = load_church_settings()
        st.session_state.planning_center_connected = has_stored_planning_center_token()
        st.session_state.onboarding_completed = is_onboarding_settings_complete(persisted_settings)
        st.session_state.persisted_setup_loaded = True
    else:
        if "planning_center_connected" not in st.session_state:
            st.session_state.planning_center_connected = has_stored_planning_center_token()
        if "onboarding_completed" not in st.session_state:
            persisted_settings = load_church_settings()
            st.session_state.onboarding_completed = is_onboarding_settings_complete(persisted_settings)
    if "selected_member_id" not in st.session_state:
        st.session_state.selected_member_id = None
    if "outreach_messages" not in st.session_state:
        st.session_state.outreach_messages = {}
    if "last_refresh_logs" not in st.session_state:
        st.session_state.last_refresh_logs = None
    if "show_refresh_success" not in st.session_state:
        st.session_state.show_refresh_success = False
    if "connection_error" not in st.session_state:
        st.session_state.connection_error = None
    if "connection_logs" not in st.session_state:
        st.session_state.connection_logs = None
    if "last_sync_counts" not in st.session_state:
        st.session_state.last_sync_counts = None
    if "planning_center_oauth_url" not in st.session_state:
        st.session_state.planning_center_oauth_url = None
    if "planning_center_oauth_state" not in st.session_state:
        st.session_state.planning_center_oauth_state = None
    if "planning_center_last_oauth_code" not in st.session_state:
        st.session_state.planning_center_last_oauth_code = None
    if "planning_center_sync_running" not in st.session_state:
        st.session_state.planning_center_sync_running = False


def has_stored_planning_center_token():
    active_church_id = get_active_church_id()
    db = SessionLocal()
    try:
        token = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id == active_church_id,
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
            if token is not None:
                token.church_id = active_church_id
                db.commit()
        if not token:
            return False

        token_status = str(token.connection_status or "").strip().lower()
        return bool(token.access_token and token_status == "connected")
    finally:
        db.close()


def set_outreach_message(member_pco_id, message):
    st.session_state.outreach_messages[member_pco_id] = message


def get_outreach_message(member_pco_id):
    return st.session_state.outreach_messages.get(member_pco_id)


def format_last_attended(value):
    return format_display_date(value)


def format_sync_timestamp(value):
    if not isinstance(value, datetime):
        return "Not synced yet"
    return value.strftime("%b %d, %Y %I:%M %p UTC")


def run_refresh_pipeline():
    st.session_state.planning_center_sync_running = True
    try:
        ingest_code, ingest_output = run_module("data.ingest")
        if ingest_code != 0:
            return {
                "ok": False,
                "error": "`python -m data.ingest` failed",
                "output": ingest_output,
            }

        risk_code, risk_output = run_module("scoring.save_risk")
        if risk_code != 0:
            return {
                "ok": False,
                "error": "`python -m scoring.save_risk` failed",
                "output": risk_output,
            }

        sync_counts = extract_sync_counts(ingest_output)
        update_planning_center_sync_summary(sync_counts)

        return {
            "ok": True,
            "logs": {
                "ingest": ingest_output,
                "save_risk": risk_output,
            },
            "sync_counts": sync_counts,
        }
    finally:
        st.session_state.planning_center_sync_running = False


def render_refresh_button():
    refresh_clicked = st.button(
        "Refresh data",
        type="primary",
        width="stretch",
        key="refresh_dashboard_data",
    )

    if refresh_clicked:
        with st.spinner("Refreshing attendance and risk data..."):
            result = run_refresh_pipeline()

        if not result["ok"]:
            st.error(result["error"])
            st.code(result.get("output") or "No output")
            st.stop()

        st.session_state.last_refresh_logs = result["logs"]
        st.session_state.last_sync_counts = result.get("sync_counts")
        st.session_state.show_refresh_success = True

    if st.session_state.show_refresh_success:
        sync_counts = st.session_state.get("last_sync_counts") or {}
        members = int(sync_counts.get("members_imported") or 0)
        attendance = int(sync_counts.get("attendance_imported") or 0)
        st.success(
            f"Data refreshed successfully. Imported {members} members and {attendance} attendance records."
        )
        st.session_state.show_refresh_success = False


def _query_param_value(name):
    value = st.query_params.get(name)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _clear_oauth_query_params():
    for key in ("code", "state", "error", "error_description"):
        try:
            if key in st.query_params:
                del st.query_params[key]
        except Exception:
            continue


def _save_planning_center_token(token_payload):
    access_token = token_payload.get("access_token")
    if not access_token:
        raise RuntimeError("Planning Center OAuth did not return an access token.")

    refresh_token = token_payload.get("refresh_token")
    scope = token_payload.get("scope")

    expires_at = None
    expires_in = token_payload.get("expires_in")
    if expires_in is not None:
        try:
            expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))
        except (TypeError, ValueError):
            expires_at = None

    active_church_id = get_active_church_id()
    db = SessionLocal()
    try:
        token = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id == active_church_id,
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
            token = IntegrationToken(
                provider="planning_center",
                church_id=active_church_id,
            )
            db.add(token)

        token.church_id = active_church_id
        token.provider = "planning_center"
        token.access_token = access_token
        token.refresh_token = refresh_token
        token.expires_at = expires_at
        token.scope = str(scope) if scope is not None else None
        token.connection_status = "connected"
        token.updated_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()


def begin_planning_center_oauth():
    state = secrets.token_urlsafe(24)
    st.session_state.planning_center_oauth_state = state
    st.session_state.planning_center_oauth_url = build_authorization_url(state=state)


def complete_planning_center_oauth():
    oauth_error = _query_param_value("error")
    if oauth_error:
        error_description = _query_param_value("error_description")
        _clear_oauth_query_params()
        error_message = "Planning Center authorization was cancelled or denied."
        if error_description:
            error_message = f"{error_message} ({error_description})"
        return {"ok": False, "error": error_message, "logs": None}

    code = _query_param_value("code")
    if not code:
        return None

    if st.session_state.planning_center_last_oauth_code == code:
        return None

    expected_state = st.session_state.get("planning_center_oauth_state")
    returned_state = _query_param_value("state")
    if expected_state and returned_state != expected_state:
        _clear_oauth_query_params()
        return {"ok": False, "error": "Invalid OAuth state from Planning Center.", "logs": None}

    try:
        token_payload = exchange_code_for_token(code)
        _save_planning_center_token(token_payload)
    except Exception:
        _clear_oauth_query_params()
        return {"ok": False, "error": "Planning Center OAuth token exchange failed.", "logs": None}

    pipeline_result = run_refresh_pipeline()
    if not pipeline_result["ok"]:
        _clear_oauth_query_params()
        return {
            "ok": False,
            "error": f"Connected to Planning Center, but setup failed: {pipeline_result['error']}",
            "logs": {"pipeline_output": pipeline_result.get("output") or ""},
        }

    st.session_state.planning_center_last_oauth_code = code
    st.session_state.planning_center_oauth_state = None
    st.session_state.planning_center_oauth_url = None
    _clear_oauth_query_params()
    return {
        "ok": True,
        "error": None,
        "logs": pipeline_result.get("logs"),
        "sync_counts": pipeline_result.get("sync_counts"),
    }


def render_landing_screen():
    callback_result = complete_planning_center_oauth()
    if callback_result:
        if callback_result["ok"]:
            st.session_state.planning_center_connected = True
            st.session_state.last_refresh_logs = callback_result.get("logs")
            st.session_state.last_sync_counts = callback_result.get("sync_counts")
            st.session_state.connection_error = None
            st.session_state.connection_logs = callback_result.get("logs")
            st.success("Planning Center connected.")
            st.rerun()

        st.session_state.connection_error = callback_result["error"]
        st.session_state.connection_logs = callback_result.get("logs")

    left_col, right_col = st.columns([1.15, 0.85], gap="large")

    with left_col:
        with st.container(border=True):
            render_html_block(
                f"""
                <div style="padding:0.5rem 0.2rem 0.4rem;">
                    {brand_lockup_html(subtitle="Know who needs outreach before they drift away.")}
                    <div style="margin-top:1rem;font-family:'Plus Jakarta Sans', Inter, sans-serif;font-size:2rem;font-weight:700;line-height:1.06;letter-spacing:-0.04em;color:#1D2B24;">
                        A calmer operating system for church engagement.
                    </div>
                    <div style="margin-top:0.75rem;max-width:40rem;font-size:0.96rem;line-height:1.7;color:rgba(29,43,36,0.58);">
                        Shepherd brings attendance risk, outreach priorities, and member context into one workspace designed for pastors, staff, and volunteer leaders.
                    </div>
                </div>
                """
            )

            render_html_block(
                f"""
                <div class="timeline-list" style="margin-top:0.9rem;">
                    <div class="timeline-item">
                        <div class="timeline-dot">{icon_svg("activity", size=14)}</div>
                        <div class="timeline-body">
                            <div class="timeline-title">Operational member health</div>
                            <div class="timeline-copy">Track attendance behavior, engagement momentum, and follow-up risk with a clear operational signal.</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot">{icon_svg("priority", size=14)}</div>
                        <div class="timeline-body">
                            <div class="timeline-title">Priority outreach queue</div>
                            <div class="timeline-copy">Surface the people who need attention now, with grounded context and recommended next actions.</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot">{icon_svg("mail", size=14)}</div>
                        <div class="timeline-body">
                            <div class="timeline-title">Draft-ready communication</div>
                            <div class="timeline-copy">Generate tailored outreach messages without disrupting Gmail or your current follow-up workflow.</div>
                        </div>
                    </div>
                </div>
                """
            )
        render_html_block(build_onboarding_step_track(1))

    with right_col:
        with st.container(border=True):
            render_surface_header(
                "Connect Planning Center",
                "Import members and attendance, run the initial scoring pipeline, and unlock your workspace.",
                eyebrow="Step 1 of 5",
            )
            st.progress(1 / 5, text="Step 1 of 5")

            render_html_block(
                f"""
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin:0.95rem 0 1rem;">
                    {build_inline_badge("Planning Center", tone="accent", icon_name="shield")}
                    {build_inline_badge("Attendance sync", tone="healthy", icon_name="activity")}
                    {build_inline_badge("Risk scoring", tone="watch", icon_name="sparkles")}
                </div>
                """
            )

            connect_clicked = st.button(
                "Connect Planning Center",
                type="primary",
                width="stretch",
                key="connect_planning_center_button",
            )

            if connect_clicked:
                try:
                    begin_planning_center_oauth()
                    st.session_state.connection_error = None
                    st.session_state.connection_logs = None
                except Exception:
                    st.session_state.connection_error = (
                        "Planning Center OAuth settings are missing. "
                        "Set PLANNING_CENTER_CLIENT_ID, PLANNING_CENTER_CLIENT_SECRET, "
                        "and PLANNING_CENTER_REDIRECT_URI in .env."
                    )

            oauth_url = st.session_state.get("planning_center_oauth_url")
            if oauth_url:
                st.info("Step 1: Open the authorization link. Step 2: Approve access. Step 3: Return to Shepherd.")
                st.markdown(f"[Authorize with Planning Center]({oauth_url})")

            if st.session_state.connection_error:
                st.error(st.session_state.connection_error)
            if st.session_state.connection_logs:
                with st.expander("Connection logs"):
                    logs = st.session_state.connection_logs
                    if isinstance(logs, dict):
                        for key, value in logs.items():
                            st.subheader(str(key))
                            st.code(value or "No output")
                    else:
                        st.code(str(logs))


def render_onboarding_screen():
    settings = load_church_settings() or {}

    default_church_name = settings.get("church_name") or "Shepherd Demo Church"
    default_main_frequency = settings.get("main_service_frequency") or "weekly"
    default_watch = int(settings.get("watch_missed_services") or 2)
    default_at_risk = int(settings.get("at_risk_missed_services") or 4)
    default_critical = int(settings.get("critical_missed_services") or 6)
    default_small_groups_enabled = bool(settings.get("small_groups_enabled", False))
    default_volunteer_tracking_enabled = bool(settings.get("volunteer_tracking_enabled", False))
    default_followup_style = settings.get("preferred_followup_style") or "Warm, personal, and reassuring"
    default_giving_enabled = bool(settings.get("giving_enabled", False))
    default_email_engagement_enabled = bool(settings.get("email_engagement_enabled", False))

    render_page_header(
        "Configure your church workspace",
        subtitle="Set your engagement thresholds and communication defaults before Shepherd opens the dashboard.",
        eyebrow="Onboarding",
        chips=[build_inline_badge("Planning Center connected", tone="healthy", icon_name="check")],
    )
    st.progress(2 / 5, text="Step 2 of 5")
    render_html_block(build_onboarding_step_track(2))

    form_col, review_col = st.columns([1.2, 0.8], gap="large")

    with form_col:
        with st.container(border=True):
            render_surface_header(
                "Church profile and scoring",
                "These settings personalize how Shepherd interprets disengagement and shapes follow-up recommendations.",
                eyebrow="Configuration",
            )

            with st.form("onboarding_form"):
                st.markdown("##### Church profile")
                church_name = st.text_input("Church name", value=default_church_name)
                main_service_frequency = st.selectbox(
                    "Main service frequency",
                    options=SERVICE_FREQUENCY_OPTIONS,
                    format_func=lambda option: SERVICE_FREQUENCY_LABELS.get(option, option.title()),
                    index=SERVICE_FREQUENCY_OPTIONS.index(
                        default_main_frequency
                        if default_main_frequency in SERVICE_FREQUENCY_OPTIONS
                        else "weekly"
                    ),
                )

                st.markdown("##### Attendance thresholds")
                threshold_col1, threshold_col2, threshold_col3 = st.columns(3)
                watch_missed_services = threshold_col1.number_input(
                    "Watch",
                    min_value=1,
                    step=1,
                    value=default_watch,
                )
                at_risk_missed_services = threshold_col2.number_input(
                    "At Risk",
                    min_value=1,
                    step=1,
                    value=default_at_risk,
                )
                critical_missed_services = threshold_col3.number_input(
                    "Critical",
                    min_value=1,
                    step=1,
                    value=default_critical,
                )

                st.markdown("##### Signals Shepherd should consider")
                signal_col1, signal_col2 = st.columns(2)
                small_groups_enabled = signal_col1.checkbox(
                    "Include small group participation",
                    value=default_small_groups_enabled,
                )
                volunteer_tracking_enabled = signal_col2.checkbox(
                    "Include volunteer activity",
                    value=default_volunteer_tracking_enabled,
                )
                giving_enabled = signal_col1.checkbox(
                    "Include giving signals",
                    value=default_giving_enabled,
                )
                email_engagement_enabled = signal_col2.checkbox(
                    "Include email engagement",
                    value=default_email_engagement_enabled,
                )

                st.markdown("##### Outreach voice")
                preferred_followup_style = st.text_area(
                    "Preferred follow-up tone",
                    value=default_followup_style,
                    height=120,
                )

                submitted = st.form_submit_button(
                    "Finish onboarding",
                    type="primary",
                    width="stretch",
                )

            if submitted:
                update_church_settings(
                    church_name=church_name,
                    main_service_frequency=main_service_frequency,
                    watch_missed_services=watch_missed_services,
                    at_risk_missed_services=at_risk_missed_services,
                    critical_missed_services=critical_missed_services,
                    preferred_followup_style=preferred_followup_style,
                    small_groups_enabled=small_groups_enabled,
                    volunteer_tracking_enabled=volunteer_tracking_enabled,
                    giving_enabled=giving_enabled,
                    email_engagement_enabled=email_engagement_enabled,
                )
                st.session_state.onboarding_completed = True
                st.success("Onboarding complete. Opening the dashboard...")
                st.rerun()

    with review_col:
        with st.container(border=True):
            render_surface_header(
                "Review before launch",
                "Shepherd will use these defaults until you adjust them in settings.",
                eyebrow="Step 3 and 4",
            )
            render_html_block(
                f"""
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:1rem;">
                    {build_inline_badge("Attendance thresholds", tone="accent", icon_name="activity")}
                    {build_inline_badge("Outreach drafting", tone="healthy", icon_name="mail")}
                    {build_inline_badge("Priority queue", tone="watch", icon_name="priority")}
                </div>
                """
            )
            render_html_block(
                build_key_value_card(
                    [
                        ("Church name", default_church_name),
                        ("Service frequency", SERVICE_FREQUENCY_LABELS.get(default_main_frequency, default_main_frequency)),
                        ("Watch threshold", f"{default_watch} missed services"),
                        ("At Risk threshold", f"{default_at_risk} missed services"),
                        ("Critical threshold", f"{default_critical} missed services"),
                    ]
                )
            )
            render_html_block(
                f"""
                <div style="margin-top:1rem;">
                    <div class="surface-title" style="font-size:0.92rem;">What happens next</div>
                    <div class="timeline-list" style="margin-top:0.7rem;">
                        <div class="timeline-item">
                            <div class="timeline-dot">{icon_svg("layers", size=14)}</div>
                            <div class="timeline-body">
                                <div class="timeline-title">Review your dashboard</div>
                                <div class="timeline-copy">See church health, attendance momentum, and outreach priorities in one place.</div>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot">{icon_svg("users-round", size=14)}</div>
                            <div class="timeline-body">
                                <div class="timeline-title">Work member by member</div>
                                <div class="timeline-copy">Use the CRM-style member view to inspect context, timeline, and recommended next steps.</div>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-dot">{icon_svg("mail", size=14)}</div>
                            <div class="timeline-body">
                                <div class="timeline-title">Generate communication drafts</div>
                                <div class="timeline-copy">Create outreach messages and Gmail drafts without changing your underlying integrations.</div>
                            </div>
                        </div>
                    </div>
                </div>
                """
            )


def render_dashboard_page(metrics, member_rows, settings, insights):
    church_name = settings.get("church_name") or "Shepherd"
    sync_summary = insights.get("planning_center_sync") or get_planning_center_integration_summary()
    header_chips = [
        build_planning_center_status_badge(sync_summary),
        build_inline_badge(
            f"{insights['at_risk_total']} members need follow-up",
            tone="critical" if insights["at_risk_total"] else "healthy",
            icon_name="priority",
            pulse=insights["at_risk_total"] > 0,
        ),
    ]
    if insights["last_sync"]:
        header_chips.append(
            build_inline_badge(
                f"Last signal {format_relative_date(insights['last_sync'])}",
                tone="neutral",
                icon_name="clock",
            )
        )

    header_col, action_col = st.columns([4.4, 1], gap="large")
    with header_col:
        render_page_header(
            "Operations overview",
            eyebrow="Dashboard",
            show_date=True,
            chips=header_chips,
        )
    with action_col:
        render_html_block("<div style='height:1.65rem;'></div>")
        render_refresh_button()

    # Four primary KPIs
    kpi_cols = st.columns(4, gap="medium")
    with kpi_cols[0]:
        tone = "healthy" if insights["church_health_score"] >= 70 else ("watch" if insights["church_health_score"] >= 50 else "critical")
        render_metric_card(
            "Church Health",
            insights["church_health_score"],
            f"Average risk score {insights['average_risk']}",
            tone=tone,
            icon_name="shield",
        )
    with kpi_cols[1]:
        render_metric_card(
            "Total Members",
            metrics["total_members"],
            f"{metrics['healthy'] + metrics['watch']} below risk threshold",
            tone="accent",
            icon_name="members",
        )
    with kpi_cols[2]:
        render_metric_card(
            "At Risk Members",
            insights["at_risk_total"],
            f"{metrics['critical']} in critical status",
            tone="critical" if insights["at_risk_total"] else "healthy",
            icon_name="alert",
        )
    with kpi_cols[3]:
        render_metric_card(
            "Attendance Momentum",
            f"{insights['attendance_coverage']}%",
            "Members seen in the last 30 days",
            tone="accent",
            icon_name="trend",
            delta=f"{insights['engagement_delta']:+} pts",
        )

    render_html_block("<div style='height:0.6rem;'></div>")
    sync_col, _ = st.columns([1.05, 2.95], gap="large")
    with sync_col:
        with st.container(border=True):
            render_surface_header(
                "Planning Center sync",
                eyebrow="Integration",
            )
            render_html_block(
                build_key_value_card(
                    [
                        ("Provider", sync_summary["provider"]),
                        ("Status", sync_summary["status"]),
                        ("Last sync", format_sync_timestamp(sync_summary["last_sync_at"])),
                        ("Members imported", sync_summary["members_imported"]),
                        ("Attendance imported", sync_summary["attendance_imported"]),
                    ]
                )
            )

    render_html_block("<div style='height:0.85rem;'></div>")

    # Church Health gauge | Attendance Trend | Risk Distribution
    gauge_col, trend_col, dist_col = st.columns([0.82, 1.68, 1.0], gap="large")

    with gauge_col:
        with st.container(border=True):
            render_surface_header(
                "Church Health",
                eyebrow="Scorecard",
            )
            st.plotly_chart(
                make_gauge_chart(
                    insights["church_health_score"],
                    title="",
                    reverse=True,
                    footer="Higher is healthier",
                    height=168,
                ),
                config=PLOTLY_CHART_CONFIG,
                use_container_width=True,
            )

    with trend_col:
        with st.container(border=True):
            render_surface_header(
                "Attendance trends",
                "Weekly attendance patterns across the last twelve weeks.",
                eyebrow="12-week view",
            )
            st.plotly_chart(
                make_attendance_trend_chart(insights["attendance_trend"]),
                config=PLOTLY_CHART_CONFIG,
                use_container_width=True,
            )

    with dist_col:
        with st.container(border=True):
            render_surface_header(
                "Risk distribution",
                "Current health mix across the congregation.",
                eyebrow="Current state",
            )
            render_html_block(build_risk_distribution(insights["distribution_rows"]))

    render_html_block("<div style='height:0.85rem;'></div>")

    # Priority outreach queue | Recent changes
    queue_col, changes_col = st.columns([1.35, 1.0], gap="large")

    with queue_col:
        with st.container(border=True):
            render_surface_header(
                "Priority outreach",
                "Immediate follow-up candidates, ordered by highest risk.",
                eyebrow="Action queue",
            )
            if insights["priority_rows"]:
                for row in insights["priority_rows"][:3]:
                    render_html_block(build_priority_card(row, compact=True))
                if st.button("Open full outreach queue", key="dashboard_open_priority", width="stretch"):
                    st.session_state.current_page = "Priority Outreach"
                    st.rerun()
            else:
                render_html_block(
                    build_empty_state(
                        "check",
                        "No members currently meet the priority threshold.",
                        "When members move into At Risk or Critical territory, they appear here automatically.",
                    )
                )

    with changes_col:
        with st.container(border=True):
            render_surface_header(
                "Recent member changes",
                "Latest updates from sync and scoring activity.",
                eyebrow="Change log",
            )
            render_html_block(build_recent_change_items(insights["recent_changes"]))
            if st.button("Open members workspace", key="dashboard_open_members", width="stretch"):
                st.session_state.current_page = "Members"
                st.rerun()

    render_html_block("<div style='height:0.85rem;'></div>")

    # Collapsible secondary analytics
    with st.expander("Engagement analytics"):
        render_surface_header(
            "Engagement momentum",
            "Recency buckets show who is slipping from active participation.",
            eyebrow="Recency",
        )
        st.plotly_chart(
            make_recency_distribution_chart(insights["recency_buckets"]),
            config=PLOTLY_CHART_CONFIG,
            use_container_width=True,
        )

    with st.expander("Workspace configuration"):
        vol_col, cfg_col = st.columns([1.2, 1], gap="large")
        volunteer_status = insights["volunteer_status"]
        with vol_col:
            render_surface_header(
                "Signal settings",
                "Volunteer and engagement signals affecting member health analysis.",
                eyebrow="Operational readiness",
            )
            render_html_block(
                f"""
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.8rem;">
                    {build_inline_badge(
                        "Volunteer enabled" if volunteer_status["enabled"] else "Volunteer disabled",
                        tone="healthy" if volunteer_status["enabled"] else "neutral",
                        icon_name="users-round",
                    )}
                    {build_inline_badge(
                        "Small groups on" if settings.get("small_groups_enabled") else "Small groups off",
                        tone="accent" if settings.get("small_groups_enabled") else "neutral",
                        icon_name="layers",
                    )}
                    {build_inline_badge(
                        "Email engagement on" if settings.get("email_engagement_enabled") else "Email engagement off",
                        tone="accent" if settings.get("email_engagement_enabled") else "neutral",
                        icon_name="mail",
                    )}
                </div>
                <div style="font-size:0.92rem;font-weight:700;color:#1D2B24;">{html_escape(volunteer_status['title'])}</div>
                <div style="margin-top:0.3rem;font-size:0.87rem;line-height:1.6;color:rgba(29,43,36,0.56);">{html_escape(volunteer_status['copy'])}</div>
                """
            )
            if st.button("Review signal settings", key="dashboard_open_settings", width="stretch"):
                st.session_state.current_page = "Settings"
                st.rerun()

        with cfg_col:
            render_surface_header(
                "Configuration snapshot",
                "The operational defaults Shepherd is currently using.",
                eyebrow="Current setup",
            )
            render_html_block(
                build_key_value_card(
                    [
                        ("Church", church_name),
                        ("Service frequency", SERVICE_FREQUENCY_LABELS.get(settings.get("main_service_frequency", "weekly"), "Weekly")),
                        ("Priority queue", f"{len(insights['priority_rows'])} members"),
                        ("No email on file", f"{insights['members_without_email']} members"),
                        ("Critical share", f"{insights['critical_pct']}%"),
                    ]
                )
            )

def filter_member_rows(member_rows, search_query, tier_filter):
    search_text = (search_query or "").strip().lower()
    filtered = []

    for row in member_rows:
        member_name = (row["Member name"] or "").lower()
        member_email = (row["Email"] or "").lower()
        if search_text and search_text not in member_name and search_text not in member_email:
            continue
        if tier_filter != "All" and row["Tier"] != tier_filter:
            continue
        filtered.append(row)

    return sorted(
        filtered,
        key=lambda row: (-int(row["Risk score"] or 0), row["Member name"] or ""),
    )


def build_member_timeline_items(selected_row):
    events = []
    for attended_at in selected_row["Attendance history"][:5]:
        events.append(
            {
                "date": attended_at,
                "title": "Attended service",
                "meta": format_display_date(attended_at),
                "copy": "Recorded through Planning Center attendance sync.",
                "icon": "activity",
            }
        )

    if selected_row["Risk updated at"]:
        events.append(
            {
                "date": selected_row["Risk updated at"],
                "title": "Risk profile refreshed",
                "meta": format_display_date(selected_row["Risk updated at"]),
                "copy": f"{selected_row['Tier']} tier · {truncate_text(selected_row['Reasons'], 96)}",
                "icon": "sparkles",
            }
        )

    if selected_row["Member created at"]:
        events.append(
            {
                "date": selected_row["Member created at"],
                "title": "Member record added",
                "meta": format_display_date(selected_row["Member created at"]),
                "copy": f"Source: {selected_row['Source'] or 'Planning Center'}",
                "icon": "members",
            }
        )

    ordered_events = sorted(
        events,
        key=lambda item: item["date"] or datetime.min,
        reverse=True,
    )
    return [
        {
            "title": item["title"],
            "meta": item["meta"],
            "copy": item["copy"],
            "icon": item["icon"],
        }
        for item in ordered_events
    ]


def render_message_preview(message):
    escaped_message = html_escape(message or "").replace("\n", "<br>")
    render_html_block(f"<div class='message-preview'>{escaped_message}</div>")


def render_member_detail_panel(selected_row):
    selected_member = selected_row["member"]
    selected_risk = selected_row["risk"]
    selected_member_id = selected_row["member_pco_id"]

    render_html_block(
        f"""
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem;">
            <div>
                <div style="font-family:'Plus Jakarta Sans', Inter, sans-serif;font-size:1.55rem;font-weight:700;line-height:1.08;color:#1D2B24;">
                    {html_escape(selected_row['Member name'] or 'Unknown member')}
                </div>
                <div style="margin-top:0.32rem;font-size:0.9rem;color:rgba(29,43,36,0.48);">
                    {html_escape(selected_row['Email'] or 'No email on file')}
                </div>
            </div>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;justify-content:flex-end;">
                {build_tier_badge(selected_row['Tier'])}
                {build_inline_badge(selected_row['Status'] or 'Unknown', tone='neutral')}
                {build_inline_badge(f"{selected_row['Attendance count']} attendance", tone='accent', icon_name='activity')}
            </div>
        </div>
        """
    )

    risk_score = int(selected_row["Risk score"] or 0)
    engagement_score = max(0, 100 - risk_score)

    gauge_col1, gauge_col2, gauge_col3 = st.columns([1, 1, 0.9], gap="medium")
    with gauge_col1:
        st.plotly_chart(
            make_gauge_chart(risk_score, title="RISK", footer="Lower is healthier"),
            config=PLOTLY_CHART_CONFIG,
        )
    with gauge_col2:
        st.plotly_chart(
            make_gauge_chart(
                engagement_score,
                title="ENGAGEMENT",
                reverse=True,
                footer="Inverse of current risk",
            ),
            config=PLOTLY_CHART_CONFIG,
        )
    with gauge_col3:
        render_metric_card(
            "Last attended",
            selected_row["Last attended display"] if selected_row["Last attended"] else "—",
            f"{selected_row['Attendance count']} total attendance records",
            tone="accent",
            icon_name="clock",
        )

    render_html_block("<div style='height:0.65rem;'></div>")

    summary_col, timeline_col = st.columns([1.05, 0.95], gap="large")
    with summary_col:
        with st.container(border=True):
            render_surface_header(
                "Member summary",
                "The highest-signal reasons behind this member’s current risk posture.",
                eyebrow="Context",
            )
            render_html_block(
                f"""
                <div class="queue-item-recommendation" style="margin-bottom:0.8rem;">
                    <div class="queue-item-recommendation-label">Risk factors</div>
                    <div>{html_escape(selected_row['Reasons'])}</div>
                </div>
                <div class="queue-item-recommendation">
                    <div class="queue-item-recommendation-label">Recommended next step</div>
                    <div>{html_escape(selected_row['Recommendation'])}</div>
                </div>
                """
            )

    with timeline_col:
        with st.container(border=True):
            render_surface_header(
                "Activity timeline",
                "Recent attendance and scoring events for this member.",
                eyebrow="Timeline",
            )
            render_html_block(build_recent_change_items(build_member_timeline_items(selected_row)))

    render_html_block("<div style='height:0.65rem;'></div>")

    action_col1, action_col2 = st.columns(2, gap="medium")
    with action_col1:
        if st.button(
            "Generate outreach message",
            key=f"detail_generate_{selected_member_id}",
            width="stretch",
        ):
            message = generate_outreach_message(selected_member, selected_risk)
            set_outreach_message(selected_member_id, message)

    with action_col2:
        if st.button(
            "Create Gmail draft",
            key=f"detail_draft_{selected_member_id}",
            width="stretch",
        ):
            if not selected_row["Email"]:
                st.warning("No email available for this member.")
            else:
                message = generate_outreach_message(selected_member, selected_risk)
                set_outreach_message(selected_member_id, message)
                subject = f"Checking in from Shepherd - {selected_row['Member name']}"
                try:
                    draft = create_gmail_draft(selected_row["Email"], subject, message)
                    st.success(
                        f"Gmail draft created for {selected_row['Email']} (Draft ID: {draft.get('id')})."
                    )
                except Exception as error:
                    st.error(f"Failed to create Gmail draft: {error}")

    outreach_message = get_outreach_message(selected_member_id)
    if outreach_message:
        render_message_preview(outreach_message)


def render_members_page(member_rows):
    render_page_header(
        "Members workspace",
        subtitle="A CRM-style view for scanning the congregation, selecting people quickly, and acting with context.",
        eyebrow="Members",
        chips=[build_inline_badge(f"{len(member_rows)} members", tone="accent", icon_name="members")],
    )

    with st.container(border=True):
        render_surface_header(
            "Search and filter",
            "Use the directory on the left and the detail panel on the right to work through member health at speed.",
            eyebrow="Directory controls",
        )
        search_col, filter_col, info_col = st.columns([1.8, 1, 0.9], gap="medium")
        with search_col:
            search_query = st.text_input("Search by member name or email", key="member_search_query")
        with filter_col:
            tier_filter = st.selectbox(
                "Filter by tier",
                options=["All", "Healthy", "Watch", "At Risk", "Critical"],
                key="member_tier_filter",
            )
        with info_col:
            filtered_preview = filter_member_rows(member_rows, st.session_state.get("member_search_query", ""), st.session_state.get("member_tier_filter", "All"))
            render_metric_card(
                "Visible members",
                len(filtered_preview),
                "Results after current filters",
                tone="accent",
                icon_name="search",
            )

    filtered_rows = filter_member_rows(
        member_rows,
        st.session_state.get("member_search_query", ""),
        st.session_state.get("member_tier_filter", "All"),
    )

    if not filtered_rows:
        render_html_block(
            build_empty_state(
                "search",
                "No members match the current filters.",
                "Adjust the search query or tier filter to continue working through the congregation.",
            )
        )
        return

    member_options = [row["member_pco_id"] for row in filtered_rows]
    if st.session_state.selected_member_id not in member_options:
        st.session_state.selected_member_id = member_options[0]

    list_col, detail_col = st.columns([0.96, 1.44], gap="large")
    with list_col:
        with st.container(border=True):
            render_surface_header(
                "Member directory",
                "Risk-first ordering keeps the most urgent follow-up work at the top.",
                eyebrow="Left panel",
            )
            for row in filtered_rows:
                member_id = row["member_pco_id"]
                is_selected = member_id == st.session_state.selected_member_id
                render_html_block(build_member_card(row, selected=is_selected))
                if st.button(
                    "Selected" if is_selected else "Open profile",
                    key=f"crm_select_member_{member_id}",
                    type="primary" if is_selected else "secondary",
                    width="stretch",
                ):
                    st.session_state.selected_member_id = member_id
                    st.rerun()
                render_html_block("<div style='height:0.45rem;'></div>")

    selected_row = next(
        (row for row in filtered_rows if row["member_pco_id"] == st.session_state.selected_member_id),
        None,
    )

    with detail_col:
        with st.container(border=True):
            render_surface_header(
                "Member detail",
                "A higher-context panel for risk, attendance, outreach, and recent activity.",
                eyebrow="Right panel",
            )
            if selected_row:
                render_member_detail_panel(selected_row)
            else:
                render_html_block(
                    build_empty_state(
                        "members",
                        "Select a member to continue.",
                        "The detail panel opens attendance history, risk reasoning, and outreach actions.",
                    )
                )


def render_priority_outreach_page(member_rows, insights):
    priority_rows = insights["priority_rows"]
    render_page_header(
        "Priority outreach",
        subtitle="High-priority members who need follow-up now, organized as an operational queue rather than a generic dashboard.",
        eyebrow="Outreach",
        chips=[
            build_inline_badge(f"{len(priority_rows)} members in queue", tone="critical" if priority_rows else "healthy", icon_name="priority"),
            build_inline_badge(f"{insights['members_without_email']} without email", tone="neutral", icon_name="mail"),
        ],
    )

    summary_cols = st.columns(4, gap="medium")
    with summary_cols[0]:
        render_metric_card(
            "Queue Size",
            len(priority_rows),
            "Members with risk score of 40 or higher",
            tone="critical" if priority_rows else "healthy",
            icon_name="priority",
        )
    with summary_cols[1]:
        render_metric_card(
            "Critical Members",
            sum(1 for row in priority_rows if row["Tier"] == "Critical"),
            "Highest urgency follow-up tier",
            tone="critical",
            icon_name="alert",
        )
    with summary_cols[2]:
        render_metric_card(
            "Average Queue Risk",
            insights["queue_average_risk"],
            "Average risk score inside the queue",
            tone="watch",
            icon_name="activity",
        )
    with summary_cols[3]:
        render_metric_card(
            "No Email on File",
            sum(1 for row in priority_rows if not row["Email"]),
            "Manual outreach likely required",
            tone="neutral",
            icon_name="mail",
        )

    render_html_block("<div style='height:0.85rem;'></div>")

    if not priority_rows:
        render_html_block(
            build_empty_state(
                "check",
                "No members currently need priority outreach.",
                "The queue will populate automatically as risk scores move into At Risk or Critical territory.",
            )
        )
        return

    for row in priority_rows:
        member = row["member"]
        risk = row["risk"]
        member_pco_id = row["member_pco_id"]

        with st.container(border=True):
            render_html_block(build_priority_card(row))
            action_col1, action_col2, action_col3 = st.columns([1, 1, 1.05], gap="medium")
            with action_col1:
                if st.button("Generate outreach", key=f"priority_generate_{member_pco_id}", width="stretch"):
                    message = generate_outreach_message(member, risk)
                    set_outreach_message(member_pco_id, message)

            with action_col2:
                if st.button("Create Gmail draft", key=f"priority_draft_{member_pco_id}", width="stretch"):
                    if not row["Email"]:
                        st.warning("No email available for this member.")
                    else:
                        message = generate_outreach_message(member, risk)
                        set_outreach_message(member_pco_id, message)
                        subject = f"Checking in from Shepherd - {row['Member name']}"
                        try:
                            draft = create_gmail_draft(row["Email"], subject, message)
                            st.success(
                                f"Gmail draft created for {row['Email']} (Draft ID: {draft.get('id')})."
                            )
                        except Exception as error:
                            st.error(f"Failed to create Gmail draft: {error}")

            with action_col3:
                if st.button("Open member record", key=f"priority_open_member_{member_pco_id}", width="stretch"):
                    st.session_state.selected_member_id = member_pco_id
                    st.session_state.current_page = "Members"
                    st.rerun()

            outreach_message = get_outreach_message(member_pco_id)
            if outreach_message:
                render_message_preview(outreach_message)

        render_html_block("<div style='height:0.75rem;'></div>")


def render_settings_page():
    callback_result = complete_planning_center_oauth()
    if callback_result:
        if callback_result["ok"]:
            st.session_state.planning_center_connected = True
            st.session_state.last_refresh_logs = callback_result.get("logs")
            st.session_state.last_sync_counts = callback_result.get("sync_counts")
            st.session_state.connection_error = None
            st.success("Planning Center reconnected successfully.")
            st.rerun()
        st.session_state.connection_error = callback_result["error"]

    current_settings = load_church_settings()
    if current_settings is None:
        st.error("Unable to load church settings.")
        return

    integration_summary = get_planning_center_integration_summary()

    render_page_header(
        "Workspace settings",
        subtitle="Engagement thresholds, signal toggles, and follow-up defaults are managed here without touching your integrations or backend logic.",
        eyebrow="Settings",
        chips=[build_inline_badge(current_settings["church_name"] or "Church", tone="accent", icon_name="building")],
        meta_badge=build_planning_center_status_badge(integration_summary),
    )

    with st.container(border=True):
        render_surface_header(
            "Planning Center connection",
            "Connection state and sync summary for the active Planning Center integration.",
            eyebrow="Integration",
        )
        render_html_block(
            build_key_value_card(
                [
                    ("Provider", integration_summary["provider"]),
                    ("Status", integration_summary["status"]),
                    ("Last sync", format_sync_timestamp(integration_summary["last_sync_at"])),
                    ("Members imported", integration_summary["members_imported"]),
                    ("Attendance imported", integration_summary["attendance_imported"]),
                ],
                compact=True,
            )
        )

        action_col1, action_col2 = st.columns(2, gap="small", vertical_alignment="bottom")
        with action_col1:
            if st.button(
                "Reconnect Planning Center",
                key="settings_reconnect_planning_center",
                width="stretch",
                type="secondary",
            ):
                try:
                    begin_planning_center_oauth()
                    st.session_state.connection_error = None
                except Exception:
                    st.session_state.connection_error = (
                        "Planning Center OAuth settings are missing. "
                        "Set PLANNING_CENTER_CLIENT_ID, PLANNING_CENTER_CLIENT_SECRET, "
                        "and PLANNING_CENTER_REDIRECT_URI in .env."
                    )

        with action_col2:
            sync_running = bool(st.session_state.get("planning_center_sync_running", False))
            if st.button(
                "Syncing…" if sync_running else "Run Sync Now",
                key="settings_run_sync_now",
                width="stretch",
                type="primary",
                disabled=sync_running,
            ):
                with st.spinner("Running Planning Center sync and risk refresh..."):
                    sync_result = run_refresh_pipeline()
                if not sync_result["ok"]:
                    st.error(sync_result["error"])
                    st.code(sync_result.get("output") or "No output")
                else:
                    st.session_state.last_refresh_logs = sync_result.get("logs")
                    st.session_state.last_sync_counts = sync_result.get("sync_counts")
                    st.success("Sync completed successfully.")
                    st.rerun()

        oauth_url = st.session_state.get("planning_center_oauth_url")
        if oauth_url:
            st.info("Authorize reconnect in Planning Center, then return to Shepherd.")
            st.markdown(f"[Reconnect Planning Center]({oauth_url})")
        if st.session_state.connection_error:
            st.error(st.session_state.connection_error)

    render_html_block("<div style='height:0.4rem;'></div>")

    overview_col, form_col = st.columns([1.02, 1.28], gap="medium")
    with overview_col:
        with st.container(border=True):
            render_surface_header(
                "Current configuration",
                "A concise summary of the rules Shepherd is actively using.",
                eyebrow="Overview",
            )
            render_html_block(
                build_key_value_card(
                    [
                        ("Church name", current_settings["church_name"]),
                        ("Service frequency", SERVICE_FREQUENCY_LABELS.get(current_settings["main_service_frequency"], current_settings["main_service_frequency"])),
                        ("Watch threshold", f"{current_settings['watch_missed_services']} missed services"),
                        ("At Risk threshold", f"{current_settings['at_risk_missed_services']} missed services"),
                        ("Critical threshold", f"{current_settings['critical_missed_services']} missed services"),
                        ("Follow-up tone", current_settings["preferred_followup_style"]),
                        ("Last updated", format_display_date(current_settings["updated_at"])),
                    ]
                )
            )

        render_html_block("<div style='height:0.75rem;'></div>")

        with st.container(border=True):
            render_surface_header(
                "Signals in use",
                "These flags affect how Shepherd augments member health analysis.",
                eyebrow="Feature signals",
            )
            render_html_block(
                f"""
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                    {build_inline_badge("Small groups enabled" if current_settings["small_groups_enabled"] else "Small groups disabled", tone="accent" if current_settings["small_groups_enabled"] else "neutral", icon_name="layers")}
                    {build_inline_badge("Volunteer tracking enabled" if current_settings["volunteer_tracking_enabled"] else "Volunteer tracking disabled", tone="healthy" if current_settings["volunteer_tracking_enabled"] else "neutral", icon_name="users-round")}
                    {build_inline_badge("Giving enabled" if current_settings["giving_enabled"] else "Giving disabled", tone="watch" if current_settings["giving_enabled"] else "neutral", icon_name="building")}
                    {build_inline_badge("Email engagement enabled" if current_settings["email_engagement_enabled"] else "Email engagement disabled", tone="accent" if current_settings["email_engagement_enabled"] else "neutral", icon_name="mail")}
                </div>
                """
            )

    with form_col:
        with st.container(border=True):
            render_surface_header(
                "Edit settings",
                "Update configuration without changing Supabase, authentication, syncs, or downstream scoring logic.",
                eyebrow="Editable controls",
            )

            with st.form("church_settings_form"):
                render_html_block("<div class='settings-form-section'>Church profile</div>")
                church_name = st.text_input(
                    "Church name",
                    value=current_settings["church_name"] or "",
                )

                main_service_frequency = st.selectbox(
                    "Main service frequency",
                    options=SERVICE_FREQUENCY_OPTIONS,
                    format_func=lambda option: SERVICE_FREQUENCY_LABELS.get(option, option.title()),
                    index=SERVICE_FREQUENCY_OPTIONS.index(
                        current_settings["main_service_frequency"]
                        if current_settings["main_service_frequency"] in SERVICE_FREQUENCY_OPTIONS
                        else "weekly"
                    ),
                )

                render_html_block("<div class='settings-form-section'>Risk thresholds</div>")
                threshold_col1, threshold_col2, threshold_col3 = st.columns(3)
                watch_missed_services = threshold_col1.number_input(
                    "Watch missed services",
                    min_value=1,
                    value=int(current_settings["watch_missed_services"] or 2),
                    step=1,
                )
                at_risk_missed_services = threshold_col2.number_input(
                    "At Risk missed services",
                    min_value=1,
                    value=int(current_settings["at_risk_missed_services"] or 4),
                    step=1,
                )
                critical_missed_services = threshold_col3.number_input(
                    "Critical missed services",
                    min_value=1,
                    value=int(current_settings["critical_missed_services"] or 6),
                    step=1,
                )

                render_html_block("<div class='settings-form-section'>Signal toggles</div>")
                signal_col1, signal_col2 = st.columns(2)
                small_groups_enabled = signal_col1.checkbox(
                    "Small groups enabled",
                    value=bool(current_settings["small_groups_enabled"]),
                )
                volunteer_tracking_enabled = signal_col2.checkbox(
                    "Volunteer tracking enabled",
                    value=bool(current_settings["volunteer_tracking_enabled"]),
                )
                giving_enabled = signal_col1.checkbox(
                    "Giving enabled",
                    value=bool(current_settings["giving_enabled"]),
                )
                email_engagement_enabled = signal_col2.checkbox(
                    "Email engagement enabled",
                    value=bool(current_settings["email_engagement_enabled"]),
                )

                render_html_block("<div class='settings-form-section'>Follow-up voice</div>")
                preferred_followup_style = st.text_area(
                    "Preferred follow-up style",
                    value=current_settings["preferred_followup_style"] or "",
                    height=120,
                )

                submitted = st.form_submit_button(
                    "Save settings",
                    type="primary",
                    width="stretch",
                )

        if submitted:
            update_church_settings(
                church_name=church_name,
                main_service_frequency=main_service_frequency,
                watch_missed_services=watch_missed_services,
                at_risk_missed_services=at_risk_missed_services,
                critical_missed_services=critical_missed_services,
                preferred_followup_style=preferred_followup_style,
                small_groups_enabled=small_groups_enabled,
                volunteer_tracking_enabled=volunteer_tracking_enabled,
                giving_enabled=giving_enabled,
                email_engagement_enabled=email_engagement_enabled,
            )
            st.success("Church settings saved.")


def main():
    st.set_page_config(
        page_title="Shepherd",
        layout="wide",
        page_icon=str(Path(__file__).parent / "assets" / "shepherd_mark.svg"),
    )
    inject_app_styles()
    init_db()
    init_session_state()

    if "current_page" not in st.session_state:
        st.session_state.current_page = "Dashboard"

    if not st.session_state.planning_center_connected:
        render_landing_screen()
        return

    if not st.session_state.onboarding_completed:
        render_onboarding_screen()
        return

    metrics, member_rows, settings, insights = load_dashboard_data()

    with st.sidebar:
        render_sidebar_nav(church_name=settings.get("church_name"))

    page = st.session_state.current_page
    if page == "Dashboard":
        render_dashboard_page(metrics, member_rows, settings, insights)
    elif page == "Priority Outreach":
        render_priority_outreach_page(member_rows, insights)
    elif page == "Members":
        render_members_page(member_rows)
    else:
        render_settings_page()


if __name__ == "__main__":
    main()
