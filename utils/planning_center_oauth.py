import os
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv


load_dotenv()

AUTH_URL = "https://api.planningcenteronline.com/oauth/authorize"
TOKEN_URL = "https://api.planningcenteronline.com/oauth/token"
SCOPES = "people check_ins"


def _oauth_settings():
    client_id = os.getenv("PLANNING_CENTER_CLIENT_ID")
    client_secret = os.getenv("PLANNING_CENTER_CLIENT_SECRET")
    redirect_uri = os.getenv("PLANNING_CENTER_REDIRECT_URI")

    missing = []
    if not client_id:
        missing.append("PLANNING_CENTER_CLIENT_ID")
    if not client_secret:
        missing.append("PLANNING_CENTER_CLIENT_SECRET")
    if not redirect_uri:
        missing.append("PLANNING_CENTER_REDIRECT_URI")

    if missing:
        raise ValueError(f"Missing Planning Center OAuth settings: {', '.join(missing)}")

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }


def build_authorization_url(state=None):
    settings = _oauth_settings()
    params = {
        "client_id": settings["client_id"],
        "redirect_uri": settings["redirect_uri"],
        "response_type": "code",
        "scope": SCOPES,
    }
    if state:
        params["state"] = state
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code_for_token(code):
    settings = _oauth_settings()
    response = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings["redirect_uri"],
            "client_id": settings["client_id"],
            "client_secret": settings["client_secret"],
        },
        timeout=20,
    )
    if response.status_code >= 400:
        raise RuntimeError("Planning Center OAuth token exchange failed.")
    return response.json()


def refresh_access_token(refresh_token):
    settings = _oauth_settings()
    response = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings["client_id"],
            "client_secret": settings["client_secret"],
        },
        timeout=20,
    )
    if response.status_code >= 400:
        raise RuntimeError("Planning Center OAuth token refresh failed.")
    return response.json()
