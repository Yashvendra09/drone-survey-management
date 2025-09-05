# 🚀 Drone Survey Management System

A **full-stack web application** to plan, manage, and monitor drone survey missions.  

A web application to plan, manage and monitor drone survey missions.
Built with a Node.js + Express backend (MongoDB) and a React frontend. The system provides mission planning (polygon drawing and waypoint generation), fleet management (drone inventory & status), real-time mission simulation/monitoring, and reporting. Authentication (JWT) is implemented so protected API routes require a valid token.

This repository contains both backend and frontend in a single project. The frontend communicates with the backend via REST API and real-time updates use Socket.IO. The backend also contains an in-process mission simulator for demo and testing.

---

## 📑 Table of Contents

- [✨ Highlights](#-highlights)  
- [🛠 Architecture Overview](#-architecture-overview)  
- [📐 Technical Considerations](#-technical-considerations)  
- [⚙️ Requirements](#️-requirements)  
- [🚀 Quick Start (Development)](#-quick-start-development)  
  - [Backend Setup](#backend-setup)  
  - [Frontend Setup](#frontend-setup)  
- [🔑 Environment Variables](#-environment-variables)  
- [📡 API Endpoints](#-api-endpoints)  
- [💻 Example Usage (cURL)](#-example-usage-curl)  
- [🔒 Protecting Frontend Routes](#-protecting-frontend-routes)  
- [✅ Testing Checklist](#-testing-checklist)  
- [☁️ Deployment Notes](#️-deployment-notes)  
- [🛡 Security Notes](#-security-notes)  
- [📌 Roadmap / Next Steps](#-roadmap--next-steps)  
- [📄 License](#-license)

---

## ✨ Highlights

- 🔑 **JWT Authentication** — secure login & registration  
- 🛰 **Mission Planner** — draw polygons & auto-generate flight paths (lawnmower/grid, crosshatch, perimeter)  
- 📡 **Real-Time Monitoring** — mission progress and drone telemetry updates via Socket.IO  
- 🛠 **Fleet Management** — add/update/remove drones, track battery & status  
- 📊 **Reports & Analytics** — survey summaries, distances, coverage stats  
- ⚡ **Scalable Architecture** — queue-ready, socket scaling, large payload handling

---

## 🛠 Architecture Overview

[React Frontend] <---> [Express API + JWT Auth] <---> [MongoDB]
| |
| [Mission Simulator]
| |
[Socket.IO] <----------- Real-time updates
|
(Optional: Redis + BullMQ for scaling)

markdown
Copy code

- `/api/auth/*` → **public** (register, login)  
- All other `/api/*` → **protected** by JWT middleware  
- Mission simulation currently runs **in-process** (demo). A BullMQ worker is available for scaling.  

---

## 📐 Technical Considerations

### 🔹 Scalability
- **Stateless Auth (JWT)** → allows horizontal scaling of API servers  
- **Queue-ready Design** → simulation can run in separate worker processes (BullMQ + Redis)  
- **Socket.IO Scaling** → compatible with Redis adapter for multi-instance real-time updates  
- **Large Payload Handling** → body parser supports up to `20mb` JSON for large flight paths  

### 🔹 Advanced Mission Patterns
- Mission planner supports:  
  - ✅ **Grid (Lawnmower)**  
  - ✅ **Crosshatch**  
  - ✅ **Perimeter**  
- Backend normalizes input patterns into canonical forms for consistency  

### 🔹 Mission Parameters
- Configurable before mission creation:  
  - Altitude  
  - Overlap percentage  
  - Swath width  
  - Sensors to use  

These are stored under the `parameters` field in the Mission schema.

---

## ⚙️ Requirements

- **Node.js** 18+  
- **npm** or **yarn**  
- **MongoDB** (local or Atlas)  
- *(Optional)* **Redis** (if running the BullMQ worker)

---

## 🚀 Quick Start (Development)

### Backend Setup

```bash
cd backend
npm install
Create a .env file inside backend/:

ini
Copy code
PORT=5000
MONGO_URI=mongodb://localhost:27017/droneapp
JWT_SECRET=super_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_ORIGIN=http://localhost:5173
SIM_INTERVAL_MS=1000
SIM_SPEED_MPS=8
SIM_DRAIN_PER_TICK=0.15
Start the backend:

bash
Copy code
npm run dev
Frontend Setup
bash
Copy code
cd frontend
npm install
Create a .env file inside frontend/:

ini
Copy code
VITE_API_BASE=http://localhost:5000
Run the frontend:

bash
Copy code
npm run dev
Visit → http://localhost:5173

🔑 Environment Variables
Backend (.env)
ini
Copy code
PORT=5000
MONGO_URI=<your_mongo_uri>
JWT_SECRET=<your_secret>
JWT_EXPIRES_IN=7d
FRONTEND_ORIGIN=http://localhost:5173
SIM_INTERVAL_MS=1000
SIM_SPEED_MPS=8
SIM_DRAIN_PER_TICK=0.15
REDIS_URL=redis://localhost:6379
Frontend (.env)
ini
Copy code
VITE_API_BASE=http://localhost:5000
📡 API Endpoints
All protected endpoints require:
Authorization: Bearer <token>

🔓 Auth (Public)
POST /api/auth/register → Register new user

POST /api/auth/login → Login and receive JWT

🛠 Drones (Protected)
GET /api/drones → List drones

POST /api/drones → Add drone

PUT /api/drones/:id → Update drone

DELETE /api/drones/:id → Delete drone

📋 Missions (Protected)
GET /api/missions → List missions

POST /api/missions → Create mission

PUT /api/missions/:id → Update mission

POST /api/missions/:id/start → Start mission

PATCH /api/missions/:id/pause → Pause mission

PATCH /api/missions/:id/resume → Resume mission

PATCH /api/missions/:id/abort → Abort mission

📊 Reports (Protected)
GET /api/reports

POST /api/reports

GET /api/reports/analytics

💻 Example Usage (cURL)
Register
bash
Copy code
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'
Login
bash
Copy code
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
Get Drones
bash
Copy code
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/drones
Create Mission
bash
Copy code
curl -X POST http://localhost:5000/api/missions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Mission",
    "drone":"<DRONE_ID>",
    "flightPath":[{"lat":20,"lng":30,"alt":50,"order":0}],
    "areaCoordinates":[[20,30],[20.1,30],[20.2,30]],
    "altitude":50,
    "overlap":20,
    "pattern":"grid",
    "sensors":["camera"],
    "swathWidth":60
  }'
🔒 Protecting Frontend Routes
Use a RequireAuth wrapper in React Router:

jsx
Copy code
<Route path="/planner" element={<RequireAuth><MissionPlanner /></RequireAuth>} />
This ensures only logged-in users can access mission planning.

✅ Testing Checklist
 Register new user → token returned

 Login with valid credentials → token returned

 Add/update/delete drones → verify via API + UI

 Create mission → stored in DB

 Start mission → Socket.IO emits progress

 Pause/resume/abort mission → backend & frontend update

 Reports created → analytics aggregates correctly

☁️ Deployment Notes
Backend → Host on Render, Railway, or Heroku. Use MongoDB Atlas for DB.

Frontend → Deploy on Vercel/Netlify.

Scaling →

Use Redis + BullMQ workers for mission simulation.

Add Socket.IO Redis adapter for multi-instance real-time scaling.

🛡 Security Notes
🔑 Use a strong JWT_SECRET in production.

🔐 Passwords are hashed with bcrypt.

🌐 Set FRONTEND_ORIGIN properly to restrict CORS.

✅ Use HTTPS in production.

📌 Roadmap / Next Steps
Role-based access control (admin/operator/viewer)

Mission templates & scheduling

Real telemetry ingestion from drones

End-to-end tests with Cypress/Playwright

GitHub Actions CI/CD

📄 License
This project is my personal work.
You are free to use, adapt, and extend it. Please give attribution if you publish derived work.