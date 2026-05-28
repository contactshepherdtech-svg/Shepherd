import plotly.graph_objects as go


FONT_STACK = "'Plus Jakarta Sans', Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"

TEXT_MUTED = "rgba(29,43,36,0.42)"
TEXT_SECONDARY = "rgba(29,43,36,0.60)"
GRID_COLOR = "rgba(11,95,74,0.08)"


def _lerp(start, end, blend):
    return int(start + (end - start) * blend)


def _gradient_color(t):
    waypoints = [
        (0.00, (26, 139, 106)),
        (0.25, (26, 139, 106)),
        (0.45, (154, 114, 21)),
        (0.68, (184, 94, 42)),
        (1.00, (194, 59, 59)),
    ]
    for index in range(len(waypoints) - 1):
        start_stop, start_rgb = waypoints[index]
        end_stop, end_rgb = waypoints[index + 1]
        if start_stop <= t <= end_stop:
            blend = (t - start_stop) / (end_stop - start_stop) if end_stop > start_stop else 0
            return (
                _lerp(start_rgb[0], end_rgb[0], blend),
                _lerp(start_rgb[1], end_rgb[1], blend),
                _lerp(start_rgb[2], end_rgb[2], blend),
            )
    return waypoints[-1][1]


def _color_for_position(position, reverse=False):
    normalized = max(min(position / 100.0, 1.0), 0.0)
    return _gradient_color(1.0 - normalized if reverse else normalized)


def make_gauge_chart(value, title="", height=188, reverse=False, footer=None):
    value = max(0, min(100, int(value or 0)))

    steps = []
    segment_count = 80
    for index in range(segment_count):
        start = index / segment_count * 100.0
        end = (index + 1) / segment_count * 100.0
        red, green, blue = _color_for_position((index + 0.5) / segment_count * 100.0, reverse=reverse)
        active_color = f"rgba({red},{green},{blue},0.84)"
        inactive_color = f"rgba({red},{green},{blue},0.10)"
        if end <= value:
            steps.append({"range": [start, end], "color": active_color})
        elif start < value:
            steps.append({"range": [start, value], "color": active_color})
            steps.append({"range": [value, end], "color": inactive_color})
        else:
            steps.append({"range": [start, end], "color": inactive_color})

    red, green, blue = _color_for_position(value, reverse=reverse)
    threshold_color = f"rgb({red},{green},{blue})"

    figure = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=value,
            domain={"x": [0, 1], "y": [0, 1]},
            title={
                "text": title,
                "font": {
                    "family": FONT_STACK,
                    "size": 11,
                    "color": TEXT_MUTED,
                },
            },
            number={
                "font": {
                    "family": FONT_STACK,
                    "size": 32,
                    "color": threshold_color,
                },
            },
            gauge={
                "axis": {"range": [0, 100], "visible": False},
                "shape": "angular",
                "bar": {"color": "rgba(0,0,0,0)", "thickness": 0},
                "bgcolor": "rgba(11,95,74,0.04)",
                "borderwidth": 0,
                "steps": steps,
                "threshold": {
                    "line": {"color": threshold_color, "width": 4},
                    "thickness": 0.78,
                    "value": value,
                },
            },
        )
    )

    if footer:
        figure.add_annotation(
            x=0.5,
            y=0.08,
            showarrow=False,
            text=footer,
            font={"family": FONT_STACK, "size": 10, "color": TEXT_MUTED},
        )

    figure.update_layout(
        height=height,
        margin={"l": 18, "r": 18, "t": 18, "b": 10},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"family": FONT_STACK, "color": TEXT_SECONDARY},
        transition={"duration": 480, "easing": "cubic-in-out"},
    )
    return figure


def make_attendance_trend_chart(attendance_rows):
    labels = [row["label"] for row in attendance_rows]
    records = [row["records"] for row in attendance_rows]
    unique_members = [row["unique_members"] for row in attendance_rows]

    figure = go.Figure()
    figure.add_trace(
        go.Scatter(
            x=labels,
            y=records,
            mode="lines",
            name="Check-ins",
            line={"shape": "spline", "width": 2.6, "color": "rgba(0,107,85,0.86)"},
            fill="tozeroy",
            fillcolor="rgba(0,107,85,0.10)",
            hovertemplate="%{x}<br>%{y} check-ins<extra></extra>",
        )
    )
    figure.add_trace(
        go.Scatter(
            x=labels,
            y=unique_members,
            mode="lines+markers",
            name="Unique members",
            line={"shape": "spline", "width": 2.0, "color": "rgba(26,139,106,0.80)"},
            marker={"size": 5, "color": "rgba(26,139,106,0.88)"},
            hovertemplate="%{x}<br>%{y} people<extra></extra>",
        )
    )

    figure.update_layout(
        height=236,
        margin={"l": 10, "r": 10, "t": 6, "b": 4},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"family": FONT_STACK, "color": TEXT_SECONDARY, "size": 11},
        hovermode="x unified",
        hoverlabel={
            "bgcolor": "#FFFDF6",
            "bordercolor": "rgba(11,95,74,0.14)",
            "font": {"family": FONT_STACK, "size": 12, "color": "#1D2B24"},
        },
        legend={
            "orientation": "h",
            "x": 0,
            "y": 1.14,
            "bgcolor": "rgba(0,0,0,0)",
            "font": {"family": FONT_STACK, "size": 11, "color": TEXT_SECONDARY},
        },
        xaxis={
            "showgrid": False,
            "tickfont": {"color": TEXT_MUTED, "family": FONT_STACK},
            "zeroline": False,
        },
        yaxis={
            "showgrid": True,
            "gridcolor": GRID_COLOR,
            "tickfont": {"color": TEXT_MUTED, "family": FONT_STACK},
            "zeroline": False,
        },
        transition={"duration": 420, "easing": "cubic-in-out"},
    )
    return figure


def make_recency_distribution_chart(recency_rows):
    labels = [row["label"] for row in recency_rows]
    values = [row["count"] for row in recency_rows]
    colors = [row["color"] for row in recency_rows]

    figure = go.Figure(
        go.Bar(
            x=values,
            y=labels,
            orientation="h",
            marker={
                "color": colors,
                "line": {"color": "rgba(11,95,74,0.08)", "width": 1},
            },
            hovertemplate="%{y}: %{x} members<extra></extra>",
        )
    )

    figure.update_layout(
        height=216,
        margin={"l": 8, "r": 8, "t": 6, "b": 6},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"family": FONT_STACK, "color": TEXT_SECONDARY, "size": 11},
        hoverlabel={
            "bgcolor": "#FFFDF6",
            "bordercolor": "rgba(11,95,74,0.14)",
            "font": {"family": FONT_STACK, "size": 12, "color": "#1D2B24"},
        },
        xaxis={
            "showgrid": True,
            "gridcolor": GRID_COLOR,
            "tickfont": {"color": TEXT_MUTED, "family": FONT_STACK},
            "zeroline": False,
        },
        yaxis={
            "showgrid": False,
            "tickfont": {"color": "rgba(29,43,36,0.52)", "family": FONT_STACK},
            "autorange": "reversed",
            "zeroline": False,
        },
        transition={"duration": 420, "easing": "cubic-in-out"},
    )
    return figure
