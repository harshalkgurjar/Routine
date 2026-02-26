import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not set in environment")

# Test credentials from main agent
SESSION_TOKEN = "test_session_1772143729171"
USER_ID = "test-user-1772143729171"
TEST_TASK_ID = "task_7d74f8a4ef26"

@pytest.fixture
def api_client():
    """Shared requests session with auth headers"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session

@pytest.fixture
def today():
    return datetime.now().strftime("%Y-%m-%d")

@pytest.fixture
def base_url():
    return BASE_URL
