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


def generate_recommendation(member, risk_score):
    score = _get_score(risk_score)

    if score >= 60:
        return "Personal phone call + invite to next service"
    if score >= 40:
        return "Friendly follow-up email + event invitation"
    if score >= 20:
        return "Light engagement check-in"
    return "No action needed"


def generate_outreach_message(member, risk_score):
    member_name = getattr(member, "name", "there") or "there"
    tier = _get_tier(risk_score)
    reasons = _get_reasons(risk_score)
    recommendation = generate_recommendation(member, risk_score)

    return (
        f"Hi {member_name},\n\n"
        f"We noticed your current engagement tier is {tier}. "
        f"Reason noted: {reasons}. "
        "We hope everything is going well and wanted to check in.\n\n"
        "We would love to see you at our upcoming service.\n\n"
        f"Recommended next step: {recommendation}"
    )
