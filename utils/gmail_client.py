import base64
import os
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]
OAUTH_HOST = "localhost"
OAUTH_PORT = 8080
REQUIRED_REDIRECT_URI = f"http://{OAUTH_HOST}:{OAUTH_PORT}/"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
TOKEN_PATH = PROJECT_ROOT / "gmail_token.json"
ENV_PATH = PROJECT_ROOT / ".env"

load_dotenv(ENV_PATH)


def _get_oauth_settings():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not client_id or not client_secret:
        raise ValueError(
            "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env."
        )
    if not redirect_uri:
        raise ValueError("Missing GOOGLE_REDIRECT_URI in .env.")
    if redirect_uri.strip() != REQUIRED_REDIRECT_URI:
        raise ValueError(
            f"Invalid GOOGLE_REDIRECT_URI. It must be {REQUIRED_REDIRECT_URI}"
        )

    return client_id, client_secret


def _build_credentials():
    client_id, client_secret = _get_oauth_settings()
    creds = None

    if TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        except Exception as error:
            raise ValueError(
                "Invalid token file at gmail_token.json. Delete it and re-authenticate."
            ) from error

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception as error:
            raise ValueError(
                "Invalid token refresh. Delete gmail_token.json and authenticate again."
            ) from error
        with open(TOKEN_PATH, "w", encoding="utf-8") as token_file:
            token_file.write(creds.to_json())
        return creds

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REQUIRED_REDIRECT_URI],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    try:
        creds = flow.run_local_server(host=OAUTH_HOST, port=OAUTH_PORT, open_browser=True)
    except OSError as error:
        if getattr(error, "errno", None) == 48:
            raise RuntimeError(
                f"OAuth callback port {OAUTH_PORT} is already in use."
            ) from error
        raise RuntimeError(f"OAuth local server error: {error}") from error
    except Exception as error:
        raise RuntimeError(f"OAuth authorization failed: {error}") from error

    with open(TOKEN_PATH, "w", encoding="utf-8") as token_file:
        token_file.write(creds.to_json())

    return creds


def create_gmail_draft(to_email, subject, body):
    if not to_email:
        raise ValueError("Recipient email is required.")

    creds = _build_credentials()
    service = build("gmail", "v1", credentials=creds)

    message = MIMEText(body or "")
    message["to"] = to_email
    message["subject"] = subject or "Shepherd Outreach"

    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    draft_body = {"message": {"raw": encoded_message}}

    draft = service.users().drafts().create(userId="me", body=draft_body).execute()
    return draft
