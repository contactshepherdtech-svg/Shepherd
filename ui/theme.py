import streamlit as st


def inject_app_styles():
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

        :root {
            --bg-main: #F4F0D8;
            --bg-secondary: #ECE6CC;
            --sidebar-bg: #0B5F4A;
            --card: #FFFDF6;
            --card-secondary: #F7F2E4;
            --surface-elevated: #FFFFFF;
            --border: rgba(11,95,74,0.10);
            --border-strong: rgba(11,95,74,0.16);
            --text-primary: #1D2B24;
            --text-secondary: rgba(29,43,36,0.72);
            --text-muted: rgba(29,43,36,0.48);
            --accent: #006B55;
            --accent-dark: #0B5F4A;
            --accent-hover: #07866B;
            --gold: #FFD21F;
            --gold-soft: rgba(255,210,31,0.14);
            --warm-neutral: #D9D2BC;
            --healthy: #1A8B6A;
            --watch: #9A7215;
            --at-risk: #B85E2A;
            --critical: #C23B3B;
            --radius-sm: 10px;
            --radius-md: 16px;
            --radius-lg: 20px;
            --shadow-soft: 0 2px 16px rgba(11,95,74,0.07), 0 1px 4px rgba(11,95,74,0.04);
            --shadow-medium: 0 6px 24px rgba(11,95,74,0.10), 0 2px 8px rgba(11,95,74,0.05);
            --shadow-strong: 0 12px 40px rgba(11,95,74,0.13), 0 4px 12px rgba(11,95,74,0.07);
        }

        /* ── Global base ── */

        html, body {
            background-color: #F4F0D8 !important;
        }

        html, body, [class*="css"] {
            font-family: Inter, "Plus Jakarta Sans", "SF Pro Display", -apple-system,
                         BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            color: var(--text-primary);
        }

        .stApp {
            background-color: #F4F0D8;
        }

        [data-testid="stAppViewContainer"] {
            background: #F4F0D8;
        }

        [data-testid="stMain"] {
            background: #F4F0D8;
        }

        [data-testid="stHeader"] {
            background: transparent;
        }

        [data-testid="stStatusWidget"] {
            display: none;
        }

        [data-testid="stMainBlockContainer"] {
            max-width: 1400px;
            padding-top: 1.4rem;
            padding-bottom: 2.8rem;
            animation: page-enter 340ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        h1, h2, h3, h4 {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            letter-spacing: -0.02em;
            color: var(--text-primary);
        }

        p, li, label, small {
            color: var(--text-secondary);
        }

        [data-testid="stCaptionContainer"] p,
        .stCaption {
            color: var(--text-muted);
        }

        hr, [data-testid="stDivider"] {
            border-color: rgba(11,95,74,0.10);
        }

        /* ── Sidebar — stays dark evergreen ── */

        [data-testid="stSidebar"] {
            background: #0B5F4A !important;
            border-right: 1px solid rgba(11,95,74,0.18);
        }

        [data-testid="stSidebar"] [data-testid="stSidebarContent"] {
            padding-top: 0.55rem;
            padding-left: 0.8rem;
            padding-right: 0.8rem;
        }

        [data-testid="stSidebar"],
        [data-testid="stSidebar"] * {
            color: rgba(248,246,234,0.88) !important;
        }

        [data-testid="stSidebar"] h1,
        [data-testid="stSidebar"] h2,
        [data-testid="stSidebar"] h3,
        [data-testid="stSidebar"] h4 {
            color: rgba(248,246,234,0.92) !important;
        }
        
        [data-testid="stSidebar"] img {
            display: block;
            margin: 0.12rem auto 0.45rem;
        }

        /* ── Cards / containers ── */

        [data-testid="stVerticalBlockBorderWrapper"] {
            background: #FFFDF6;
            border: 1px solid rgba(11,95,74,0.10) !important;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-soft);
            transition: transform 180ms ease, border-color 180ms ease, box-shadow 200ms ease;
        }

        [data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: rgba(11,95,74,0.16) !important;
            box-shadow: var(--shadow-medium);
            transform: translateY(-1px);
        }

        [data-testid="stPlotlyChart"] {
            border-radius: 14px;
            overflow: hidden;
        }

        /* ── Buttons ── */

        div.stButton > button,
        .stFormSubmitButton > button {
            border-radius: 10px !important;
            border: 1px solid rgba(11,95,74,0.14) !important;
            background: #FFFDF6 !important;
            color: rgba(29,43,36,0.82) !important;
            box-shadow: 0 1px 4px rgba(11,95,74,0.06);
            font-weight: 600 !important;
            font-family: Inter, "Plus Jakarta Sans", sans-serif !important;
            min-height: 2.6rem;
            transition: transform 150ms ease, border-color 150ms ease,
                        box-shadow 150ms ease, background 150ms ease;
        }

        div.stButton > button:hover,
        .stFormSubmitButton > button:hover {
            transform: translateY(-1px);
            border-color: rgba(0,107,85,0.26) !important;
            box-shadow: 0 4px 16px rgba(11,95,74,0.12);
            background: #FFFFFF !important;
            color: #1D2B24 !important;
        }

        div.stButton > button:focus-visible,
        .stFormSubmitButton > button:focus-visible,
        .stTextInput input:focus,
        .stTextArea textarea:focus,
        [data-baseweb="select"] > div:focus-within {
            outline: none !important;
            border-color: rgba(0,107,85,0.40) !important;
            box-shadow: 0 0 0 3px rgba(0,107,85,0.10) !important;
        }

        div.stButton > button[kind="primary"],
        .stFormSubmitButton > button[kind="primary"] {
            background: #006B55 !important;
            color: rgba(248,246,234,0.98) !important;
            border-color: rgba(0,107,85,0.30) !important;
            box-shadow: 0 4px 18px rgba(0,107,85,0.22);
        }

        div.stButton > button[kind="primary"]:hover,
        .stFormSubmitButton > button[kind="primary"]:hover {
            background: #07866B !important;
            border-color: rgba(7,134,107,0.38) !important;
            box-shadow: 0 8px 28px rgba(0,107,85,0.28), 0 0 0 1px rgba(255,210,31,0.14) inset;
        }

        /* ── Sidebar nav buttons ── */

        [data-testid="stSidebar"] .stButton > button {
            text-align: left !important;
            justify-content: flex-start !important;
            border-radius: 9px !important;
            background: transparent !important;
            border-color: transparent !important;
            box-shadow: none !important;
            color: rgba(248,246,234,0.62) !important;
            padding-left: 0.72rem !important;
            min-height: 2.15rem;
            margin-bottom: 0.08rem;
            font-size: 0.9rem !important;
        }

        [data-testid="stSidebar"] .stButton > button:hover {
            background: rgba(248,246,234,0.07) !important;
            border-color: rgba(248,246,234,0.08) !important;
            color: rgba(248,246,234,0.90) !important;
            transform: none !important;
            box-shadow: none !important;
        }

        [data-testid="stSidebar"] .stButton > button[kind="primary"] {
            background: rgba(248,246,234,0.12) !important;
            border-color: rgba(248,246,234,0.18) !important;
            color: rgba(248,246,234,0.96) !important;
            box-shadow: none !important;
        }

        [data-testid="stSidebar"] .stButton > button[kind="primary"]:hover {
            background: rgba(248,246,234,0.18) !important;
        }

        /* ── Form inputs ── */

        [data-baseweb="select"] > div,
        .stTextInput input,
        .stTextArea textarea,
        .stNumberInput input {
            background: #FFFDF6 !important;
            color: #1D2B24 !important;
            border: 1px solid rgba(11,95,74,0.13) !important;
            border-radius: 10px !important;
        }

        [data-baseweb="select"] > div:hover,
        .stTextInput input:hover,
        .stTextArea textarea:hover,
        .stNumberInput input:hover {
            border-color: rgba(11,95,74,0.22) !important;
        }

        [data-baseweb="select"] [data-baseweb="menu"] {
            background: #FFFDF6 !important;
            border: 1px solid rgba(11,95,74,0.12) !important;
            border-radius: 14px !important;
            box-shadow: var(--shadow-strong) !important;
        }

        [data-baseweb="select"] [role="option"] {
            color: rgba(29,43,36,0.72) !important;
            background: transparent !important;
        }

        [data-baseweb="select"] [aria-selected="true"],
        [data-baseweb="select"] [role="option"]:hover {
            background: rgba(0,107,85,0.08) !important;
            color: #1D2B24 !important;
        }

        [data-baseweb="popover"] {
            background: #FFFDF6 !important;
        }

        .stCheckbox label span {
            color: var(--text-secondary);
        }

        .stAlert {
            border-radius: 12px;
            border: 1px solid rgba(11,95,74,0.12);
        }

        /* ── Expanders ── */

        [data-testid="stExpander"] {
            border: 1px solid rgba(11,95,74,0.10) !important;
            border-radius: var(--radius-md) !important;
            background: #F7F2E4 !important;
            overflow: hidden;
        }

        [data-testid="stExpander"] > details > summary {
            color: rgba(29,43,36,0.72) !important;
            font-weight: 600 !important;
            font-size: 0.88rem !important;
            padding: 0.9rem 1rem !important;
            background: transparent !important;
        }

        [data-testid="stExpander"] > details > summary:hover {
            color: #1D2B24 !important;
            background: rgba(11,95,74,0.04) !important;
        }

        [data-testid="stExpander"] > details[open] > summary {
            border-bottom: 1px solid rgba(11,95,74,0.09) !important;
        }

        /* ── Progress bar ── */

        [data-testid="stProgress"] > div {
            background: rgba(11,95,74,0.10) !important;
            height: 6px !important;
            border-radius: 999px !important;
        }

        [data-testid="stProgress"] > div > div {
            background: linear-gradient(90deg, #006B55, #0E9B7A) !important;
            border-radius: 999px !important;
        }

        /* ── Brand lockup ── */

        .brand-lockup {
            display: flex;
            align-items: center;
            gap: 0.9rem;
            padding: 0.15rem 0 0.9rem;
        }

        .brand-lockup.compact {
            gap: 0.75rem;
            padding-top: 0.2rem;
        }

        .brand-mark-wrap {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: brand-fade 500ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .brand-copy {
            min-width: 0;
        }

        .brand-title {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            font-size: 1.02rem;
            font-weight: 700;
            color: rgba(248,246,234,0.96);
            letter-spacing: -0.03em;
            line-height: 1.05;
        }

        .brand-subtitle,
        .brand-context {
            font-size: 0.74rem;
            color: rgba(248,246,234,0.48);
            line-height: 1.4;
        }

        .brand-context {
            margin-top: 0.12rem;
            color: rgba(248,246,234,0.32);
        }

        /* For brand lockup used outside sidebar (landing page) */
        .brand-lockup.on-light .brand-title {
            color: #1D2B24;
        }

        .brand-lockup.on-light .brand-subtitle,
        .brand-lockup.on-light .brand-context {
            color: rgba(29,43,36,0.52);
        }

        /* ── Sidebar structure ── */

        .sidebar-logo-only {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0.1rem 0 0.45rem;
            padding: 0.15rem 0 0.35rem;
            animation: brand-fade 420ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .sidebar-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 1.85rem;
            height: 1.85rem;
            border-radius: 7px;
            color: rgba(248,246,234,0.44);
            background: rgba(248,246,234,0.05);
            border: 1px solid rgba(248,246,234,0.08);
            transition: all 160ms ease;
        }

        .sidebar-icon.active {
            color: rgba(248,246,234,0.94);
            background: rgba(248,246,234,0.14);
            border-color: rgba(248,246,234,0.22);
        }

        /* ── Page header ── */

        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 1rem;
            margin-bottom: 1.4rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(11,95,74,0.10);
        }

        .page-header-main {
            min-width: 0;
        }

        .page-kicker {
            font-size: 0.70rem;
            text-transform: uppercase;
            letter-spacing: 0.13em;
            font-weight: 700;
            color: rgba(29,43,36,0.38);
            margin-bottom: 0.45rem;
        }

        .page-title-row {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }

        .page-title {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            font-size: 1.72rem;
            font-weight: 700;
            color: #1D2B24;
            letter-spacing: -0.04em;
            line-height: 1.06;
        }

        .page-subtitle {
            margin-top: 0.32rem;
            font-size: 0.92rem;
            line-height: 1.6;
            color: rgba(29,43,36,0.54);
            max-width: 62rem;
        }

        .page-meta {
            font-size: 0.82rem;
            color: rgba(29,43,36,0.40);
            padding-bottom: 0.25rem;
        }

        .page-meta-stack {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.35rem;
        }

        .page-status-chip .inline-badge {
            font-size: 0.74rem;
            font-weight: 700;
            letter-spacing: 0.02em;
        }

        .page-chip-row {
            display: flex;
            gap: 0.45rem;
            flex-wrap: wrap;
        }

        /* ── Metric cards ── */

        .metric-card {
            position: relative;
            padding: 1.05rem 1rem;
            border-radius: 14px;
            background: #FFFDF6;
            border: 1px solid rgba(11,95,74,0.09);
            box-shadow: var(--shadow-soft);
            overflow: hidden;
            transition: transform 170ms ease, border-color 170ms ease, box-shadow 170ms ease;
        }

        .metric-card::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 3px;
            background: var(--tone-color, var(--accent));
            opacity: 0.85;
        }

        .metric-card:hover {
            transform: translateY(-2px);
            border-color: rgba(11,95,74,0.16);
            box-shadow: var(--shadow-medium);
        }

        .metric-top {
            display: flex;
            align-items: center;
            gap: 0.45rem;
            margin-bottom: 0.55rem;
        }

        .metric-icon {
            width: 1.6rem;
            height: 1.6rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--tone-color, var(--accent));
            background: color-mix(in srgb, var(--tone-color, var(--accent)) 10%, transparent);
            border-radius: 8px;
        }

        .metric-kicker {
            font-size: 0.70rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.10em;
            color: rgba(29,43,36,0.44);
        }

        .metric-value-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 0.8rem;
        }

        .metric-value {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            font-size: 1.8rem;
            line-height: 1;
            font-weight: 700;
            letter-spacing: -0.05em;
            color: #1D2B24;
        }

        .metric-delta {
            font-size: 0.76rem;
            font-weight: 600;
            color: #006B55;
            background: rgba(0,107,85,0.09);
            border: 1px solid rgba(0,107,85,0.16);
            padding: 0.24rem 0.52rem;
            border-radius: 999px;
            white-space: nowrap;
        }

        .metric-foot {
            margin-top: 0.48rem;
            font-size: 0.81rem;
            line-height: 1.5;
            color: rgba(29,43,36,0.52);
        }

        /* ── Inline badges ── */

        .inline-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            border-radius: 999px;
            padding: 0.26rem 0.60rem;
            border: 1px solid rgba(11,95,74,0.12);
            background: rgba(11,95,74,0.06);
            color: rgba(29,43,36,0.72);
            font-size: 0.75rem;
            font-weight: 600;
            line-height: 1;
        }

        .inline-badge svg {
            flex-shrink: 0;
        }

        .tone-accent {
            color: #006B55;
            background: rgba(0,107,85,0.09);
            border-color: rgba(0,107,85,0.18);
        }

        .tone-healthy {
            color: #1A8B6A;
            background: rgba(26,139,106,0.09);
            border-color: rgba(26,139,106,0.18);
        }

        .tone-watch {
            color: #7D5E0E;
            background: rgba(154,114,21,0.10);
            border-color: rgba(154,114,21,0.20);
        }

        .tone-at-risk {
            color: #9E4A1A;
            background: rgba(184,94,42,0.10);
            border-color: rgba(184,94,42,0.20);
        }

        .tone-critical {
            color: #AE2828;
            background: rgba(194,59,59,0.09);
            border-color: rgba(194,59,59,0.18);
        }

        .tone-neutral {
            color: rgba(29,43,36,0.62);
            background: rgba(29,43,36,0.05);
            border-color: rgba(29,43,36,0.10);
        }

        .is-pulsing {
            animation: pulse-soft 3.5s ease-in-out infinite;
        }

        /* ── Surface headers ── */

        .surface-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1rem;
            margin-bottom: 0.9rem;
        }

        .surface-title {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            font-size: 0.94rem;
            font-weight: 700;
            color: #1D2B24;
            letter-spacing: -0.02em;
        }

        .surface-subtitle {
            margin-top: 0.16rem;
            font-size: 0.81rem;
            line-height: 1.5;
            color: rgba(29,43,36,0.46);
        }

        .surface-eyebrow {
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.11em;
            color: rgba(29,43,36,0.36);
            font-weight: 700;
            margin-bottom: 0.26rem;
        }

        /* ── Risk distribution ── */

        .distribution-list {
            display: flex;
            flex-direction: column;
            gap: 0.9rem;
        }

        .distribution-row {
            display: grid;
            grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) auto;
            align-items: center;
            gap: 0.8rem;
        }

        .distribution-meta {
            display: inline-flex;
            align-items: center;
            gap: 0.55rem;
            color: rgba(29,43,36,0.56);
            font-size: 0.82rem;
        }

        .distribution-track {
            height: 7px;
            border-radius: 999px;
            background: rgba(11,95,74,0.08);
            overflow: hidden;
        }

        .distribution-fill {
            height: 100%;
            border-radius: inherit;
        }

        .distribution-fill.tone-healthy {
            background: linear-gradient(90deg, rgba(26,139,106,0.82), rgba(26,139,106,0.58));
        }
        .distribution-fill.tone-watch {
            background: linear-gradient(90deg, rgba(154,114,21,0.82), rgba(154,114,21,0.58));
        }
        .distribution-fill.tone-at-risk {
            background: linear-gradient(90deg, rgba(184,94,42,0.82), rgba(184,94,42,0.58));
        }
        .distribution-fill.tone-critical {
            background: linear-gradient(90deg, rgba(194,59,59,0.82), rgba(194,59,59,0.60));
        }

        .distribution-value {
            font-size: 0.81rem;
            color: rgba(29,43,36,0.52);
            font-weight: 600;
        }

        /* ── Priority queue cards ── */

        .queue-item {
            position: relative;
            padding: 1rem;
            border-radius: 14px;
            border: 1px solid var(--tier-border, rgba(11,95,74,0.10));
            background: #FFFDF6;
            box-shadow: var(--shadow-soft);
            overflow: hidden;
        }

        .queue-item::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 3px;
            background: var(--tier-color, var(--accent));
        }

        .queue-item.compact {
            margin-bottom: 0.65rem;
        }

        .queue-item-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
        }

        .queue-item-title {
            font-size: 1rem;
            font-weight: 700;
            color: #1D2B24;
            line-height: 1.25;
        }

        .queue-item-meta {
            margin-top: 0.22rem;
            font-size: 0.81rem;
            line-height: 1.4;
            color: rgba(29,43,36,0.46);
        }

        .queue-item-score {
            text-align: right;
        }

        .queue-item-score-value {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            font-size: 1.7rem;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.05em;
            color: var(--tier-color, var(--accent));
        }

        .queue-item-score-label {
            margin-top: 0.14rem;
            font-size: 0.66rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(29,43,36,0.36);
        }

        .queue-item-badges {
            display: flex;
            align-items: center;
            gap: 0.45rem;
            flex-wrap: wrap;
            margin-bottom: 0.65rem;
        }

        .queue-item-copy {
            font-size: 0.86rem;
            line-height: 1.55;
            color: rgba(29,43,36,0.68);
            margin-bottom: 0.68rem;
        }

        .queue-item-recommendation {
            padding: 0.75rem 0.85rem;
            border-radius: 10px;
            border: 1px solid rgba(11,95,74,0.09);
            background: #F7F2E4;
            color: rgba(29,43,36,0.76);
            font-size: 0.85rem;
            line-height: 1.55;
        }

        .queue-item-recommendation-label {
            margin-bottom: 0.22rem;
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.11em;
            color: rgba(29,43,36,0.38);
        }

        /* ── Member cards ── */

        .member-card {
            padding: 0.9rem;
            border-radius: 12px;
            border: 1px solid rgba(11,95,74,0.09);
            background: #FFFDF6;
            box-shadow: var(--shadow-soft);
            transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        }

        .member-card:hover {
            transform: translateY(-1px);
            border-color: rgba(11,95,74,0.18);
            box-shadow: var(--shadow-medium);
        }

        .member-card.active {
            border-color: rgba(0,107,85,0.28);
            background: #F0FAF6;
            box-shadow: 0 4px 20px rgba(0,107,85,0.10);
        }

        .member-card-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0.75rem;
        }

        .member-card-name {
            font-size: 0.96rem;
            font-weight: 700;
            color: #1D2B24;
            line-height: 1.22;
        }

        .member-card-email {
            margin-top: 0.18rem;
            font-size: 0.78rem;
            color: rgba(29,43,36,0.46);
            overflow-wrap: anywhere;
        }

        .member-card-score {
            font-family: "Plus Jakarta Sans", Inter, sans-serif;
            font-size: 1.22rem;
            font-weight: 700;
            color: rgba(29,43,36,0.82);
            letter-spacing: -0.04em;
        }

        .member-card-meta {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            flex-wrap: wrap;
            margin-top: 0.68rem;
        }

        /* ── Timeline ── */

        .timeline-list {
            display: flex;
            flex-direction: column;
            gap: 0.85rem;
        }

        .timeline-item {
            display: flex;
            gap: 0.72rem;
            align-items: flex-start;
        }

        .timeline-dot {
            width: 1.85rem;
            height: 1.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: rgba(11,95,74,0.06);
            border: 1px solid rgba(11,95,74,0.10);
            color: rgba(29,43,36,0.62);
            flex-shrink: 0;
        }

        .timeline-body {
            min-width: 0;
            flex: 1;
        }

        .timeline-title-row {
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: baseline;
        }

        .timeline-title {
            font-size: 0.87rem;
            font-weight: 600;
            color: #1D2B24;
        }

        .timeline-meta {
            font-size: 0.75rem;
            color: rgba(29,43,36,0.40);
            white-space: nowrap;
        }

        .timeline-copy {
            margin-top: 0.15rem;
            font-size: 0.81rem;
            line-height: 1.5;
            color: rgba(29,43,36,0.52);
        }

        /* ── Key-value / settings card ── */

        .settings-card {
            border-radius: 12px;
            border: 1px solid rgba(11,95,74,0.09);
            overflow: hidden;
            background: #FFFDF6;
            box-shadow: var(--shadow-soft);
        }

        .settings-card.compact .settings-row {
            padding: 0.62rem 0.84rem;
        }

        .settings-card.compact .settings-key {
            font-size: 0.79rem;
        }

        .settings-card.compact .settings-value {
            font-size: 0.81rem;
        }

        .settings-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.78rem 0.96rem;
            border-bottom: 1px solid rgba(11,95,74,0.07);
        }

        .settings-row:last-child {
            border-bottom: none;
        }

        .settings-key {
            font-size: 0.83rem;
            color: rgba(29,43,36,0.52);
        }

        .settings-value {
            font-size: 0.84rem;
            font-weight: 600;
            color: #1D2B24;
            text-align: right;
        }

        .settings-form-section {
            margin: 0.18rem 0 0.48rem;
            font-size: 0.74rem;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            font-weight: 700;
            color: rgba(29,43,36,0.44);
        }

        /* ── Empty state ── */

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.45rem;
            padding: 1rem 0;
        }

        .empty-state-icon {
            width: 2.1rem;
            height: 2.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: rgba(11,95,74,0.07);
            border: 1px solid rgba(11,95,74,0.10);
            color: rgba(29,43,36,0.60);
        }

        .empty-state-title {
            font-size: 0.94rem;
            font-weight: 700;
            color: #1D2B24;
        }

        .empty-state-copy {
            font-size: 0.85rem;
            line-height: 1.55;
            color: rgba(29,43,36,0.52);
            max-width: 28rem;
        }

        /* ── Onboarding step track ── */

        .step-track {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0.7rem;
            margin: 1rem 0 1.25rem;
        }

        .step-card {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            padding: 0.72rem 0.75rem;
            border-radius: 14px;
            border: 1px solid rgba(11,95,74,0.10);
            background: rgba(11,95,74,0.04);
            color: rgba(29,43,36,0.50);
        }

        .step-card.complete {
            border-color: rgba(26,139,106,0.22);
            background: rgba(26,139,106,0.08);
            color: #1D2B24;
        }

        .step-card.active {
            border-color: rgba(0,107,85,0.28);
            background: rgba(0,107,85,0.10);
            color: #1D2B24;
            box-shadow: 0 4px 16px rgba(0,107,85,0.10);
        }

        .step-index {
            width: 1.6rem;
            height: 1.6rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: rgba(11,95,74,0.08);
            flex-shrink: 0;
        }

        .step-label {
            font-size: 0.78rem;
            line-height: 1.35;
            font-weight: 600;
        }

        /* ── Message preview ── */

        .message-preview {
            margin-top: 0.8rem;
            padding: 0.9rem 0.96rem;
            border-radius: 12px;
            border: 1px solid rgba(0,107,85,0.16);
            background: rgba(0,107,85,0.05);
            color: rgba(29,43,36,0.82);
            font-size: 0.86rem;
            line-height: 1.65;
            white-space: pre-wrap;
        }

        /* ── Data tables ── */

        [data-testid="stDataFrame"],
        .stDataFrame {
            border-radius: 14px !important;
            border: 1px solid rgba(11,95,74,0.10) !important;
            background: #FFFDF6 !important;
            overflow: hidden !important;
            box-shadow: var(--shadow-soft) !important;
        }

        [data-testid="stDataFrame"] [role="columnheader"],
        [data-testid="stDataFrame"] [role="gridcell"] {
            font-family: Inter, "SF Pro Display", sans-serif !important;
        }

        [data-testid="stDataFrame"] [role="columnheader"] {
            background: #F7F2E4 !important;
            color: rgba(29,43,36,0.52) !important;
            font-size: 0.77rem !important;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }

        [data-testid="stDataFrame"] [role="row"] [role="gridcell"] {
            color: rgba(29,43,36,0.82) !important;
            font-size: 0.83rem !important;
            border-top-color: rgba(11,95,74,0.06) !important;
        }

        [data-testid="stDataFrame"] [role="row"]:hover [role="gridcell"] {
            background: rgba(0,107,85,0.04) !important;
        }

        /* ── Animations ── */

        @keyframes page-enter {
            from {
                opacity: 0;
                transform: translateY(6px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes brand-fade {
            from {
                opacity: 0;
                transform: scale(0.90) translateY(4px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        @keyframes pulse-soft {
            0%, 100% { box-shadow: 0 0 0 0 rgba(194,59,59,0.0); }
            50% { box-shadow: 0 0 0 5px rgba(194,59,59,0.08); }
        }

        /* ── Responsive ── */

        @media (max-width: 1100px) {
            .step-track {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .page-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .page-meta-stack {
                align-items: flex-start;
            }
        }

        @media (max-width: 780px) {
            [data-testid="stMainBlockContainer"] {
                padding-top: 1rem;
            }
            .metric-value {
                font-size: 1.7rem;
            }
            .distribution-row {
                grid-template-columns: 1fr;
                gap: 0.4rem;
            }
            .queue-item-head,
            .timeline-title-row,
            .settings-row {
                flex-direction: column;
                align-items: flex-start;
            }
            .page-title {
                font-size: 1.55rem;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
