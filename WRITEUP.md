*************************Project Write-up*****************************

****** How I Approached the Problem ******

 I began by breaking down the requirements into distinct modules — mission management, drone fleet management, real-time monitoring, and reporting/analytics. I chose a MERN-based architecture (MongoDB, Express, React, Node.js) because it provided scalability, flexibility, and a smooth full-stack workflow.

- On the backend, I defined clear data models for drones, missions, reports, and users. This modular approach made it easy to enforce constraints (e.g., mission status lifecycle, battery limits, user roles) while keeping the codebase maintainable.

- On the frontend, I structured pages around the user’s workflow (Fleet → Planner → Missions → Monitor → Reports). I used React with Leaflet for geospatial visualization, Zustand for global state, and Recharts for analytics. This enabled an intuitive, interactive UI while keeping state predictable.

- For real-time updates, I integrated Socket.IO with a mission simulator, which allowed drones’ positions, battery levels, and mission progress to be broadcast to clients seamlessly.

- The guiding principle was end-to-end consistency — making sure every operation (e.g., creating a mission, updating drone status, generating reports) was reflected instantly across the system.

***** Trade-offs Considered *****

- Simulation vs. real telemetry: Since the scope excluded real drone integration, I implemented a simulation engine for flight paths, telemetry, and battery drain. This gave a realistic experience without external dependencies, but it meant additional complexity in designing stateful tickers.

- Patterns (grid, perimeter, crosshatch): Instead of implementing multiple separate algorithms, I reused and extended a lawnmower (grid) generator for crosshatch/perimeter. This was a trade-off between coverage accuracy and development speed, but still allowed mission diversity.

- Scalability vs. simplicity: I added a Redis-backed mission queue module (BullMQ) to allow scaling mission simulations in the future. For this submission, I ran simulations directly in memory for simplicity.

- Frontend routing & auth: I enforced global authentication with a RequireAuth wrapper in React, which ensures users must log in to access any route. The trade-off is slightly more boilerplate, but it guarantees security across the entire UI.

***** Strategy for Ensuring Safety and Adaptability ******

 Safety:

- Authentication & JWT-based authorization protect API endpoints.

- Mission creation validates all coordinates, patterns, and waypoints before accepting payloads, preventing malformed or unsafe missions.

- Drone status transitions are carefully managed — e.g., setting drones back to “available” after mission completion/abort.

- Rate-limiting mission simulator ticks and battery drain ensures the system stays responsive even with multiple missions.

Adaptability:

- The architecture is modular — controllers, routes, and models are independent, so features can be added without disrupting the system.

- Real-time telemetry is abstracted: today it uses a simulator, but it can be swapped with a real drone API by replacing the simulator without touching the UI.

- Mission patterns are normalized (grid, perimeter, crosshatch) so new survey patterns can be added easily.

- The frontend uses React hooks and services with interceptors, so changes to authentication or API base URLs only need to be updated in one place.

** Overall, I prioritized robustness, modularity, and extensibility. The project already supports multi-mission scalability and can be adapted to real drones or larger fleets with minimal code changes.