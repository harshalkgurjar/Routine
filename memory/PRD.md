# RoutineTrack - Product Requirements Document

## Overview
RoutineTrack is a production-quality daily routine tracking mobile app built with React Native (Expo) and FastAPI backend with MongoDB. It helps users build habits, track daily and one-off tasks, view analytics, and share progress.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), Expo Router, TypeScript
- **Backend**: FastAPI (Python), MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth
- **Notifications**: expo-notifications (local push notifications)
- **Theme**: Auto (system preference) - white/black/blue color scheme

## Core Features

### 1. Authentication
- Google OAuth login via Emergent Auth
- Session token-based auth (cookies + Bearer header)
- 7-day session expiry
- Profile display with name, email, avatar

### 2. Today View (Default Tab)
- Greeting with user name + current date
- Task checklist with circular checkboxes
- Priority indicators (colored dots: red=high, yellow=medium, green=low)
- Category and time estimate display
- Progress bar with completion percentage
- Focus Mode (show only next 3 uncompleted tasks)
- Pull-to-refresh
- Haptic feedback on task completion
- FAB (+) button to add tasks

### 3. Add Task Flow
- Title (required)
- Type: Daily / One-off / Specific Days
- Date picker for one-off tasks
- Day selector for specific-day tasks (Mon-Sun toggles)
- Priority selector (Low/Medium/High)
- Time estimate in minutes
- Category chips (Health, Fitness, Work, Learning, Self-care, Productivity, Wellness, Other)
- Notes (multiline)
- Reminder toggle with time input
- Keyboard-aware form with ScrollView

### 4. Calendar View
- Month grid with navigation (prev/next month)
- Date selection to view tasks
- Green dots on dates with completions
- Today highlight
- Task list for selected date with completion toggle
- FAB (+) button to add tasks

### 5. Summary & Analytics
- Date navigation with daily stats
- Stats cards: Completion %, Tasks Done, Time Done, Time Planned
- Weekly bar chart overview
- Streaks (consecutive completion days per task)
- 7-day completion trend
- Most missed tasks with completion rates
- Best days of the week ranking

### 6. Settings
- Profile card (name, email, avatar initial)
- Daily Summary notification toggle (9 PM local push)
- Templates management (Morning Routine, Evening Routine)
- Apply template to create daily tasks
- Share Weekly Summary (React Native Share API)
- Logout with confirmation

### 7. Templates
- Pre-seeded: Morning Routine (5 tasks), Evening Routine (5 tasks)
- Each template shows task list with estimated times
- Apply button creates daily tasks from template

### 8. Export & Share
- Weekly summary as formatted text
- Shared via system share sheet
- Includes per-day completion stats and overall percentage

## Data Model

### Tasks
- task_id, user_id, title, type (daily/one_off/specific_days)
- date (for one-off), repeat_days (array of 0-6 for days)
- notes, priority, estimated_minutes, category
- reminder_enabled, reminder_time
- is_active (soft delete), order, created_at, updated_at

### Completions
- completion_id, user_id, task_id, date (YYYY-MM-DD), completed, completed_at
- Editing a task does NOT destroy historical completion records

### Templates
- template_id, user_id, name, description, tasks (array), is_default

### Users
- user_id (custom UUID), email, name, picture, settings, created_at

## API Endpoints
- POST /api/auth/session - Exchange OAuth session_id
- GET /api/auth/me - Get authenticated user
- POST /api/auth/logout
- GET /api/tasks - All tasks
- GET /api/tasks/for-date?date= - Tasks for specific date with completion
- POST /api/tasks - Create task
- PUT /api/tasks/{id} - Update task
- DELETE /api/tasks/{id} - Soft delete
- POST /api/completions/toggle - Toggle completion
- GET /api/completions?date= - Completions for date
- GET /api/completions/range?start=&end= - Completions range
- GET /api/summary/daily?date= - Daily summary stats
- GET /api/summary/weekly?date= - Weekly summary
- GET /api/summary/analytics - Streaks, missed, best days, trends
- GET /api/templates - List templates
- POST /api/templates - Create template
- POST /api/templates/{id}/apply - Apply template
- DELETE /api/templates/{id}
- GET /api/export/weekly?date= - Export weekly text
- GET /api/settings - Get user settings
- PUT /api/settings - Update settings

## Design System
- **Theme**: Swiss Blue Precision - auto (system preference)
- **Light**: Background #FDFDFD, Primary #0047FF, Text #09090B
- **Dark**: Background #000000, Primary #3B82F6, Text #FAFAFA
- **Typography**: System fonts, bold headings, left-aligned
- **Spacing**: 8pt grid, generous padding (24-32px)
- **Touch targets**: Minimum 44x44px
- **Animations**: Haptic feedback on interactions

## Next Improvements
- Auto-rollover: Move unfinished one-off tasks to next day
- Custom template creation by users
- Task reordering with drag and drop
- Recurring task patterns (every N days, biweekly)
- Data backup/sync across devices
- Widget support for quick task viewing
- Monetization: Premium tier with advanced analytics, custom themes, unlimited templates
