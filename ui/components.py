from datetime import datetime
from html import escape
from pathlib import Path
from textwrap import dedent

import streamlit as st

from .icons import brand_mark_svg, icon_svg


TIER_COLOR_MAP = {
    "Healthy": "#1A8B6A",
    "Watch": "#9A7215",
    "At Risk": "#B85E2A",
    "Critical": "#C23B3B",
}

TONE_COLOR_MAP = {
    "accent": "#006B55",
    "healthy": "#1A8B6A",
    "watch": "#9A7215",
    "at-risk": "#B85E2A",
    "critical": "#C23B3B",
    "neutral": "#6B6355",
}


def escape_html(value):
    if value is None or value == "":
        return "—"
    return escape(str(value))


def clean_html(html):
    return dedent(str(html)).strip()


def format_display_date(value):
    if value is None:
        return "No attendance history"
    if isinstance(value, datetime):
        return value.strftime("%b %d, %Y")
    return escape_html(value)


def format_relative_date(value):
    if value is None:
        return "No recent activity"
    if not isinstance(value, datetime):
        return escape_html(value)

    now = datetime.utcnow()
    delta_days = max((now - value).days, 0)
    if delta_days == 0:
        return "Today"
    if delta_days == 1:
        return "1 day ago"
    if delta_days < 7:
        return f"{delta_days} days ago"
    if delta_days < 30:
        weeks = max(delta_days // 7, 1)
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    months = max(delta_days // 30, 1)
    return f"{months} month{'s' if months != 1 else ''} ago"


def get_tier_color(tier):
    return TIER_COLOR_MAP.get(tier, "#8891A4")


def get_tier_glow(tier):
    glows = {
        "Healthy": "rgba(26,139,106,0.10)",
        "Watch": "rgba(154,114,21,0.10)",
        "At Risk": "rgba(184,94,42,0.12)",
        "Critical": "rgba(194,59,59,0.12)",
    }
    return glows.get(tier, "rgba(0,107,85,0.08)")


def get_tier_border_color(tier):
    borders = {
        "Healthy": "rgba(26,139,106,0.20)",
        "Watch": "rgba(154,114,21,0.18)",
        "At Risk": "rgba(184,94,42,0.20)",
        "Critical": "rgba(194,59,59,0.22)",
    }
    return borders.get(tier, "rgba(11,95,74,0.10)")


def build_inline_badge(text, tone="neutral", icon_name=None, pulse=False):
    classes = ["inline-badge", f"tone-{tone}"]
    if pulse:
        classes.append("is-pulsing")
    icon_html = icon_svg(icon_name, size=12, class_name="badge-icon") if icon_name else ""
    return f"<span class='{' '.join(classes)}'>{icon_html}<span>{escape_html(text)}</span></span>"


def build_tier_badge(tier):
    tone = {
        "Healthy": "healthy",
        "Watch": "watch",
        "At Risk": "at-risk",
        "Critical": "critical",
    }.get(tier, "neutral")
    return build_inline_badge(tier, tone=tone, pulse=tier == "Critical")


def render_html_block(html):
    st.html(clean_html(html), width="stretch")


def render_page_header(title, subtitle=None, eyebrow=None, show_date=False, chips=None):
    chips = chips or []
    date_html = ""
    if show_date:
        date_html = f"<div class='page-meta'>{datetime.now().strftime('%A, %B %d, %Y')}</div>"

    chips_html = "".join(chips)
    eyebrow_html = f"<div class='page-kicker'>{escape_html(eyebrow)}</div>" if eyebrow else ""
    subtitle_html = f"<div class='page-subtitle'>{escape_html(subtitle)}</div>" if subtitle else ""
    render_html_block(
        f"""
        <div class="page-header">
            <div class="page-header-main">
                {eyebrow_html}
                <div class="page-title-row">
                    <span class="page-title">{escape_html(title)}</span>
                    <div class="page-chip-row">{chips_html}</div>
                </div>
                {subtitle_html}
            </div>
            {date_html}
        </div>
        """
    )


def render_sidebar_nav(church_name=None):
    logo_path = Path(__file__).resolve().parents[1] / "assets" / "logo.png"
    if logo_path.exists():
        st.image(str(logo_path), width=122)
    else:
        render_html_block(brand_mark_svg(size=34))

    current = st.session_state.get("current_page", "Dashboard")
    nav_items = [
        ("Dashboard", "dashboard"),
        ("Priority Outreach", "priority"),
        ("Members", "members"),
        ("Settings", "settings"),
    ]

    for label, icon_name in nav_items:
        is_active = current == label
        icon_col, button_col = st.columns([0.17, 0.83], gap="small", vertical_alignment="center")
        with icon_col:
            render_html_block(
                f"<div class='sidebar-icon {'active' if is_active else ''}'>{icon_svg(icon_name, size=14)}</div>"
            )
        with button_col:
            if st.button(
                label,
                key=f"nav_{label.replace(' ', '_').lower()}",
                width="stretch",
                type="primary" if is_active else "secondary",
            ):
                st.session_state.current_page = label
                st.rerun()


def render_metric_card(label, value, supporting, tone="accent", icon_name="sparkles", delta=None):
    tone_color = TONE_COLOR_MAP.get(tone, TONE_COLOR_MAP["accent"])
    delta_html = f"<div class='metric-delta'>{escape_html(delta)}</div>" if delta else ""
    render_html_block(
        f"""
        <div class="metric-card" style="--tone-color:{tone_color};">
            <div class="metric-top">
                <div class="metric-icon">{icon_svg(icon_name, size=14)}</div>
                <div class="metric-kicker">{escape_html(label)}</div>
            </div>
            <div class="metric-value-row">
                <div class="metric-value">{escape_html(value)}</div>
                {delta_html}
            </div>
            <div class="metric-foot">{escape_html(supporting)}</div>
        </div>
        """
    )


def build_risk_distribution(distribution_rows):
    rows_html = []
    for row in distribution_rows:
        tone = {
            "Healthy": "healthy",
            "Watch": "watch",
            "At Risk": "at-risk",
            "Critical": "critical",
        }.get(row["tier"], "neutral")
        rows_html.append(
            f"""
            <div class="distribution-row">
                <div class="distribution-meta">
                    {build_inline_badge(row["tier"], tone=tone)}
                    <span>{escape_html(row["count"])} members</span>
                </div>
                <div class="distribution-track">
                    <div class="distribution-fill tone-{tone}" style="width:{max(row['percent'], 6)}%;"></div>
                </div>
                <div class="distribution-value">{escape_html(row["percent"])}%</div>
            </div>
            """
        )
    return clean_html(f"<div class='distribution-list'>{''.join(rows_html)}</div>")


def build_priority_card(row, compact=False):
    tier = row["Tier"]
    tier_color = get_tier_color(tier)
    tier_border = get_tier_border_color(tier)
    tier_glow = get_tier_glow(tier)
    compact_class = "compact" if compact else ""
    return clean_html(f"""
        <div class="queue-item {compact_class}" style="--tier-color:{tier_color};--tier-border:{tier_border};--tier-glow:{tier_glow};">
            <div class="queue-item-head">
                <div>
                    <div class="queue-item-title">{escape_html(row['Member name'])}</div>
                    <div class="queue-item-meta">{escape_html(row['Email'] or 'No email on file')} · Last attended {escape_html(row['Last attended display'])}</div>
                </div>
                <div class="queue-item-score">
                    <div class="queue-item-score-value">{escape_html(row['Risk score'])}</div>
                    <div class="queue-item-score-label">Risk</div>
                </div>
            </div>
            <div class="queue-item-badges">
                {build_tier_badge(tier)}
                {build_inline_badge(row['Status'] or 'Unknown', tone='neutral')}
            </div>
            <div class="queue-item-copy">
                <strong>Why now:</strong> {escape_html(row['Reasons'])}
            </div>
            <div class="queue-item-recommendation">
                <div class="queue-item-recommendation-label">Recommended next step</div>
                <div>{escape_html(row['Recommendation'])}</div>
            </div>
        </div>
    """)


def build_member_card(row, selected=False):
    selected_class = "active" if selected else ""
    return clean_html(f"""
        <div class="member-card {selected_class}">
            <div class="member-card-top">
                <div>
                    <div class="member-card-name">{escape_html(row['Member name'] or 'Unknown member')}</div>
                    <div class="member-card-email">{escape_html(row['Email'] or 'No email on file')}</div>
                </div>
                <div class="member-card-score">{escape_html(row['Risk score'])}</div>
            </div>
            <div class="member-card-meta">
                {build_tier_badge(row['Tier'])}
                {build_inline_badge(row['Status'] or 'unknown', tone='neutral')}
                {build_inline_badge(f"{row['Attendance count']} attendance", tone='accent', icon_name='activity')}
            </div>
        </div>
    """)


def build_recent_change_items(items):
    if not items:
        return build_empty_state(
            "activity",
            "No recent changes",
            "Member updates will appear here after the next sync cycle.",
        )

    rows_html = []
    for item in items:
        rows_html.append(
            f"""
            <div class="timeline-item">
                <div class="timeline-dot">{icon_svg(item.get('icon', 'activity'), size=12)}</div>
                <div class="timeline-body">
                    <div class="timeline-title-row">
                        <div class="timeline-title">{escape_html(item['title'])}</div>
                        <div class="timeline-meta">{escape_html(item['meta'])}</div>
                    </div>
                    <div class="timeline-copy">{escape_html(item['copy'])}</div>
                </div>
            </div>
            """
        )
    return clean_html(f"<div class='timeline-list'>{''.join(rows_html)}</div>")


def build_key_value_card(pairs):
    rows_html = "".join(
        f"""
        <div class="settings-row">
            <div class="settings-key">{escape_html(key)}</div>
            <div class="settings-value">{escape_html(value)}</div>
        </div>
        """
        for key, value in pairs
    )
    return clean_html(f"<div class='settings-card'>{rows_html}</div>")


def build_empty_state(icon_name, title, copy):
    return clean_html(f"""
        <div class="empty-state">
            <div class="empty-state-icon">{icon_svg(icon_name, size=18)}</div>
            <div class="empty-state-title">{escape_html(title)}</div>
            <div class="empty-state-copy">{escape_html(copy)}</div>
        </div>
    """)


def build_onboarding_step_track(current_step):
    steps = [
        "Connect Planning Center",
        "Configure engagement settings",
        "Review setup",
        "Finish onboarding",
        "Enter dashboard",
    ]
    cards = []
    for index, label in enumerate(steps, start=1):
        state_class = ""
        prefix = icon_svg("check", size=12)
        if index < current_step:
            state_class = "complete"
        elif index == current_step:
            state_class = "active"
            prefix = icon_svg("clock", size=12)
        else:
            prefix = icon_svg("chevron-right", size=12)

        cards.append(
            f"""
            <div class="step-card {state_class}">
                <div class="step-index">{prefix}</div>
                <div class="step-label">{escape_html(label)}</div>
            </div>
            """
        )
    return clean_html(f"<div class='step-track'>{''.join(cards)}</div>")
