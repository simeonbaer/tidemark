# Tidemark - Swim Battle App

A SvelteKit-based swim battle ranking application built with TypeScript, Tailwind CSS, and MongoDB.

## Features

- **Authentication**: User registration and login system
- **Battle Screen**: Compare two swimmers with a confidence slider
- **Activity Log**: Track and log swim battles
- **Calendar View**: Visualize battle history by date

## Project Structure

```
src/
├── routes/
│   ├── +page.svelte           # Home redirect page
│   ├── auth/
│   │   └── +page.svelte       # Login/Register page
│   ├── battle/
│   │   └── +page.svelte       # Battle screen with comparison slider
│   ├── activity-log/
│   │   └── +page.svelte       # Activity log form and history
│   ├── calendar/
│   │   └── +page.svelte       # Calendar view of battles
│   └── api/
│       ├── users/
│       │   ├── login/
│       │   │   └── +server.ts # User login endpoint
│       │   └── register/
│       │       └── +server.ts # User registration endpoint
│       ├── battles/
│       │   ├── random/
│       │   │   └── +server.ts # Get random battle matchup
│       │   └── record/
│       │       └── +server.ts # Record battle result
│       ├── activities/
│       │   └── +server.ts     # Activity log endpoints
│       └── calendar/
│           └── +server.ts     # Calendar data endpoints
└── lib/
    └── server/
        └── db.ts              # MongoDB connection utility
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env` file based on `.env.example`:
```
MONGODB_URI=mongodb://localhost:27017
VITE_API_BASE_URL=http://localhost:5173/api
```

### Running the Application

**Development server:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String (hashed),
  createdAt: Date,
  stats: {
    wins: Number,
    losses: Number,
    draws: Number
  }
}
```

### Battles Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  swimmer1Id: ObjectId,
  swimmer2Id: ObjectId,
  winnerId: ObjectId | null,
  sliderValue: Number (0-100),
  createdAt: Date
}
```

### Activities Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  swimmer1: String,
  swimmer2: String,
  winnerId: String | null,
  sliderValue: Number,
  createdAt: Date
}
```

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login

### Battles
- `GET /api/battles/random` - Get random battle matchup
- `POST /api/battles/record` - Record battle result and update stats

### Activities
- `GET /api/activities?userId={id}` - Get user's activity log
- `POST /api/activities` - Log new activity

### Calendar
- `GET /api/calendar?userId={id}&month={m}&year={y}` - Get calendar data for month

## Tech Stack

- **Frontend**: SvelteKit, Svelte 5, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: SvelteKit server routes (+server.ts)
- **Database**: MongoDB
- **Package Manager**: npm

## Security Notes

⚠️ **Important**: The current password hashing is basic (Base64 encoding). For production, implement:
- Proper password hashing with bcrypt or argon2
- Session management / JWT tokens
- Input validation and sanitization
- CSRF protection
- Rate limiting

## Future Enhancements

- [ ] Real password hashing with bcrypt
- [ ] Session/JWT authentication
- [ ] User profiles and statistics
- [ ] Leaderboard
- [ ] Social features (follow users, comments)
- [ ] Mobile app
- [ ] Real-time battle notifications
