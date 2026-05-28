from html import escape


ICON_LIBRARY = {
    "dashboard": """
        <rect x="3" y="3" width="7" height="8" rx="2"></rect>
        <rect x="14" y="3" width="7" height="5" rx="2"></rect>
        <rect x="14" y="12" width="7" height="9" rx="2"></rect>
        <rect x="3" y="15" width="7" height="6" rx="2"></rect>
    """,
    "priority": """
        <path d="M12 3v18"></path>
        <path d="M5 8h8l-2.5 4H5z"></path>
        <path d="M12 8h7l-2.5 4H12z"></path>
    """,
    "members": """
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
        <circle cx="9.5" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    """,
    "settings": """
        <path d="M12 3v3"></path>
        <path d="M12 18v3"></path>
        <path d="M3 12h3"></path>
        <path d="M18 12h3"></path>
        <path d="M5.64 5.64l2.12 2.12"></path>
        <path d="M16.24 16.24l2.12 2.12"></path>
        <path d="M18.36 5.64l-2.12 2.12"></path>
        <path d="M7.76 16.24l-2.12 2.12"></path>
        <circle cx="12" cy="12" r="3"></circle>
    """,
    "refresh": """
        <path d="M20 4v5h-5"></path>
        <path d="M4 20v-5h5"></path>
        <path d="M5.5 15A7 7 0 0 0 17 18l3-3"></path>
        <path d="M18.5 9A7 7 0 0 0 7 6L4 9"></path>
    """,
    "sparkles": """
        <path d="M12 3l1.55 4.95L18.5 9.5l-4.95 1.55L12 16l-1.55-4.95L5.5 9.5l4.95-1.55z"></path>
        <path d="M19 2l.6 1.9L21.5 4.5l-1.9.6L19 7l-.6-1.9-1.9-.6 1.9-.6z"></path>
        <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75z"></path>
    """,
    "shield": """
        <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"></path>
        <path d="M9 12l2 2 4-4"></path>
    """,
    "activity": """
        <path d="M3 12h4l2-5 4 10 2-5h6"></path>
    """,
    "clock": """
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 3"></path>
    """,
    "mail": """
        <rect x="3" y="5" width="18" height="14" rx="3"></rect>
        <path d="m4 7 8 6 8-6"></path>
    """,
    "alert": """
        <path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.22 2.1h15.96a1.4 1.4 0 0 0 1.22-2.1z"></path>
        <path d="M12 9v4"></path>
        <circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none"></circle>
    """,
    "trend": """
        <path d="M4 16 9 11 13 15 20 8"></path>
        <path d="M20 8h-5"></path>
        <path d="M20 8v5"></path>
    """,
    "search": """
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m20 20-3.5-3.5"></path>
    """,
    "building": """
        <path d="M4 21V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14"></path>
        <path d="M9 21v-4h4v4"></path>
        <path d="M8 9h1"></path>
        <path d="M12 9h1"></path>
        <path d="M8 13h1"></path>
        <path d="M12 13h1"></path>
        <path d="M18 21V11a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v10"></path>
    """,
    "users-round": """
        <circle cx="9" cy="8" r="3"></circle>
        <path d="M3 20c1.3-3 3.6-4.5 6-4.5s4.7 1.5 6 4.5"></path>
        <circle cx="17" cy="9" r="2.4"></circle>
        <path d="M15.2 15.3c1.8.2 3.4 1 4.8 2.7"></path>
    """,
    "layers": """
        <path d="m12 3 9 4.5-9 4.5-9-4.5z"></path>
        <path d="m3 12 9 4.5 9-4.5"></path>
        <path d="m3 16.5 9 4.5 9-4.5"></path>
    """,
    "check": """
        <path d="m5 12 4 4L19 6"></path>
    """,
    "chevron-right": """
        <path d="m9 18 6-6-6-6"></path>
    """,
}


def icon_svg(name, size=18, color="currentColor", class_name=""):
    icon_body = ICON_LIBRARY.get(name, ICON_LIBRARY["shield"])
    class_attr = f' class="{escape(class_name)}"' if class_name else ""
    return (
        f'<svg{class_attr} xmlns="http://www.w3.org/2000/svg" '
        f'width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
        f'stroke="{escape(color)}" stroke-width="1.7" stroke-linecap="round" '
        f'stroke-linejoin="round">{icon_body}</svg>'
    )


def brand_mark_svg(size=46, class_name="brand-mark"):
    class_attr = f' class="{escape(class_name)}"' if class_name else ""
    return f"""
        <svg{class_attr} width="{size}" height="{size * 1.2:.0f}" viewBox="0 0 118 136" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="shepherd-card-fill" x1="16" y1="10" x2="100" y2="128" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#006B55"></stop>
                    <stop offset="1" stop-color="#0B5F4A"></stop>
                </linearGradient>
                <filter id="shepherd-card-shadow" x="0" y="0" width="118" height="136" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#06110D" flood-opacity="0.28"></feDropShadow>
                </filter>
            </defs>
            <g filter="url(#shepherd-card-shadow)">
                <rect x="14" y="8" width="90" height="118" rx="24" fill="url(#shepherd-card-fill)"></rect>
                <rect x="17.5" y="11.5" width="83" height="111" rx="20.5" stroke="#0A3B2D" stroke-opacity="0.42"></rect>
                <rect x="20.5" y="14.5" width="77" height="105" rx="18.5" stroke="#F4F0D8" stroke-opacity="0.12"></rect>
                <path d="M38 50c0-6.4 4.1-11.7 10-13.8-3.8-4.1-5.8-9.3-5.8-14.8 6.6 0 12.7 2.4 17.5 6.8 4-3.1 9.2-4.8 14.3-4.8 5.4 0 10.4 1.7 14.4 4.8 4.7-4.4 10.8-6.8 17.4-6.8 0 5.5-2 10.8-5.8 14.8 5.9 2.1 10 7.4 10 13.8 0 3.7-1.3 7.2-3.7 9.9 3.5 3.3 5.5 7.9 5.5 12.8 0 10.4-8.3 18.7-18.7 18.7-2.8 5.4-8.4 8.8-14.6 8.8-3.4 0-6.6-1-9.3-2.7-2.7 1.7-5.8 2.7-9.2 2.7-6.3 0-11.9-3.4-14.7-8.8-10.4 0-18.7-8.3-18.7-18.7 0-4.9 2-9.5 5.5-12.8-2.4-2.7-3.7-6.2-3.7-9.9Z" stroke="#FFD21F" stroke-width="4.2" stroke-linejoin="round"></path>
                <path d="M59 46.5c3 2.7 6.9 4.1 11 4.1 4 0 7.8-1.3 10.9-3.8 3 2.5 6.8 3.8 10.8 3.8" stroke="#FFD21F" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M58 49c0 25 8.2 33.9 12 41 3.8-7.1 12-16 12-41" stroke="#FFD21F" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M66 80.5 70 84l4-3.5" stroke="#FFD21F" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M70 84v11" stroke="#FFD21F" stroke-width="4.2" stroke-linecap="round"></path>
            </g>
        </svg>
    """


def brand_lockup_html(
    subtitle="Church engagement intelligence",
    compact=False,
    context_label=None,
):
    classes = "brand-lockup compact" if compact else "brand-lockup"
    context_html = ""
    if context_label:
        context_html = f"<div class='brand-context'>{escape(context_label)}</div>"

    return f"""
        <div class="{classes}">
            <div class="brand-mark-wrap">
                {brand_mark_svg(size=40 if compact else 54)}
            </div>
            <div class="brand-copy">
                <div class="brand-title">shepherd</div>
                <div class="brand-subtitle">{escape(subtitle)}</div>
                {context_html}
            </div>
        </div>
    """
