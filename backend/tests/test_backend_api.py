import pytest
import requests
from datetime import datetime, timedelta

# Tests for RoutineTrack backend API
# Modules: Auth, Tasks, Completions, Summary, Templates, Export

class TestAuth:
    """Authentication endpoints"""

    def test_auth_me_returns_user_data(self, api_client, base_url):
        """Test /api/auth/me returns authenticated user data"""
        response = api_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response missing user_id"
        assert "email" in data, "Response missing email"
        assert "name" in data, "Response missing name"
        assert data["user_id"] == "test-user-1772143729171", f"Expected test user, got {data['user_id']}"
        print(f"✓ Auth /me returned user: {data['name']} ({data['email']})")


class TestTasks:
    """Task CRUD endpoints"""

    def test_create_task_daily(self, api_client, base_url):
        """Test POST /api/tasks creates a daily task"""
        payload = {
            "title": "TEST_Pytest Daily Task",
            "type": "daily",
            "priority": "high",
            "estimated_minutes": 30,
            "category": "Testing",
            "notes": "Created by pytest"
        }
        response = api_client.post(f"{base_url}/api/tasks", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "task_id" in data, "Response missing task_id"
        assert data["title"] == payload["title"]
        assert data["type"] == "daily"
        assert data["priority"] == "high"
        assert data["estimated_minutes"] == 30
        print(f"✓ Created daily task: {data['task_id']}")
        
        # Verify persistence with GET
        task_id = data["task_id"]
        get_response = api_client.get(f"{base_url}/api/tasks")
        assert get_response.status_code == 200
        tasks = get_response.json()
        task_ids = [t["task_id"] for t in tasks]
        assert task_id in task_ids, "Created task not found in GET /tasks"
        print(f"✓ Task persisted and retrievable via GET")

    def test_get_tasks_for_date_returns_tasks_with_completion(self, api_client, base_url, today):
        """Test GET /api/tasks/for-date returns tasks with completion status"""
        response = api_client.get(f"{base_url}/api/tasks/for-date?date={today}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of tasks"
        
        if len(data) > 0:
            task = data[0]
            assert "task_id" in task
            assert "title" in task
            assert "completed" in task, "Task missing 'completed' field"
            assert isinstance(task["completed"], bool), "'completed' should be boolean"
            print(f"✓ Tasks for {today}: {len(data)} tasks with completion status")
        else:
            print(f"⚠ No tasks for {today}, creating test task first")

    def test_create_one_off_task(self, api_client, base_url):
        """Test creating a one-off task with specific date"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        payload = {
            "title": "TEST_Pytest One-off Task",
            "type": "one_off",
            "date": tomorrow,
            "priority": "medium",
            "estimated_minutes": 15
        }
        response = api_client.post(f"{base_url}/api/tasks", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["type"] == "one_off"
        assert data["date"] == tomorrow
        print(f"✓ Created one-off task for {tomorrow}")

    def test_create_specific_days_task(self, api_client, base_url):
        """Test creating a specific days task (weekdays only)"""
        payload = {
            "title": "TEST_Pytest Weekday Task",
            "type": "specific_days",
            "repeat_days": [0, 1, 2, 3, 4],  # Mon-Fri
            "priority": "low",
            "estimated_minutes": 20
        }
        response = api_client.post(f"{base_url}/api/tasks", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["type"] == "specific_days"
        assert data["repeat_days"] == [0, 1, 2, 3, 4]
        print(f"✓ Created specific days task (weekdays): {data['task_id']}")


class TestCompletions:
    """Task completion endpoints"""

    def test_toggle_completion_marks_task_complete(self, api_client, base_url, today):
        """Test POST /api/completions/toggle marks task as complete"""
        # First, ensure we have a task
        tasks_response = api_client.get(f"{base_url}/api/tasks/for-date?date={today}")
        tasks = tasks_response.json()
        
        if len(tasks) == 0:
            pytest.skip("No tasks available to test completion toggle")
        
        task = tasks[0]
        task_id = task["task_id"]
        initial_completed = task["completed"]
        
        # Toggle completion
        toggle_response = api_client.post(
            f"{base_url}/api/completions/toggle",
            json={"task_id": task_id, "date": today}
        )
        assert toggle_response.status_code == 200, f"Expected 200, got {toggle_response.status_code}"
        
        toggle_data = toggle_response.json()
        assert toggle_data["completed"] != initial_completed, "Completion status should toggle"
        print(f"✓ Toggled task {task_id}: {initial_completed} → {toggle_data['completed']}")
        
        # Verify with GET
        verify_response = api_client.get(f"{base_url}/api/tasks/for-date?date={today}")
        verify_tasks = verify_response.json()
        verify_task = next((t for t in verify_tasks if t["task_id"] == task_id), None)
        assert verify_task is not None, "Task not found after toggle"
        assert verify_task["completed"] == toggle_data["completed"], "Completion status not persisted"
        print(f"✓ Completion status persisted in database")


class TestSummary:
    """Summary and analytics endpoints"""

    def test_daily_summary_returns_correct_stats(self, api_client, base_url, today):
        """Test GET /api/summary/daily returns stats with correct structure"""
        response = api_client.get(f"{base_url}/api/summary/daily?date={today}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        required_fields = ["date", "total_tasks", "completed_tasks", "completion_percentage", 
                          "total_minutes", "completed_minutes"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        assert data["date"] == today
        assert isinstance(data["total_tasks"], int)
        assert isinstance(data["completed_tasks"], int)
        assert isinstance(data["completion_percentage"], int)
        assert data["completed_tasks"] <= data["total_tasks"], "Completed can't exceed total"
        print(f"✓ Daily summary for {today}: {data['completed_tasks']}/{data['total_tasks']} tasks ({data['completion_percentage']}%)")

    def test_weekly_summary_returns_7_days(self, api_client, base_url, today):
        """Test GET /api/summary/weekly returns 7 day summary"""
        response = api_client.get(f"{base_url}/api/summary/weekly?date={today}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "week_start" in data, "Missing week_start field"
        assert "days" in data, "Missing days field"
        assert isinstance(data["days"], list), "days should be a list"
        assert len(data["days"]) == 7, f"Expected 7 days, got {len(data['days'])}"
        
        # Validate day structure
        day = data["days"][0]
        required_day_fields = ["date", "day_name", "total", "completed", "percentage"]
        for field in required_day_fields:
            assert field in day, f"Day missing field: {field}"
        
        print(f"✓ Weekly summary: {len(data['days'])} days from {data['week_start']}")
        for d in data["days"]:
            print(f"  {d['day_name']}: {d['completed']}/{d['total']} ({d['percentage']}%)")

    def test_analytics_returns_streaks_missed_bestdays_trend(self, api_client, base_url):
        """Test GET /api/summary/analytics returns complete analytics data"""
        response = api_client.get(f"{base_url}/api/summary/analytics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        required_fields = ["streaks", "most_missed", "best_days", "trend"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            assert isinstance(data[field], list), f"{field} should be a list"
        
        # Validate structure of each field
        if len(data["streaks"]) > 0:
            streak = data["streaks"][0]
            assert "task_id" in streak and "title" in streak and "current_streak" in streak
            print(f"✓ Streaks: {len(data['streaks'])} tasks tracked")
        
        if len(data["most_missed"]) > 0:
            missed = data["most_missed"][0]
            assert "task_id" in missed and "title" in missed and "missed_count" in missed
            print(f"✓ Most missed: {len(data['most_missed'])} tasks")
        
        assert len(data["best_days"]) == 7, "Should have stats for all 7 days of week"
        print(f"✓ Best days: {data['best_days'][0]['day']} at {data['best_days'][0]['percentage']}%")
        
        assert len(data["trend"]) == 7, "Trend should cover last 7 days"
        print(f"✓ 7-day trend data available")


class TestTemplates:
    """Template endpoints"""

    def test_get_templates_returns_list(self, api_client, base_url):
        """Test GET /api/templates returns templates list"""
        response = api_client.get(f"{base_url}/api/templates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of templates"
        
        # Test user should have 2 default templates (Morning & Evening)
        assert len(data) >= 2, f"Expected at least 2 templates, got {len(data)}"
        
        template = data[0]
        required_fields = ["template_id", "name", "tasks"]
        for field in required_fields:
            assert field in template, f"Template missing field: {field}"
        
        assert isinstance(template["tasks"], list), "Template tasks should be a list"
        print(f"✓ Templates: {len(data)} available")
        for t in data:
            print(f"  - {t['name']}: {len(t['tasks'])} tasks")

    def test_apply_template_creates_tasks(self, api_client, base_url):
        """Test POST /api/templates/{id}/apply creates tasks from template"""
        # Get templates
        templates_response = api_client.get(f"{base_url}/api/templates")
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available to test")
        
        template = templates[0]
        template_id = template["template_id"]
        expected_task_count = len(template["tasks"])
        
        # Get current task count
        tasks_before_response = api_client.get(f"{base_url}/api/tasks")
        tasks_before = tasks_before_response.json()
        before_count = len(tasks_before)
        
        # Apply template
        apply_response = api_client.post(f"{base_url}/api/templates/{template_id}/apply")
        assert apply_response.status_code == 200, f"Expected 200, got {apply_response.status_code}: {apply_response.text}"
        
        apply_data = apply_response.json()
        assert "message" in apply_data
        assert "tasks" in apply_data
        assert len(apply_data["tasks"]) == expected_task_count, f"Expected {expected_task_count} tasks, got {len(apply_data['tasks'])}"
        print(f"✓ Applied template '{template['name']}': created {len(apply_data['tasks'])} tasks")
        
        # Verify tasks were created
        tasks_after_response = api_client.get(f"{base_url}/api/tasks")
        tasks_after = tasks_after_response.json()
        after_count = len(tasks_after)
        assert after_count == before_count + expected_task_count, "Task count mismatch after applying template"
        print(f"✓ Tasks persisted: {before_count} → {after_count}")


class TestExport:
    """Export endpoints"""

    def test_export_weekly_returns_text_summary(self, api_client, base_url, today):
        """Test GET /api/export/weekly returns formatted text summary"""
        response = api_client.get(f"{base_url}/api/export/weekly?date={today}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "text" in data, "Response missing 'text' field"
        assert isinstance(data["text"], str), "Text should be a string"
        assert len(data["text"]) > 0, "Text should not be empty"
        
        # Validate content contains expected sections
        text = data["text"]
        assert "RoutineTrack Weekly Summary" in text, "Missing title"
        assert "Week of" in text, "Missing week date"
        assert "Mon" in text and "Sun" in text, "Missing day labels"
        assert "Total" in text, "Missing totals row"
        assert "Generated by RoutineTrack" in text, "Missing footer"
        
        print(f"✓ Weekly export generated ({len(text)} chars)")
        print("Export preview:")
        print(text[:200] + "...")
