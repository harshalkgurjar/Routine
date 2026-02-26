from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# === Pydantic Models ===

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None

class SessionExchange(BaseModel):
    session_id: str

class TaskCreate(BaseModel):
    title: str
    type: str = "daily"
    date: Optional[str] = None
    repeat_days: Optional[List[int]] = None
    notes: Optional[str] = None
    priority: str = "medium"
    estimated_minutes: Optional[int] = None
    category: Optional[str] = None
    reminder_enabled: bool = False
    reminder_time: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None
    repeat_days: Optional[List[int]] = None
    notes: Optional[str] = None
    priority: Optional[str] = None
    estimated_minutes: Optional[int] = None
    category: Optional[str] = None
    reminder_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None
    is_active: Optional[bool] = None

class CompletionToggle(BaseModel):
    task_id: str
    date: str

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tasks: List[dict]


# === Auth Helper ===

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# === Auth Endpoints ===

@api_router.post("/auth/session")
async def exchange_session(body: SessionExchange, response: Response):
    try:
        resp = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")

        data = resp.json()
        email = data["email"]
        name = data["name"]
        picture = data.get("picture", "")
        session_token = data["session_token"]

        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            user_id = existing["user_id"]
            await db.users.update_one(
                {"email": email},
                {"$set": {"name": name, "picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "settings": {"daily_summary_enabled": True, "daily_summary_time": "21:00"}
            })
            await seed_default_templates(user_id)

        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        response.set_cookie(
            key="session_token", value=session_token,
            httponly=True, secure=True, samesite="none",
            path="/", max_age=7 * 24 * 60 * 60
        )

        return {
            "user_id": user_id, "email": email, "name": name,
            "picture": picture, "session_token": session_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}


# === Task Endpoints ===

@api_router.get("/tasks")
async def get_tasks(user: dict = Depends(get_current_user)):
    tasks = await db.tasks.find(
        {"user_id": user["user_id"], "is_active": True}, {"_id": 0}
    ).sort("order", 1).to_list(1000)
    return tasks


@api_router.get("/tasks/for-date")
async def get_tasks_for_date(date: str, user: dict = Depends(get_current_user)):
    """Get tasks applicable for a specific date with completion status"""
    user_id = user["user_id"]
    dt = datetime.strptime(date, "%Y-%m-%d")
    day_of_week = dt.weekday()  # 0=Monday, 6=Sunday

    tasks = await db.tasks.find(
        {
            "user_id": user_id,
            "is_active": True,
            "$or": [
                {"type": "daily"},
                {"type": "one_off", "date": date},
                {"type": "specific_days", "repeat_days": day_of_week}
            ]
        },
        {"_id": 0}
    ).sort("order", 1).to_list(1000)

    completions = await db.completions.find(
        {"user_id": user_id, "date": date}, {"_id": 0}
    ).to_list(1000)
    completion_map = {c["task_id"]: c["completed"] for c in completions}

    for task in tasks:
        task["completed"] = completion_map.get(task["task_id"], False)

    return tasks


@api_router.post("/tasks")
async def create_task(body: TaskCreate, user: dict = Depends(get_current_user)):
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    count = await db.tasks.count_documents({"user_id": user["user_id"], "is_active": True})

    repeat_days = body.repeat_days
    if body.type == "daily" and not repeat_days:
        repeat_days = [0, 1, 2, 3, 4, 5, 6]

    task = {
        "task_id": task_id,
        "user_id": user["user_id"],
        "title": body.title,
        "type": body.type,
        "date": body.date,
        "repeat_days": repeat_days,
        "notes": body.notes,
        "priority": body.priority,
        "estimated_minutes": body.estimated_minutes,
        "category": body.category,
        "reminder_enabled": body.reminder_enabled,
        "reminder_time": body.reminder_time,
        "template_id": None,
        "is_active": True,
        "order": count,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.tasks.update_one(
        {"task_id": task_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return task


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    result = await db.tasks.update_one(
        {"task_id": task_id, "user_id": user["user_id"]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}


# === Completion Endpoints ===

@api_router.post("/completions/toggle")
async def toggle_completion(body: CompletionToggle, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]

    existing = await db.completions.find_one(
        {"user_id": user_id, "task_id": body.task_id, "date": body.date}, {"_id": 0}
    )

    if existing:
        new_completed = not existing["completed"]
        await db.completions.update_one(
            {"user_id": user_id, "task_id": body.task_id, "date": body.date},
            {"$set": {"completed": new_completed, "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        new_completed = True
        completion_doc = {
            "completion_id": f"comp_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "task_id": body.task_id,
            "date": body.date,
            "completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
        await db.completions.insert_one(completion_doc)

    return {"task_id": body.task_id, "date": body.date, "completed": new_completed}


@api_router.get("/completions")
async def get_completions(date: str, user: dict = Depends(get_current_user)):
    completions = await db.completions.find(
        {"user_id": user["user_id"], "date": date}, {"_id": 0}
    ).to_list(1000)
    return completions


@api_router.get("/completions/range")
async def get_completions_range(start: str, end: str, user: dict = Depends(get_current_user)):
    completions = await db.completions.find(
        {"user_id": user["user_id"], "date": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(10000)
    return completions


# === Summary Endpoints ===

@api_router.get("/summary/daily")
async def get_daily_summary(date: str, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    dt = datetime.strptime(date, "%Y-%m-%d")
    day_of_week = dt.weekday()

    tasks = await db.tasks.find(
        {
            "user_id": user_id, "is_active": True,
            "$or": [
                {"type": "daily"},
                {"type": "one_off", "date": date},
                {"type": "specific_days", "repeat_days": day_of_week}
            ]
        },
        {"_id": 0}
    ).to_list(1000)

    completions = await db.completions.find(
        {"user_id": user_id, "date": date, "completed": True}, {"_id": 0}
    ).to_list(1000)
    completed_ids = {c["task_id"] for c in completions}

    total = len(tasks)
    completed = sum(1 for t in tasks if t["task_id"] in completed_ids)
    total_minutes = sum(t.get("estimated_minutes") or 0 for t in tasks)
    completed_minutes = sum(
        (t.get("estimated_minutes") or 0) for t in tasks if t["task_id"] in completed_ids
    )

    return {
        "date": date,
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_percentage": round(completed / total * 100) if total > 0 else 0,
        "total_minutes": total_minutes,
        "completed_minutes": completed_minutes,
    }


@api_router.get("/summary/weekly")
async def get_weekly_summary(date: str, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    dt = datetime.strptime(date, "%Y-%m-%d")
    monday = dt - timedelta(days=dt.weekday())

    days = []
    for i in range(7):
        day = monday + timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        dow = day.weekday()

        tasks = await db.tasks.find(
            {
                "user_id": user_id, "is_active": True,
                "$or": [
                    {"type": "daily"},
                    {"type": "one_off", "date": day_str},
                    {"type": "specific_days", "repeat_days": dow}
                ]
            },
            {"_id": 0}
        ).to_list(1000)

        completions = await db.completions.find(
            {"user_id": user_id, "date": day_str, "completed": True}, {"_id": 0}
        ).to_list(1000)
        completed_ids = {c["task_id"] for c in completions}

        total = len(tasks)
        completed_count = sum(1 for t in tasks if t["task_id"] in completed_ids)

        days.append({
            "date": day_str,
            "day_name": day.strftime("%a"),
            "total": total,
            "completed": completed_count,
            "percentage": round(completed_count / total * 100) if total > 0 else 0
        })

    return {"week_start": monday.strftime("%Y-%m-%d"), "days": days}


@api_router.get("/summary/analytics")
async def get_analytics(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).date()
    start_date = (today - timedelta(days=30)).isoformat()
    end_date = today.isoformat()

    daily_tasks = await db.tasks.find(
        {"user_id": user_id, "type": "daily", "is_active": True}, {"_id": 0}
    ).to_list(100)

    all_completions = await db.completions.find(
        {"user_id": user_id, "date": {"$gte": start_date, "$lte": end_date}, "completed": True},
        {"_id": 0}
    ).to_list(10000)

    # Streaks for daily tasks
    streaks = []
    for task in daily_tasks:
        streak = 0
        check_date = today
        while True:
            date_str = check_date.isoformat()
            found = any(
                c["task_id"] == task["task_id"] and c["date"] == date_str
                for c in all_completions
            )
            if found:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        streaks.append({
            "task_id": task["task_id"],
            "title": task["title"],
            "current_streak": streak
        })

    # Most missed tasks (last 30 days)
    all_tasks = await db.tasks.find(
        {"user_id": user_id, "is_active": True}, {"_id": 0}
    ).to_list(100)

    completion_counts = {}
    for c in all_completions:
        completion_counts[c["task_id"]] = completion_counts.get(c["task_id"], 0) + 1

    missed = []
    for task in all_tasks:
        if task["type"] == "daily":
            expected = 30
            actual = completion_counts.get(task["task_id"], 0)
            missed.append({
                "task_id": task["task_id"],
                "title": task["title"],
                "missed_count": expected - actual,
                "completion_rate": round(actual / expected * 100) if expected > 0 else 0
            })
    missed.sort(key=lambda x: x["missed_count"], reverse=True)

    # Best day of week
    day_completions = {i: {"completed": 0, "total": 0} for i in range(7)}
    for i in range(30):
        d = today - timedelta(days=i)
        dow = d.weekday()
        day_str = d.isoformat()
        day_tasks = [t for t in all_tasks if
                     t["type"] == "daily" or
                     (t["type"] == "one_off" and t.get("date") == day_str) or
                     (t["type"] == "specific_days" and dow in (t.get("repeat_days") or []))]
        day_comps = [c for c in all_completions if c["date"] == day_str]
        day_completions[dow]["total"] += len(day_tasks)
        day_completions[dow]["completed"] += len(day_comps)

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    best_days = []
    for i in range(7):
        total = day_completions[i]["total"]
        completed = day_completions[i]["completed"]
        best_days.append({
            "day": day_names[i],
            "day_index": i,
            "percentage": round(completed / total * 100) if total > 0 else 0
        })
    best_days.sort(key=lambda x: x["percentage"], reverse=True)

    # Trend (last 7 days)
    trend = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_str = d.isoformat()
        dow = d.weekday()
        day_comps = [c for c in all_completions if c["date"] == day_str]
        day_tasks = [t for t in all_tasks if
                     t["type"] == "daily" or
                     (t["type"] == "one_off" and t.get("date") == day_str) or
                     (t["type"] == "specific_days" and dow in (t.get("repeat_days") or []))]
        total = len(day_tasks)
        completed = len(day_comps)
        trend.append({
            "date": day_str,
            "day": d.strftime("%a"),
            "percentage": round(completed / total * 100) if total > 0 else 0
        })

    return {
        "streaks": sorted(streaks, key=lambda x: x["current_streak"], reverse=True),
        "most_missed": missed[:5],
        "best_days": best_days,
        "trend": trend
    }


# === Template Endpoints ===

async def seed_default_templates(user_id: str):
    templates = [
        {
            "template_id": f"tmpl_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "name": "Morning Routine",
            "description": "Start your day with purpose",
            "tasks": [
                {"title": "Wake up early", "priority": "high", "estimated_minutes": 5, "category": "Health"},
                {"title": "Drink water", "priority": "medium", "estimated_minutes": 2, "category": "Health"},
                {"title": "Exercise", "priority": "high", "estimated_minutes": 30, "category": "Fitness"},
                {"title": "Shower", "priority": "medium", "estimated_minutes": 15, "category": "Self-care"},
                {"title": "Breakfast", "priority": "medium", "estimated_minutes": 20, "category": "Health"},
            ],
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "template_id": f"tmpl_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "name": "Evening Routine",
            "description": "Wind down and prepare for tomorrow",
            "tasks": [
                {"title": "Review today's tasks", "priority": "high", "estimated_minutes": 10, "category": "Productivity"},
                {"title": "Plan tomorrow", "priority": "high", "estimated_minutes": 10, "category": "Productivity"},
                {"title": "Read", "priority": "medium", "estimated_minutes": 20, "category": "Learning"},
                {"title": "Prepare for bed", "priority": "low", "estimated_minutes": 15, "category": "Self-care"},
                {"title": "Meditate", "priority": "medium", "estimated_minutes": 10, "category": "Wellness"},
            ],
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.templates.insert_many(templates)


@api_router.get("/templates")
async def get_templates(user: dict = Depends(get_current_user)):
    templates = await db.templates.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(100)
    return templates


@api_router.post("/templates")
async def create_template(body: TemplateCreate, user: dict = Depends(get_current_user)):
    template = {
        "template_id": f"tmpl_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": body.name,
        "description": body.description,
        "tasks": body.tasks,
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.templates.insert_one(template)
    template.pop("_id", None)
    return template


@api_router.post("/templates/{template_id}/apply")
async def apply_template(template_id: str, user: dict = Depends(get_current_user)):
    template = await db.templates.find_one(
        {"template_id": template_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    user_id = user["user_id"]
    count = await db.tasks.count_documents({"user_id": user_id, "is_active": True})

    created_tasks = []
    for i, t in enumerate(template["tasks"]):
        task = {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": t["title"],
            "type": "daily",
            "date": None,
            "repeat_days": [0, 1, 2, 3, 4, 5, 6],
            "notes": None,
            "priority": t.get("priority", "medium"),
            "estimated_minutes": t.get("estimated_minutes"),
            "category": t.get("category"),
            "reminder_enabled": False,
            "reminder_time": None,
            "template_id": template_id,
            "is_active": True,
            "order": count + i,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tasks.insert_one(task)
        task.pop("_id", None)
        created_tasks.append(task)

    return {"message": f"Applied {len(created_tasks)} tasks", "tasks": created_tasks}


@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    result = await db.templates.delete_one(
        {"template_id": template_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


# === Export ===

@api_router.get("/export/weekly")
async def export_weekly(date: str, user: dict = Depends(get_current_user)):
    weekly = await get_weekly_summary(date, user)

    lines = [
        "RoutineTrack Weekly Summary",
        f"Week of {weekly['week_start']}",
        f"User: {user['name']}",
        "",
        "Day       | Done / Total | %",
        "----------|-------------|----"
    ]

    total_done = 0
    total_all = 0
    for day in weekly["days"]:
        lines.append(f"{day['day_name']:9} | {day['completed']:4} / {day['total']:5} | {day['percentage']}%")
        total_done += day["completed"]
        total_all += day["total"]

    overall = round(total_done / total_all * 100) if total_all > 0 else 0
    lines.extend([
        "----------|-------------|----",
        f"Total     | {total_done:4} / {total_all:5} | {overall}%",
        "",
        "Generated by RoutineTrack"
    ])

    return {"text": "\n".join(lines)}


# === Settings ===

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_doc.get("settings", {"daily_summary_enabled": True, "daily_summary_time": "21:00"})


@api_router.put("/settings")
async def update_settings(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"settings": body}}
    )
    return body


# === App Setup ===

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.tasks.create_index([("user_id", 1), ("is_active", 1)])
    await db.completions.create_index([("user_id", 1), ("date", 1)])
    await db.user_sessions.create_index("session_token")
    await db.users.create_index("email", unique=True)
    logger.info("Database indexes created")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
