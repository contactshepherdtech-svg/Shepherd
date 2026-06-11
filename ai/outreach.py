def _get_score(risk_score):
    if risk_score is None:
        return 0
    if isinstance(risk_score, dict):
        return int(risk_score.get("score") or 0)
    return int(getattr(risk_score, "score", 0) or 0)


def _get_tier(risk_score):
    if risk_score is None:
        return "Healthy"
    if isinstance(risk_score, dict):
        return risk_score.get("tier") or "Healthy"
    return getattr(risk_score, "tier", "Healthy") or "Healthy"


def _get_reasons(risk_score):
    if risk_score is None:
        return "No reasons available"
    if isinstance(risk_score, dict):
        reasons_value = risk_score.get("reasons")
    else:
        reasons_value = getattr(risk_score, "reasons", None)

    if isinstance(reasons_value, list):
        return ", ".join(reasons_value)
    return reasons_value or "No reasons available"


def _get_lifecycle(member):
    lifecycle = getattr(member, "member_lifecycle", None)
    return str(lifecycle or "").strip().lower()


def _first_name(member):
    member_name = getattr(member, "name", "there") or "there"
    return str(member_name).strip().split(" ")[0] or "there"


def generate_recommendation(member, risk_score):
    lifecycle = _get_lifecycle(member)
    if lifecycle == "first_time_visitor":
        return "Warm welcome note and invitation to ask questions"
    if lifecycle == "returned_visitor":
        return "Friendly follow-up and next-step invitation"
    if lifecycle == "needs_first_followup":
        return "Personal first follow-up to help them get connected"

    score = _get_score(risk_score)

    if score >= 60:
        return "Personal phone call + invite to next service"
    if score >= 40:
        return "Friendly follow-up email + event invitation"
    if score >= 20:
        return "Light pastoral check-in"
    return "No action needed"


def generate_outreach_message(member, risk_score):
    first_name = _first_name(member)
    lifecycle = _get_lifecycle(member)
    tier = _get_tier(risk_score)
    recommendation = generate_recommendation(member, risk_score)

    if lifecycle == "first_time_visitor":
        return (
            f"Hi {first_name},\n\n"
            "Thank you for visiting. We loved having you with us and hope you felt welcomed.\n\n"
            "If you have any questions about the church or would like help finding a next step, I would be glad to help.\n\n"
            "We would love to see you again soon."
        )

    if lifecycle == "returned_visitor":
        return (
            f"Hi {first_name},\n\n"
            "It was good to see you again. I wanted to follow up and say we are grateful you came back.\n\n"
            "If you have questions or would like help getting connected, I would be glad to help.\n\n"
            "We hope to see you again soon."
        )

    if lifecycle == "needs_first_followup":
        return (
            f"Hi {first_name},\n\n"
            "I wanted to reach out and introduce myself. If you have questions about the church or would like help getting connected, I would be glad to help.\n\n"
            "You are welcome to join us anytime."
        )

    if tier not in ("At Risk", "Critical"):
        return (
            f"Hi {first_name},\n\n"
            "I wanted to check in and see how you are doing.\n\n"
            "If there is any way our church family can pray for you or support you, please let us know.\n\n"
            f"Suggested next step: {recommendation}"
        )

    return (
        f"Hi {first_name},\n\n"
        "I wanted to personally check in and see how you are doing. We have missed seeing you and hope you are well.\n\n"
        "If there is any way our church family can pray for you or support you, I would be glad to hear from you.\n\n"
        f"Suggested next step: {recommendation}"
    )
