"""Select a SQLite database for each of the two local demo profiles."""

from contextvars import ContextVar
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse

demo_user = ContextVar("demo_user", default="A")


async def select_demo_user(request: Request, call_next):
    user = request.query_params.get("user", "A")
    if request.url.path.startswith("/api/") and user not in ("A", "B"):
        return JSONResponse({"detail": "Choose demo user A or B."}, status_code=400)
    token = demo_user.set(user)
    try:
        return await call_next(request)
    finally:
        demo_user.reset(token)


def database_path(base: str | Path) -> str | Path:
    if demo_user.get() == "A":
        return base
    path = Path(base)
    return path.with_name(f"{path.stem}-user-b{path.suffix}")
