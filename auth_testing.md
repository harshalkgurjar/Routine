# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date(),
  settings: { daily_summary_enabled: true, daily_summary_time: '21:00' }
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Seed Default Templates for Test User
```bash
mongosh --eval "
use('test_database');
var user = db.users.findOne({name: 'Test User'});
if (user) {
  db.templates.insertMany([
    {
      template_id: 'tmpl_morning_test',
      user_id: user.user_id,
      name: 'Morning Routine',
      description: 'Start your day with purpose',
      tasks: [
        {title: 'Wake up early', priority: 'high', estimated_minutes: 5, category: 'Health'},
        {title: 'Drink water', priority: 'medium', estimated_minutes: 2, category: 'Health'},
        {title: 'Exercise', priority: 'high', estimated_minutes: 30, category: 'Fitness'}
      ],
      is_default: true,
      created_at: new Date().toISOString()
    },
    {
      template_id: 'tmpl_evening_test',
      user_id: user.user_id,
      name: 'Evening Routine',
      description: 'Wind down and prepare for tomorrow',
      tasks: [
        {title: 'Review tasks', priority: 'high', estimated_minutes: 10, category: 'Productivity'},
        {title: 'Read', priority: 'medium', estimated_minutes: 20, category: 'Learning'},
        {title: 'Meditate', priority: 'medium', estimated_minutes: 10, category: 'Wellness'}
      ],
      is_default: true,
      created_at: new Date().toISOString()
    }
  ]);
}
"
```

## Step 3: Test Backend API
```bash
curl -X GET "https://your-app.com/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "https://your-app.com/api/tasks" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X POST "https://your-app.com/api/tasks" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_SESSION_TOKEN" -d '{"title": "Test Task", "type": "daily", "priority": "high"}'
```

## Step 4: Browser Testing
```python
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com");
```
