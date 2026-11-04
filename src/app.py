"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import hashlib
import hmac
import os
import secrets
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_digest = stored_hash.split("$", maxsplit=1)
    except ValueError:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return hmac.compare_digest(digest, expected_digest)


users = {
    "student": {
        "email": "student@mergington.edu",
        "role": "student",
        "password_hash": hash_password("student123"),
    },
    "admin": {
        "email": "admin@mergington.edu",
        "role": "admin",
        "password_hash": hash_password("admin123"),
    },
}

active_sessions: dict[str, str] = {}


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class ActivityPayload(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    schedule: str = Field(min_length=1)
    max_participants: int = Field(gt=0)


class ActivityUpdatePayload(BaseModel):
    description: str = Field(min_length=1)
    schedule: str = Field(min_length=1)
    max_participants: int = Field(gt=0)


def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token")

    token = authorization.removeprefix("Bearer ").strip()
    username = active_sessions.get(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = users.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session user")

    return {"username": username, **user}


def require_role(role: Literal["student", "admin"]):
    def role_dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] != role:
            raise HTTPException(status_code=403, detail=f"{role.capitalize()} role required")
        return current_user

    return role_dependency


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login")
def login(payload: LoginRequest):
    user = users.get(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    active_sessions[token] = payload.username
    return {
        "token": token,
        "username": payload.username,
        "email": user["email"],
        "role": user["role"],
    }


@app.get("/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user["role"],
    }


@app.post("/auth/logout")
def logout(current_user: dict = Depends(get_current_user), authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    active_sessions.pop(token, None)
    return {"message": f"Logged out {current_user['username']}"}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    current_user: dict = Depends(require_role("student")),
):
    """Sign up a student for an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]
    email = current_user["email"]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    _current_user: dict = Depends(require_role("admin")),
):
    """Unregister a student from an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}


@app.post("/activities")
def create_activity(
    payload: ActivityPayload,
    _current_user: dict = Depends(require_role("admin")),
):
    if payload.name in activities:
        raise HTTPException(status_code=400, detail="Activity already exists")

    activities[payload.name] = {
        "description": payload.description,
        "schedule": payload.schedule,
        "max_participants": payload.max_participants,
        "participants": [],
    }
    return {"message": f"Created activity {payload.name}"}


@app.put("/activities/{activity_name}")
def update_activity(
    activity_name: str,
    payload: ActivityUpdatePayload,
    _current_user: dict = Depends(require_role("admin")),
):
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    current_participants = activities[activity_name]["participants"]
    if len(current_participants) > payload.max_participants:
        raise HTTPException(
            status_code=400,
            detail="Maximum participants cannot be below current enrollment",
        )

    activities[activity_name]["description"] = payload.description
    activities[activity_name]["schedule"] = payload.schedule
    activities[activity_name]["max_participants"] = payload.max_participants

    return {"message": f"Updated activity {activity_name}"}


@app.delete("/activities/{activity_name}")
def delete_activity(
    activity_name: str,
    _current_user: dict = Depends(require_role("admin")),
):
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    del activities[activity_name]
    return {"message": f"Deleted activity {activity_name}"}
