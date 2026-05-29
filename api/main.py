import logging
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

app = FastAPI(title="Shepherd Sync API")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SYNC_COMMANDS = (
    ("data.ingest", [sys.executable, "-m", "data.ingest"]),
    ("scoring.save_risk", [sys.executable, "-m", "scoring.save_risk"]),
)


def run_sync_command(label: str, command: list[str]) -> None:
    result = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )

    if result.returncode != 0:
        logger.error(
            "Sync command failed: %s returncode=%s stdout=%s stderr=%s",
            label,
            result.returncode,
            result.stdout,
            result.stderr,
        )
        raise RuntimeError(f"Sync failed while running {label}.")

    logger.info("Sync command completed: %s", label)


@app.post("/api/sync")
def run_sync():
    completed_steps: list[str] = []

    try:
        for label, command in SYNC_COMMANDS:
            run_sync_command(label, command)
            completed_steps.append(label)
    except subprocess.TimeoutExpired:
        logger.exception("Sync command timed out.")
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": "Sync timed out.",
                "completed_steps": completed_steps,
            },
        )
    except Exception as error:
        logger.exception("Sync failed.")
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": str(error),
                "completed_steps": completed_steps,
            },
        )

    return {
        "ok": True,
        "completed_steps": completed_steps,
    }
