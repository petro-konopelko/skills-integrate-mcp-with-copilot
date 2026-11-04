# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Sign up for activities (student role)
- Role-based authentication (student/admin)
- Admin activity management (create, update, delete)

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/auth/login`                                                     | Sign in and get a bearer token                                      |
| GET    | `/auth/me`                                                        | Get current signed-in user                                          |
| POST   | `/auth/logout`                                                    | End current session                                                 |
| POST   | `/activities/{activity_name}/signup`                              | Sign up current student for an activity                             |
| DELETE | `/activities/{activity_name}/unregister?email=student@...`        | Remove a student from an activity (admin only)                      |
| POST   | `/activities`                                                     | Create a new activity (admin only)                                  |
| PUT    | `/activities/{activity_name}`                                     | Update activity details (admin only)                                |
| DELETE | `/activities/{activity_name}`                                     | Delete an activity (admin only)                                     |

## Demo Accounts

- Student: `student` / `student123`
- Admin: `admin` / `admin123`

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
