import os
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv

from data.schema import IntegrationToken, SessionLocal, get_or_create_default_church
from utils.planning_center_oauth import refresh_access_token


load_dotenv()

BASE_URL = "https://api.planningcenteronline.com"


def _legacy_credentials():
    client_id = os.getenv("PCO_CLIENT_ID") or os.getenv("PLANNING_CENTER_CLIENT_ID")
    client_secret = os.getenv("PCO_CLIENT_SECRET") or os.getenv("PLANNING_CENTER_CLIENT_SECRET")
    return client_id, client_secret


def _save_refreshed_token(db, token_record, token_payload):
    access_token = token_payload.get("access_token")
    if not access_token:
        raise RuntimeError("Planning Center OAuth refresh did not return an access token.")

    token_record.access_token = access_token
    if token_payload.get("refresh_token"):
        token_record.refresh_token = token_payload["refresh_token"]

    expires_in = token_payload.get("expires_in")
    if expires_in is not None:
        try:
            token_record.expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))
        except (TypeError, ValueError):
            token_record.expires_at = None

    if token_payload.get("scope"):
        token_record.scope = str(token_payload["scope"])

    token_record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(token_record)
    return token_record.access_token


def _get_oauth_access_token(force_refresh=False):
    db = SessionLocal()
    try:
        active_church = get_or_create_default_church(db)
        token_record = (
            db.query(IntegrationToken)
            .filter(
                IntegrationToken.provider == "planning_center",
                IntegrationToken.church_id == active_church.id,
            )
            .first()
        )
        if token_record is None:
            token_record = (
                db.query(IntegrationToken)
                .filter(
                    IntegrationToken.provider == "planning_center",
                    IntegrationToken.church_id.is_(None),
                )
                .first()
            )
            if token_record is not None:
                token_record.church_id = active_church.id
                db.commit()

        if token_record is None or not token_record.access_token:
            return None

        should_refresh = force_refresh
        if token_record.expires_at and token_record.refresh_token:
            should_refresh = should_refresh or (
                token_record.expires_at <= datetime.utcnow() + timedelta(minutes=2)
            )

        if should_refresh and token_record.refresh_token:
            refreshed = refresh_access_token(token_record.refresh_token)
            return _save_refreshed_token(db, token_record, refreshed)

        return token_record.access_token
    finally:
        db.close()


def _request_with_bearer(endpoint, params, access_token):
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
        timeout=20,
    )
    return response


def pco_get(endpoint, params=None):
    oauth_access_token = _get_oauth_access_token()
    if oauth_access_token:
        response = _request_with_bearer(endpoint, params, oauth_access_token)
        if response.status_code == 401:
            refreshed_access_token = _get_oauth_access_token(force_refresh=True)
            if refreshed_access_token and refreshed_access_token != oauth_access_token:
                response = _request_with_bearer(endpoint, params, refreshed_access_token)
        response.raise_for_status()
        return response.json()

    client_id, client_secret = _legacy_credentials()
    if not client_id or not client_secret:
        raise ValueError(
            "Missing Planning Center credentials. Set OAuth tokens or PCO_CLIENT_ID/PCO_CLIENT_SECRET."
        )

    response = requests.get(
        f"{BASE_URL}{endpoint}",
        auth=(client_id, client_secret),
        params=params,
        timeout=20,
    )

    response.raise_for_status()
    return response.json()


def extract_people_emails(data):
    emails_by_person = {}

    for item in data.get("included", []):
        if item.get("type") != "Email":
            continue

        attrs = item.get("attributes", {})
        address = attrs.get("address")
        person_id = (
            item.get("relationships", {})
            .get("person", {})
            .get("data", {})
            .get("id")
        )
        is_preferred = attrs.get("preferred", False) or attrs.get("primary", False)
        is_active = not attrs.get("blocked", False)

        if not person_id or not address:
            continue

        if person_id not in emails_by_person:
            emails_by_person[person_id] = []
        emails_by_person[person_id].append(
            {
                "address": address,
                "preferred": is_preferred,
                "active": is_active,
            }
        )

    email_by_person = {}
    for person_id, email_list in emails_by_person.items():
        preferred_email = next(
            (
                email_info["address"]
                for email_info in email_list
                if email_info["preferred"]
            ),
            None,
        )
        if preferred_email:
            email_by_person[person_id] = preferred_email
            continue

        active_email = next(
            (
                email_info["address"]
                for email_info in email_list
                if email_info["active"]
            ),
            None,
        )
        if active_email:
            email_by_person[person_id] = active_email
            continue

        email_by_person[person_id] = email_list[0]["address"]

    return email_by_person


def get_people(limit=10):
    data = pco_get("/people/v2/people", {"per_page": limit, "include": "emails"})
    email_by_person = extract_people_emails(data)

    people = []

    for item in data.get("data", []):
        person_id = item.get("id")
        attrs = item.get("attributes", {})

        first = attrs.get("first_name", "")
        last = attrs.get("last_name", "")
        fallback_email = attrs.get("login_identifier")
        if fallback_email and "@" not in str(fallback_email):
            fallback_email = None

        people.append({
            "pco_id": person_id,
            "name": f"{first} {last}".strip(),
            "email": email_by_person.get(person_id) or fallback_email,
            "status": attrs.get("status"),
            "source": "planning_center"
        })

    return people


def get_checkins(limit=25):
    data = pco_get("/check-ins/v2/check_ins", {"per_page": limit})
    checkins = []

    for item in data.get("data", []):
        attrs = item.get("attributes", {})
        relationships = item.get("relationships", {})

        person_data = relationships.get("person", {}).get("data") or {}
        member_pco_id = attrs.get("person_id") or person_data.get("id")
        attended_at = attrs.get("checked_in_at") or attrs.get("created_at")

        checkins.append({
            "pco_checkin_id": item.get("id"),
            "member_pco_id": member_pco_id,
            "attended_at": attended_at,
            "source": "planning_center"
        })

    return checkins
