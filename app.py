from datetime import datetime
import os
import subprocess
import sys

import pandas as pd
import plotly.express as px
import streamlit as st
from sqlalchemy import func

from ai.outreach import generate_recommendation, generate_outreach_message
from data.schema import SessionLocal, Member, Attendance, RiskScore, ChurchSettings, init_db
from utils.gmail_client import create_gmail_draft
from utils.planning_center import get_people


def inject_app_styles():
    st.markdown(
        """
        <style>
        :root {
            --bg-main: #121212;
            --bg-sidebar: #161616;
            --surface: #1A1A1A;
            --surface-elevated: #202020;
            --border-soft: rgba(255,255,255,0.08);
            --text-primary: rgba(255,255,255,0.92);
            --text-secondary: rgba(255,255,255,0.68);
            --text-muted: rgba(255,255,255,0.48);
            --accent: #7C83F6;
            --healthy: #5FAF8B;
            --watch: #C9A85D;
            --at-risk: #D98A5E;
            --critical: #D96B6B;
        }

        .stApp {
            color: var(--text-primary);
        }

        [data-testid="stAppViewContainer"] {
            background:
                radial-gradient(1000px 520px at 18% -10%, rgba(124,131,246,0.17), transparent 60%),
                radial-gradient(860px 500px at 82% 110%, rgba(95,175,139,0.08), transparent 64%),
                radial-gradient(720px 480px at 100% 30%, rgba(217,107,107,0.08), transparent 62%),
                #121212;
        }

        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #1A1A1A 0%, #161616 100%);
            border-right: 1px solid var(--border-soft);
        }

        [data-testid="stSidebar"] * {
            color: var(--text-primary);
        }

        [data-testid="stHeader"] {
            background: transparent;
        }

        [data-testid="stMainBlockContainer"] {
            padding-top: 1.1rem;
            max-width: 1240px;
        }

        h1, h2, h3, h4 {
            color: var(--text-primary);
            letter-spacing: 0.1px;
        }

        p, li, label, span {
            color: var(--text-secondary);
        }

        [data-testid="stCaptionContainer"] p {
            color: var(--text-muted);
        }

        [data-testid="stMetric"] {
            background: linear-gradient(160deg, #202020 0%, #1A1A1A 100%);
            border: 1px solid var(--border-soft);
            border-radius: 14px;
            padding: 0.6rem 0.8rem;
            box-shadow: 0 8px 24px rgba(0,0,0,0.22);
        }

        [data-testid="stMetricLabel"] p {
            color: var(--text-secondary);
        }

        [data-testid="stMetricValue"] {
            color: var(--text-primary);
        }

        [data-testid="stVerticalBlockBorderWrapper"] {
            border-color: var(--border-soft) !important;
            background: linear-gradient(160deg, rgba(32,32,32,0.92), rgba(26,26,26,0.94));
            border-radius: 14px;
            box-shadow: 0 8px 26px rgba(0,0,0,0.20);
        }

        .stDataFrame, [data-testid="stDataFrame"], [data-testid="stTable"] {
            background: #1A1A1A;
            border: 1px solid var(--border-soft);
            border-radius: 12px;
        }

        [data-testid="stExpander"] {
            border: 1px solid var(--border-soft);
            border-radius: 12px;
            background: #1A1A1A;
        }

        div.stButton > button,
        .stFormSubmitButton > button {
            background: #202020;
            color: var(--text-primary);
            border: 1px solid var(--border-soft);
            border-radius: 10px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.18);
            transition: all 0.18s ease;
        }

        div.stButton > button:hover,
        .stFormSubmitButton > button:hover {
            border-color: rgba(124,131,246,0.55);
            background: #242424;
            transform: translateY(-1px);
            box-shadow: 0 8px 22px rgba(124,131,246,0.15);
        }

        div.stButton > button:focus-visible,
        .stFormSubmitButton > button:focus-visible {
            outline: 2px solid rgba(124,131,246,0.75);
            outline-offset: 2px;
            box-shadow: 0 0 0 4px rgba(124,131,246,0.18);
        }

        div.stButton > button[kind="primary"],
        .stFormSubmitButton > button[kind="primary"] {
            background: linear-gradient(135deg, rgba(124,131,246,0.9), rgba(108,116,236,0.88));
            border-color: rgba(124,131,246,0.82);
            color: rgba(255,255,255,0.97);
            box-shadow: 0 10px 26px rgba(124,131,246,0.24);
        }

        div.stButton > button[kind="primary"]:hover,
        .stFormSubmitButton > button[kind="primary"]:hover {
            background: linear-gradient(135deg, rgba(130,138,248,0.95), rgba(113,122,240,0.93));
            border-color: rgba(144,151,250,0.92);
            box-shadow: 0 12px 28px rgba(124,131,246,0.28);
        }

        [class*="st-key-priority_draft_"] div.stButton > button {
            border-color: rgba(217,107,107,0.50);
            color: rgba(255,233,233,0.94);
            background: linear-gradient(135deg, rgba(217,107,107,0.24), rgba(32,32,32,0.95));
        }

        [class*="st-key-priority_draft_"] div.stButton > button:hover {
            border-color: rgba(217,107,107,0.75);
            box-shadow: 0 8px 22px rgba(217,107,107,0.20);
        }

        .hero-card {
            border: 1px solid var(--border-soft);
            border-radius: 16px;
            padding: 2rem 1.6rem;
            background:
                radial-gradient(500px 220px at 10% -15%, rgba(124,131,246,0.20), transparent 65%),
                linear-gradient(180deg, rgba(32,32,32,0.95), rgba(26,26,26,0.95));
            box-shadow: 0 16px 40px rgba(0,0,0,0.28);
        }

        .hero-card {
            position: relative;
            overflow: hidden;
        }

        .hero-title {
            font-size: 2.1rem;
            font-weight: 700;
            margin-bottom: 0.4rem;
            text-align: center;
            color: var(--text-primary);
        }

        .hero-subtitle {
            font-size: 1rem;
            color: var(--text-secondary);
            text-align: center;
            margin-bottom: 1.2rem;
        }

        .step-pill {
            text-align: center;
            font-size: 0.85rem;
            padding: 0.45rem 0.6rem;
            border: 1px solid var(--border-soft);
            border-radius: 999px;
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
            background: rgba(255,255,255,0.02);
        }

        .step-pill.active {
            border-color: rgba(124,131,246,0.55);
            background: rgba(124,131,246,0.16);
            font-weight: 600;
            color: var(--text-primary);
            box-shadow: 0 0 0 1px rgba(124,131,246,0.18) inset;
        }

        .step-pill.complete {
            border-color: rgba(95,175,139,0.50);
            background: rgba(95,175,139,0.16);
            font-weight: 600;
            color: var(--text-primary);
        }

        [data-baseweb="select"] > div,
        .stTextInput input,
        .stTextArea textarea,
        .stNumberInput input {
            background: #202020 !important;
            color: var(--text-primary) !important;
            border: 1px solid var(--border-soft) !important;
            border-radius: 10px !important;
        }

        [data-baseweb="select"] > div:hover,
        .stTextInput input:hover,
        .stTextArea textarea:hover,
        .stNumberInput input:hover {
            border-color: rgba(124,131,246,0.45) !important;
        }

        .stCheckbox label span {
            color: var(--text-secondary);
        }

        .stAlert {
            border-radius: 12px;
            border: 1px solid var(--border-soft);
        }

        .dashboard-metric-card {
            background: linear-gradient(165deg, rgba(32,32,32,0.98), rgba(26,26,26,0.97));
            border: 1px solid var(--border-soft);
            border-radius: 14px;
            padding: 0.95rem 1rem 0.9rem 1rem;
            box-shadow: 0 10px 22px rgba(0,0,0,0.22);
            position: relative;
            overflow: hidden;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }

        .dashboard-metric-card::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            width: 3px;
            background: var(--accent-color, rgba(124,131,246,0.9));
            opacity: 0.92;
        }

        .dashboard-metric-card:hover {
            border-color: rgba(255,255,255,0.14);
            transform: translateY(-1px);
            box-shadow: 0 14px 28px rgba(0,0,0,0.28);
        }

        .dashboard-metric-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            letter-spacing: 0.24px;
            margin-bottom: 0.45rem;
            font-weight: 500;
        }

        .dashboard-metric-value {
            font-size: 1.8rem;
            line-height: 1;
            color: var(--text-primary);
            font-weight: 650;
        }

        .dashboard-panel-title {
            font-size: 1.05rem;
            color: var(--text-primary);
            margin-bottom: 0.2rem;
            font-weight: 600;
        }

        .dashboard-panel-subtitle {
            font-size: 0.82rem;
            color: var(--text-muted);
            margin-bottom: 0.6rem;
        }

        .crm-section-title {
            font-size: 0.92rem;
            color: var(--text-secondary);
            letter-spacing: 0.24px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 0.55rem;
        }

        .crm-member-card {
            border: 1px solid var(--border-soft);
            border-radius: 12px;
            background: linear-gradient(165deg, rgba(32,32,32,0.98), rgba(26,26,26,0.97));
            padding: 0.75rem 0.85rem;
            margin-bottom: 0.42rem;
            box-shadow: 0 6px 18px rgba(0,0,0,0.16);
            transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }

        .crm-member-card:hover {
            border-color: rgba(124,131,246,0.42);
            box-shadow: 0 10px 22px rgba(124,131,246,0.14);
            transform: translateY(-1px);
        }

        .crm-member-card.active {
            border-color: rgba(124,131,246,0.72);
            box-shadow: 0 0 0 1px rgba(124,131,246,0.24) inset, 0 12px 24px rgba(124,131,246,0.18);
            background: linear-gradient(165deg, rgba(43,46,76,0.56), rgba(31,31,44,0.50));
        }

        .crm-member-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 0.8rem;
        }

        .crm-member-name {
            color: var(--text-primary);
            font-size: 0.98rem;
            font-weight: 600;
            line-height: 1.2;
        }

        .crm-member-email {
            color: var(--text-muted);
            font-size: 0.79rem;
            margin-top: 0.14rem;
            overflow-wrap: anywhere;
        }

        .crm-member-score {
            min-width: 52px;
            text-align: right;
            color: var(--text-primary);
            font-size: 1.05rem;
            font-weight: 700;
            letter-spacing: 0.12px;
        }

        .crm-member-meta {
            margin-top: 0.52rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .crm-member-status {
            font-size: 0.75rem;
            color: var(--text-muted);
            padding: 0.15rem 0.42rem;
            border: 1px solid var(--border-soft);
            border-radius: 999px;
            background: rgba(255,255,255,0.03);
        }

        .crm-detail-heading {
            color: var(--text-primary);
            font-size: 1.45rem;
            font-weight: 650;
            line-height: 1.12;
            margin-bottom: 0.26rem;
            letter-spacing: 0.14px;
        }

        .crm-detail-subheading {
            color: var(--text-secondary);
            font-size: 0.9rem;
            margin-bottom: 0.72rem;
        }

        .crm-detail-block {
            border: 1px solid var(--border-soft);
            border-radius: 10px;
            background: rgba(255,255,255,0.015);
            padding: 0.65rem 0.72rem;
            margin-bottom: 0.62rem;
        }

        .crm-detail-kv {
            color: var(--text-secondary);
            font-size: 0.86rem;
            margin-bottom: 0.22rem;
        }

        .crm-detail-kv strong {
            color: var(--text-primary);
            font-weight: 600;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def get_tier_color(tier):
    tier_colors = {
        "Healthy": "#5FAF8B",
        "Watch": "#C9A85D",
        "At Risk": "#D98A5E",
        "Critical": "#D96B6B",
    }
    return tier_colors.get(tier, "#6B7280")


def render_tier_badge(tier):
    color = get_tier_color(tier)
    return (
        f"<span style='background:{color}; color:white; padding:0.2rem 0.55rem; "
        f"border-radius:999px; font-size:0.8rem; font-weight:600;'>{tier}</span>"
    )


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


def load_dashboard_data():
    db = SessionLocal()
    try:
        total_members = db.query(Member).count()

        healthy_count = db.query(RiskScore).filter(RiskScore.tier == "Healthy").count()
        watch_count = db.query(RiskScore).filter(RiskScore.tier == "Watch").count()
        at_risk_count = db.query(RiskScore).filter(RiskScore.tier == "At Risk").count()
        critical_count = db.query(RiskScore).filter(RiskScore.tier == "Critical").count()

        rows = (
            db.query(Member, RiskScore)
            .outerjoin(RiskScore, Member.pco_id == RiskScore.member_pco_id)
            .all()
        )

        attendance_stats_rows = (
            db.query(
                Attendance.member_pco_id,
                func.count(Attendance.id),
                func.max(Attendance.attended_at),
            )
            .group_by(Attendance.member_pco_id)
            .all()
        )
        attendance_stats = {
            member_pco_id: {
                "attendance_count": attendance_count,
                "last_attended": last_attended,
            }
            for member_pco_id, attendance_count, last_attended in attendance_stats_rows
        }

        member_rows = []
        for member, risk in rows:
            member_attendance = attendance_stats.get(member.pco_id, {})
            member_rows.append(
                {
                    "member": member,
                    "risk": risk,
                    "member_pco_id": member.pco_id,
                    "Member name": member.name,
                    "Email": member.email,
                    "Status": member.status,
                    "Risk score": risk.score if risk else 0,
                    "Tier": risk.tier if risk else "Healthy",
                    "Reasons": risk.reasons if risk else "No reasons available",
                    "Recommendation": generate_recommendation(member, risk),
                    "Attendance count": member_attendance.get("attendance_count", 0),
                    "Last attended": member_attendance.get("last_attended"),
                }
            )

        metrics = {
            "total_members": total_members,
            "healthy": healthy_count,
            "watch": watch_count,
            "at_risk": at_risk_count,
            "critical": critical_count,
        }
        return metrics, member_rows
    finally:
        db.close()


def load_church_settings():
    db = SessionLocal()
    try:
        settings = db.query(ChurchSettings).first()
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
        settings = db.query(ChurchSettings).first()
        if settings is None:
            settings = ChurchSettings()
            db.add(settings)

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
    if "planning_center_connected" not in st.session_state:
        st.session_state.planning_center_connected = False
    if "onboarding_completed" not in st.session_state:
        st.session_state.onboarding_completed = False
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


def set_outreach_message(member_pco_id, message):
    st.session_state.outreach_messages[member_pco_id] = message


def get_outreach_message(member_pco_id):
    return st.session_state.outreach_messages.get(member_pco_id)


def format_last_attended(value):
    if value is None:
        return "No attendance history"
    return value.strftime("%Y-%m-%d")


def run_refresh_pipeline():
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

    return {
        "ok": True,
        "logs": {
            "ingest": ingest_output,
            "save_risk": risk_output,
        },
    }


def render_refresh_button():
    refresh_col, _ = st.columns([1, 5])
    with refresh_col:
        refresh_clicked = st.button("Refresh Data", type="primary", width="stretch")

    if refresh_clicked:
        with st.spinner("Running data ingest and risk scoring..."):
            result = run_refresh_pipeline()

        if not result["ok"]:
            st.error(result["error"])
            st.code(result.get("output") or "No output")
            st.stop()

        st.session_state.last_refresh_logs = result["logs"]
        st.session_state.show_refresh_success = True

    if st.session_state.show_refresh_success:
        st.success("Data refreshed successfully.")
        st.session_state.show_refresh_success = False

    if st.session_state.last_refresh_logs:
        with st.expander("Refresh logs"):
            st.subheader("`python -m data.ingest`")
            st.code(st.session_state.last_refresh_logs.get("ingest") or "No output")
            st.subheader("`python -m scoring.save_risk`")
            st.code(st.session_state.last_refresh_logs.get("save_risk") or "No output")


def render_onboarding_progress():
    current_step = 1
    if st.session_state.planning_center_connected:
        current_step = 2
    if st.session_state.onboarding_completed:
        current_step = 3

    st.progress(current_step / 3, text=f"Step {current_step} of 3")

    labels = [
        "Connect Planning Center",
        "Church Onboarding",
        "Dashboard Access",
    ]
    step_cols = st.columns(3)
    for index, label in enumerate(labels, start=1):
        status_class = ""
        prefix = "○"
        if index < current_step:
            status_class = "complete"
            prefix = "✓"
        elif index == current_step:
            status_class = "active"
            prefix = "●"

        step_cols[index - 1].markdown(
            f"<div class='step-pill {status_class}'>{prefix} {index}. {label}</div>",
            unsafe_allow_html=True,
        )


def try_connect_planning_center():
    pco_client_id = os.getenv("PCO_CLIENT_ID")
    pco_client_secret = os.getenv("PCO_CLIENT_SECRET")
    if not pco_client_id or not pco_client_secret:
        return {
            "ok": False,
            "error": "Planning Center credentials are missing. Set PCO_CLIENT_ID and PCO_CLIENT_SECRET in .env.",
            "logs": None,
        }

    try:
        get_people(limit=1)
    except Exception as error:
        return {
            "ok": False,
            "error": f"Planning Center connection failed: {error}",
            "logs": None,
        }

    pipeline_result = run_refresh_pipeline()
    if not pipeline_result["ok"]:
        return {
            "ok": False,
            "error": f"Connected to Planning Center, but setup failed: {pipeline_result['error']}",
            "logs": {"pipeline_output": pipeline_result.get("output") or ""},
        }

    return {
        "ok": True,
        "error": None,
        "logs": pipeline_result.get("logs"),
    }


def render_landing_screen():
    st.title("Shepherd")
    render_onboarding_progress()
    st.divider()

    left, center, right = st.columns([1, 1.7, 1])
    with center:
        st.markdown(
            """
            <div class="hero-card">
                <div class="hero-title">🐑 Shepherd</div>
                <div class="hero-subtitle">
                    AI-powered church engagement on top of Planning Center.
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.write(
            "Connect your Planning Center account to import members and attendance, "
            "calculate engagement risk, and unlock your dashboard."
        )

        connect_clicked = st.button(
            "Connect Planning Center",
            type="primary",
            width="stretch",
            key="connect_planning_center_button",
        )

        if connect_clicked:
            with st.spinner("Validating Planning Center and loading initial data..."):
                connection_result = try_connect_planning_center()

            if connection_result["ok"]:
                st.session_state.planning_center_connected = True
                st.session_state.last_refresh_logs = connection_result.get("logs")
                st.session_state.connection_error = None
                st.session_state.connection_logs = connection_result.get("logs")
                st.success("Planning Center connected. Continue onboarding.")
                st.rerun()
            else:
                st.session_state.connection_error = connection_result["error"]
                st.session_state.connection_logs = connection_result.get("logs")

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
    st.title("Church Onboarding")
    render_onboarding_progress()
    st.divider()

    settings = load_church_settings() or {}

    default_church_name = settings.get("church_name") or "Shepherd Demo Church"
    default_main_frequency = settings.get("main_service_frequency") or "weekly"
    default_watch = int(settings.get("watch_missed_services") or 2)
    default_at_risk = int(settings.get("at_risk_missed_services") or 4)
    default_critical = int(settings.get("critical_missed_services") or 6)
    default_small_groups_enabled = bool(settings.get("small_groups_enabled", False))
    default_volunteer_tracking_enabled = bool(settings.get("volunteer_tracking_enabled", False))
    default_followup_style = settings.get("preferred_followup_style") or "soft and friendly"
    default_giving_enabled = bool(settings.get("giving_enabled", False))
    default_email_engagement_enabled = bool(settings.get("email_engagement_enabled", False))

    left, center, right = st.columns([1, 1.9, 1])
    with center:
        with st.container(border=True):
            st.subheader("Tell us about your church")
            st.caption("These settings personalize risk scoring and outreach.")

            with st.form("onboarding_form"):
                church_name = st.text_input("Church name", value=default_church_name)
                main_service_frequency = st.selectbox(
                    "Main service frequency",
                    options=["weekly", "twice_weekly", "monthly"],
                    index=["weekly", "twice_weekly", "monthly"].index(
                        default_main_frequency if default_main_frequency in ["weekly", "twice_weekly", "monthly"] else "weekly"
                    ),
                )

                col1, col2, col3 = st.columns(3)
                watch_missed_services = col1.number_input(
                    "Watch threshold",
                    min_value=1,
                    step=1,
                    value=default_watch,
                )
                at_risk_missed_services = col2.number_input(
                    "At Risk threshold",
                    min_value=1,
                    step=1,
                    value=default_at_risk,
                )
                critical_missed_services = col3.number_input(
                    "Critical threshold",
                    min_value=1,
                    step=1,
                    value=default_critical,
                )

                small_groups_enabled = st.checkbox(
                    "Small groups enabled",
                    value=default_small_groups_enabled,
                )
                volunteer_tracking_enabled = st.checkbox(
                    "Volunteer tracking enabled",
                    value=default_volunteer_tracking_enabled,
                )
                preferred_followup_style = st.text_area(
                    "Preferred follow-up style",
                    value=default_followup_style,
                )

                submitted = st.form_submit_button("Complete Onboarding", type="primary", width="stretch")

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
                    giving_enabled=default_giving_enabled,
                    email_engagement_enabled=default_email_engagement_enabled,
                )
                st.session_state.onboarding_completed = True
                st.success("Onboarding completed. Launching dashboard...")
                st.rerun()


def render_dashboard_metric_card(label, value, accent_color):
    st.markdown(
        f"""
        <div class="dashboard-metric-card" style="--accent-color: {accent_color};">
            <div class="dashboard-metric-label">{label}</div>
            <div class="dashboard-metric-value">{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_dashboard_page(metrics, member_rows):
    st.title("Shepherd Dashboard")
    render_refresh_button()
    st.divider()

    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        render_dashboard_metric_card("Total Members", metrics["total_members"], "#7C83F6")
    with col2:
        render_dashboard_metric_card("Healthy", metrics["healthy"], "#5FAF8B")
    with col3:
        render_dashboard_metric_card("Watch", metrics["watch"], "#C9A85D")
    with col4:
        render_dashboard_metric_card("At Risk", metrics["at_risk"], "#D98A5E")
    with col5:
        render_dashboard_metric_card("Critical", metrics["critical"], "#D96B6B")

    st.divider()
    chart_col, top_col = st.columns([1.4, 1.1])

    with chart_col:
        with st.container(border=True):
            st.markdown('<div class="dashboard-panel-title">Risk Distribution</div>', unsafe_allow_html=True)
            st.markdown(
                '<div class="dashboard-panel-subtitle">Current member risk mix by tier</div>',
                unsafe_allow_html=True,
            )
            risk_distribution = pd.DataFrame(
                [
                    {"Tier": "Healthy", "Count": metrics["healthy"]},
                    {"Tier": "Watch", "Count": metrics["watch"]},
                    {"Tier": "At Risk", "Count": metrics["at_risk"]},
                    {"Tier": "Critical", "Count": metrics["critical"]},
                ]
            )

            if int(risk_distribution["Count"].sum()) == 0:
                st.info("No risk data available for chart.")
            else:
                pie_chart = px.pie(
                    risk_distribution,
                    names="Tier",
                    values="Count",
                    color="Tier",
                    color_discrete_map={
                        "Healthy": "#5FAF8B",
                        "Watch": "#C9A85D",
                        "At Risk": "#D98A5E",
                        "Critical": "#D96B6B",
                    },
                )
                pie_chart.update_traces(
                    textposition="inside",
                    textinfo="percent+label",
                    marker=dict(line=dict(color="rgba(255,255,255,0.08)", width=1)),
                )
                pie_chart.update_layout(
                    margin=dict(t=10, l=10, r=10, b=10),
                    paper_bgcolor="#1A1A1A",
                    plot_bgcolor="#1A1A1A",
                    font=dict(color="rgba(255,255,255,0.88)"),
                    legend=dict(
                        orientation="h",
                        yanchor="bottom",
                        y=-0.2,
                        xanchor="center",
                        x=0.5,
                        font=dict(color="rgba(255,255,255,0.72)"),
                    ),
                )
                st.plotly_chart(pie_chart)

    with top_col:
        with st.container(border=True):
            st.markdown('<div class="dashboard-panel-title">Top 10 Highest-Risk Members</div>', unsafe_allow_html=True)
            st.markdown(
                '<div class="dashboard-panel-subtitle">Members prioritized for follow-up</div>',
                unsafe_allow_html=True,
            )
            top_10_rows = sorted(
                member_rows,
                key=lambda row: int(row["Risk score"] or 0),
                reverse=True,
            )[:10]

            if not top_10_rows:
                st.info("No members available.")
            else:
                top_10_data = [
                    {
                        "Member name": row["Member name"],
                        "Risk score": row["Risk score"],
                        "Tier": row["Tier"],
                        "Reasons": row["Reasons"],
                        "Recommendation": row["Recommendation"],
                    }
                    for row in top_10_rows
                ]
                st.dataframe(pd.DataFrame(top_10_data), width="stretch", hide_index=True)


def render_priority_outreach_page(member_rows):
    st.title("Priority Outreach")
    st.caption("Members with risk score 40 or higher")

    priority_rows = [row for row in member_rows if int(row["Risk score"] or 0) >= 40]
    priority_rows = sorted(
        priority_rows,
        key=lambda row: int(row["Risk score"] or 0),
        reverse=True,
    )

    if not priority_rows:
        st.info("No members currently need priority outreach.")
        return

    for row in priority_rows:
        member = row["member"]
        risk = row["risk"]
        member_pco_id = row["member_pco_id"]

        with st.container(border=True):
            top_left, top_right = st.columns([3, 1])
            top_left.markdown(f"### {row['Member name']}")
            top_right.metric("Risk Score", row["Risk score"])

            st.markdown(f"**Email:** {row['Email'] or 'N/A'}")
            st.markdown(f"**Tier:** {render_tier_badge(row['Tier'])}", unsafe_allow_html=True)
            st.markdown(f"**Reasons:** {row['Reasons']}")
            st.markdown(f"**Recommendation:** {row['Recommendation']}")

            if st.button("Generate Outreach", key=f"priority_generate_{member_pco_id}"):
                message = generate_outreach_message(member, risk)
                set_outreach_message(member_pco_id, message)

            if st.button("Create Gmail Draft", key=f"priority_draft_{member_pco_id}"):
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

            outreach_message = get_outreach_message(member_pco_id)
            if outreach_message:
                st.info(outreach_message)

        st.divider()


def filter_member_rows(member_rows, search_query, tier_filter):
    search_text = (search_query or "").strip().lower()
    filtered = []

    for row in member_rows:
        member_name = (row["Member name"] or "").lower()

        if search_text and search_text not in member_name:
            continue

        if tier_filter != "All" and row["Tier"] != tier_filter:
            continue

        filtered.append(row)

    return sorted(
        filtered,
        key=lambda row: (-int(row["Risk score"] or 0), row["Member name"] or ""),
    )


def render_member_detail_panel(selected_row):
    selected_member = selected_row["member"]
    selected_risk = selected_row["risk"]
    selected_member_id = selected_row["member_pco_id"]

    st.markdown(f"<div class='crm-detail-heading'>{selected_row['Member name']}</div>", unsafe_allow_html=True)
    st.markdown(
        f"<div class='crm-detail-subheading'>{selected_row['Email'] or 'No email on file'}</div>",
        unsafe_allow_html=True,
    )

    profile_col, attendance_col = st.columns(2)
    with profile_col:
        st.markdown("<div class='crm-detail-block'>", unsafe_allow_html=True)
        st.markdown(f"<div class='crm-detail-kv'><strong>Status:</strong> {selected_row['Status']}</div>", unsafe_allow_html=True)
        st.markdown(
            f"<div class='crm-detail-kv'><strong>Risk score:</strong> {selected_row['Risk score']}</div>",
            unsafe_allow_html=True,
        )
        st.markdown(
            f"<div class='crm-detail-kv'><strong>Tier:</strong> {render_tier_badge(selected_row['Tier'])}</div>",
            unsafe_allow_html=True,
        )
        st.markdown("</div>", unsafe_allow_html=True)

    with attendance_col:
        st.markdown("<div class='crm-detail-block'>", unsafe_allow_html=True)
        st.markdown(
            f"<div class='crm-detail-kv'><strong>Attendance records:</strong> {selected_row['Attendance count']}</div>",
            unsafe_allow_html=True,
        )
        st.markdown(
            f"<div class='crm-detail-kv'><strong>Last attended:</strong> {format_last_attended(selected_row['Last attended'])}</div>",
            unsafe_allow_html=True,
        )
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div class='crm-detail-block'>", unsafe_allow_html=True)
    st.markdown(
        f"<div class='crm-detail-kv'><strong>Reasons:</strong> {selected_row['Reasons']}</div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f"<div class='crm-detail-kv'><strong>Recommendation:</strong> {selected_row['Recommendation']}</div>",
        unsafe_allow_html=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)

    action_col1, action_col2 = st.columns(2)
    with action_col1:
        if st.button("Generate Outreach Message", key=f"detail_generate_{selected_member_id}", width="stretch"):
            message = generate_outreach_message(selected_member, selected_risk)
            set_outreach_message(selected_member_id, message)

    with action_col2:
        if st.button("Create Gmail Draft", key=f"detail_draft_{selected_member_id}", width="stretch"):
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
        st.info(outreach_message)


def render_members_page(member_rows):
    st.title("Members")

    search_col, filter_col = st.columns([2, 1])
    with search_col:
        search_query = st.text_input("Search by member name", key="member_search_query")
    with filter_col:
        tier_filter = st.selectbox(
            "Filter by tier",
            options=["All", "Healthy", "Watch", "At Risk", "Critical"],
            key="member_tier_filter",
        )

    filtered_rows = filter_member_rows(member_rows, search_query, tier_filter)

    st.divider()
    if not filtered_rows:
        st.info("No members match the current search/filter.")
        return

    member_options = [row["member_pco_id"] for row in filtered_rows]
    if st.session_state.selected_member_id not in member_options:
        st.session_state.selected_member_id = member_options[0]

    list_col, detail_col = st.columns([1.05, 1.65], gap="large")

    with list_col:
        st.markdown("<div class='crm-section-title'>Member Directory</div>", unsafe_allow_html=True)
        for row in filtered_rows:
            member_id = row["member_pco_id"]
            member_name = row["Member name"] or "Unknown"
            member_email = row["Email"] or "No email"
            member_score = int(row["Risk score"] or 0)
            member_status = row["Status"] or "unknown"
            is_selected = member_id == st.session_state.selected_member_id
            card_class = "crm-member-card active" if is_selected else "crm-member-card"

            st.markdown(
                (
                    f"<div class='{card_class}'>"
                    f"<div class='crm-member-row'>"
                    f"<div><div class='crm-member-name'>{member_name}</div>"
                    f"<div class='crm-member-email'>{member_email}</div></div>"
                    f"<div class='crm-member-score'>{member_score}</div>"
                    f"</div>"
                    f"<div class='crm-member-meta'>{render_tier_badge(row['Tier'])}"
                    f"<span class='crm-member-status'>{member_status}</span></div>"
                    f"</div>"
                ),
                unsafe_allow_html=True,
            )

            if st.button(
                "Selected" if is_selected else "View Member",
                key=f"crm_select_member_{member_id}",
                type="primary" if is_selected else "secondary",
                width="stretch",
            ):
                st.session_state.selected_member_id = member_id

    selected_row = next(
        (row for row in filtered_rows if row["member_pco_id"] == st.session_state.selected_member_id),
        None,
    )

    with detail_col:
        st.markdown("<div class='crm-section-title'>Member Detail</div>", unsafe_allow_html=True)
        if selected_row:
            with st.container(border=True):
                render_member_detail_panel(selected_row)


def render_settings_page():
    st.title("Settings")
    current_settings = load_church_settings()

    if current_settings is None:
        st.error("Unable to load church settings.")
        return

    st.subheader("Current Settings")
    st.json(
        {
            "church_name": current_settings["church_name"],
            "main_service_frequency": current_settings["main_service_frequency"],
            "watch_missed_services": current_settings["watch_missed_services"],
            "at_risk_missed_services": current_settings["at_risk_missed_services"],
            "critical_missed_services": current_settings["critical_missed_services"],
            "preferred_followup_style": current_settings["preferred_followup_style"],
            "small_groups_enabled": current_settings["small_groups_enabled"],
            "volunteer_tracking_enabled": current_settings["volunteer_tracking_enabled"],
            "giving_enabled": current_settings["giving_enabled"],
            "email_engagement_enabled": current_settings["email_engagement_enabled"],
            "updated_at": str(current_settings["updated_at"]),
        }
    )

    st.divider()
    with st.form("church_settings_form"):
        church_name = st.text_input(
            "Church name",
            value=current_settings["church_name"] or "",
        )

        main_service_frequency = st.selectbox(
            "Main service frequency",
            options=["weekly", "twice_weekly", "monthly"],
            index=["weekly", "twice_weekly", "monthly"].index(
                current_settings["main_service_frequency"]
                if current_settings["main_service_frequency"] in ["weekly", "twice_weekly", "monthly"]
                else "weekly"
            ),
        )

        col1, col2, col3 = st.columns(3)
        watch_missed_services = col1.number_input(
            "Watch missed services",
            min_value=1,
            value=int(current_settings["watch_missed_services"] or 2),
            step=1,
        )
        at_risk_missed_services = col2.number_input(
            "At Risk missed services",
            min_value=1,
            value=int(current_settings["at_risk_missed_services"] or 4),
            step=1,
        )
        critical_missed_services = col3.number_input(
            "Critical missed services",
            min_value=1,
            value=int(current_settings["critical_missed_services"] or 6),
            step=1,
        )

        preferred_followup_style = st.text_area(
            "Preferred follow-up style",
            value=current_settings["preferred_followup_style"] or "",
        )

        small_groups_enabled = st.checkbox(
            "Small groups enabled",
            value=bool(current_settings["small_groups_enabled"]),
        )
        volunteer_tracking_enabled = st.checkbox(
            "Volunteer tracking enabled",
            value=bool(current_settings["volunteer_tracking_enabled"]),
        )
        giving_enabled = st.checkbox(
            "Giving enabled",
            value=bool(current_settings["giving_enabled"]),
        )
        email_engagement_enabled = st.checkbox(
            "Email engagement enabled",
            value=bool(current_settings["email_engagement_enabled"]),
        )

        submitted = st.form_submit_button("Save settings", type="primary")

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
    st.set_page_config(page_title="Shepherd Dashboard", layout="wide")
    inject_app_styles()
    init_db()
    init_session_state()

    if not st.session_state.planning_center_connected:
        render_landing_screen()
        return

    if not st.session_state.onboarding_completed:
        render_onboarding_screen()
        return

    with st.sidebar:
        st.title("Shepherd")
        page = st.radio(
            "Navigation",
            options=["Dashboard", "Priority Outreach", "Members", "Settings"],
            key="nav_page",
        )

    metrics, member_rows = load_dashboard_data()

    if page == "Dashboard":
        render_dashboard_page(metrics, member_rows)
    elif page == "Priority Outreach":
        render_priority_outreach_page(member_rows)
    elif page == "Members":
        render_members_page(member_rows)
    else:
        render_settings_page()


if __name__ == "__main__":
    main()
