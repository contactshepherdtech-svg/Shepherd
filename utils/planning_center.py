import os
import requests
from dotenv import load_dotenv

load_dotenv()

PCO_CLIENT_ID = os.getenv("PCO_CLIENT_ID")
PCO_CLIENT_SECRET = os.getenv("PCO_CLIENT_SECRET")

BASE_URL = "https://api.planningcenteronline.com"


def pco_get(endpoint, params=None):
    if not PCO_CLIENT_ID or not PCO_CLIENT_SECRET:
        raise ValueError("Missing PCO_CLIENT_ID or PCO_CLIENT_SECRET in .env")

    response = requests.get(
        f"{BASE_URL}{endpoint}",
        auth=(PCO_CLIENT_ID, PCO_CLIENT_SECRET),
        params=params,
        timeout=20
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
