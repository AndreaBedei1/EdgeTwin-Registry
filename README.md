# HDT Registry MVP

Mobile-first full-stack foundation for registering users, Human Digital Twins (HDT), Vehicle Digital Twins (VDT), edge nodes, and triggering one mock HDT deployment per created profile.

This project implements the edge-side registration web application and API.
When a profile is saved, the backend triggers HDT deployment through a deployment adapter.
The current adapter is mocked.
A future adapter will call the real Kubernetes orchestrator or use deployment YAML files provided by the infrastructure team.

## Scope

This project implements:

- A mobile-first React registration flow for personal profile, HDT, VDT, and edge node metadata.
- An Express API with authentication, sessions, CSRF protection, profile validation, MongoDB persistence, and a public edge registration payload endpoint.
- Shared Zod schemas for frontend and backend validation.
- A mock HDT deployment adapter that returns fake deployment metadata after a profile is saved.

Out of scope:

- Kubernetes orchestrator implementation.
- Real Kubernetes namespaces, Pods, Deployments, clusters, or node registration.
- `kubectl` usage.
- DockerHub integration.
- Adding `@kubernetes/client-node`.
- Letting user input or QR data control Docker images, namespaces, pod names, privileged settings, or cluster configuration.

## Architecture

- `apps/web`: React, TypeScript, Vite frontend.
- `apps/api`: Express, TypeScript, MongoDB API.
- `packages/shared`: shared Zod schemas and TypeScript types.
- `docker-compose.yml`: local MongoDB for development only.

The backend owns authentication and session state. The frontend sends cookie-authenticated requests with `credentials: "include"` and does not store auth tokens in `localStorage`.

## Local Setup

Prerequisites:

- Node.js 20 or newer.
- Docker Desktop or another Docker Compose compatible runtime.

Install dependencies:

```powershell
npm.cmd install
```

Start local MongoDB:

```powershell
docker compose up -d mongodb
```

Create local env files:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
```

Generate a session secret and put it in `apps/api/.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run the app:

```powershell
npm.cmd run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

Stop or reset MongoDB:

```powershell
docker compose down
docker compose down -v
```

`docker compose down -v` deletes the local MongoDB volume.

## Environment Variables

Backend, in `apps/api/.env`:

- `NODE_ENV`: `development`, `test`, or `production`.
- `PORT`: API port, default local value is `3000`.
- `MONGODB_URI`: local Docker URI from `.env.example`, or a safe environment-specific URI.
- `MONGODB_DB_NAME`: database name, default local value is `hdt_platform_dev`.
- `SESSION_SECRET`: random secret, at least 32 characters in development and at least 64 in production.
- `CORS_ORIGIN`: comma-separated allowed frontend origins.
- `EDGE_ID`: required edge node identifier. Use safe characters only: letters, numbers, dots, underscores, and hyphens. Default local value is `local-edge-01`.
- `EDGE_NAME`: required display name for the edge node. Default local value is `Local Development Edge`.
- `EDGE_API_BASE_URL`: required public API base URL for this edge node. Local HTTP URLs such as `http://localhost:3000` are allowed in development; prefer HTTPS in production.
- `HDT_DEFAULT_IMAGE`: mock HDT image, currently `nginx:latest`.
- `DEPLOYMENT_PROVIDER`: currently only `mock`.

Frontend, in `apps/web/.env`:

- `VITE_API_BASE_URL`: API origin, default local value is `http://localhost:3000`.

Real `.env` files are ignored by Git. Never commit real secrets, passwords, MongoDB Atlas credentials, tokens, private IPs, or production connection strings. The Docker Compose MongoDB credentials are weak local-development placeholders only.

## MongoDB

Local development uses `mongo:7` through Docker Compose with a persistent `mongodb_data` volume exposed on `localhost:27017`.

The current MVP uses local root credentials from `docker-compose.yml` for development simplicity:

- username: `root`
- password: `root_password_change_me`
- database: `hdt_platform_dev`

Do not reuse these values outside local development. A less-privileged application user should be added before production-like deployments.

## API Endpoints

- `GET /api/health`: health status and safe database connectivity state.
- `GET /api/csrf-token`: creates/returns the CSRF token for the current session.
- `GET /api/edge/registration-payload`: public edge node QR payload. It contains edge metadata only and no secrets.
- `POST /api/auth/register`: register a user.
- `POST /api/auth/login`: authenticate and create a server-side session.
- `POST /api/auth/logout`: clear the current session, requires CSRF token.
- `GET /api/me`: return the authenticated user.
- `POST /api/profiles`: create profile and start mock deployment, requires auth and CSRF.
- `PUT /api/profiles/:profileId`: update owned profile metadata, requires auth and CSRF. It does not start a deployment.
- `GET /api/profiles/me`: list profiles owned by the authenticated user.

## Profile Creation Flow

Profile creation is the only flow that triggers HDT deployment:

1. The frontend submits a validated profile payload to `POST /api/profiles`.
2. The backend validates the profile with the shared schema.
3. The backend saves the profile to MongoDB with edge metadata and a pending mock deployment record.
4. After MongoDB save succeeds, the backend calls `deployHdtForProfile(profile)`.
5. The mock deployment provider returns fake deployment metadata.
6. The backend updates the profile deployment status.

QR scanning and manual edge entry only populate edge metadata in the form. They do not directly trigger deployment, and the backend does not call `edgeApiBaseUrl` yet.

## Profile Fields

The profile flow is intentionally narrow for the MVP.

Human Digital Twin fields:

- `name`: required text, for example `Andrea HDT`.
- `sex`: optional select value: `male` (`Male`), `female` (`Female`), `prefer_not_to_say` (`Prefer not to say`).
- `drivingExperienceLevel`: required select value: `beginner` (`Beginner`), `intermediate` (`Intermediate`), `experienced` (`Experienced`), `professional` (`Professional`).
- `drivingExperienceYears`: required select value: `0_1` (`0-1 years`), `2_5` (`2-5 years`), `6_10` (`6-10 years`), `11_20` (`11-20 years`), `over_20` (`Over 20 years`).
- `preferredDrivingStyle`: required select value: `cautious` (`Cautious`), `balanced` (`Balanced`), `dynamic` (`Dynamic`), `eco` (`Eco`).
- `notes`: optional text, max length enforced. The UI helper says: `Do not enter medical, clinical, or sensitive personal information.`

Vehicle Digital Twin fields:

- `nickname`: required text, for example `Test Vehicle 01`.
- `brand`: required text, for example `Toyota`.
- `model`: required text, for example `Yaris`.
- `vehicleType`: required select value: `car` (`Car`), `motorcycle` (`Motorcycle`), `van` (`Van`), `truck` (`Truck`), `bus` (`Bus`), `prototype` (`Prototype`), `simulated_vehicle` (`Simulated vehicle`).
- `powertrain`: required select value: `petrol` (`Petrol`), `diesel` (`Diesel`), `hybrid` (`Hybrid`), `electric` (`Electric`), `hydrogen` (`Hydrogen`), `unknown` (`Unknown`).
- `vehicleIdentifier`: optional internal identifier. It does not have to be a license plate.

Removed HDT/VDT fields are rejected by strict runtime validation and are not persisted.

## Edge Registration

Users can connect an edge node in two modes:

- Scan QR code.
- Enter edge data manually.

Manual edge fields:

- `edgeId`: required.
- `edgeName`: optional.
- `edgeApiBaseUrl`: required valid URL. Local HTTP URLs are allowed for development; prefer HTTPS in production.

The backend exposes the edge node payload at:

```http
GET /api/edge/registration-payload
```

Example response:

```json
{
  "type": "HDT_EDGE_REGISTRATION",
  "version": 1,
  "edgeId": "local-edge-01",
  "edgeName": "Local Development Edge",
  "edgeApiBaseUrl": "http://localhost:3000"
}
```

This endpoint is public because it describes the edge node and does not include secrets.

The QR scanner starts only after the user selects QR mode and presses `Start QR scanner`. It stops after a successful scan, when the user cancels, or when the scanner component unmounts. Camera permission errors are shown in the UI.

Expected QR payload:

```json
{
  "type": "HDT_EDGE_REGISTRATION",
  "version": 1,
  "edgeId": "local-edge-01",
  "edgeName": "Local Development Edge",
  "edgeApiBaseUrl": "http://localhost:3000"
}
```

QR contents are treated as untrusted input. The frontend parses only JSON that matches the shared Zod schema. QR scanning does not directly trigger deployment and does not call the edge API URL. `registrationToken` is not included for now.

When a profile is submitted, the backend stores validated edge metadata in `edgeData`:

- `edgeId`
- `edgeName`
- `edgeApiBaseUrl`
- `source`: `qr` or `manual`

In development, the QR section fetches the demo QR code payload from `GET /api/edge/registration-payload`. If the backend is unavailable, the helper shows a clear error and falls back to a safe local sample. This helper is hidden in production builds and contains no real secret.

Errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": []
  }
}
```

## Authentication, Sessions, and CSRF

- Passwords are hashed with bcrypt cost `12`.
- Password hashes are never returned by API responses.
- Sessions are stored server-side in MongoDB for normal runtime.
- Session cookies are HttpOnly.
- `Secure` cookies are enabled in production.
- Development uses `SameSite=Lax`; production uses `SameSite=None` with `Secure` for cross-origin deployments.
- CORS uses the explicit `CORS_ORIGIN` allowlist and never wildcard CORS with credentials.
- The React app fetches `/api/csrf-token` and sends `X-CSRF-Token` on protected state-changing requests.
- `POST /api/profiles`, `PUT /api/profiles/:profileId`, and `POST /api/auth/logout` require CSRF.
- `POST /api/auth/register` and `POST /api/auth/login` do not require CSRF in this MVP; they are unauthenticated, rate-limited endpoints and do not rely on SameSite as the only defense for authenticated state changes.
- Registration has a frontend-only password confirmation field. `confirmPassword` is not sent by the frontend and is not persisted if it is accidentally included in a backend request.
- No auth tokens, QR payloads, or CSRF tokens are stored in `localStorage`.

## Accessibility Checklist

- Inputs have explicit labels.
- Field errors are connected with `aria-describedby` where practical.
- Form-level success/error messages use live-region semantics.
- Buttons have visible loading/disabled states.
- Focus states are visible.
- Select fields are labeled and keyboard accessible.
- The QR/manual registration control uses native radio inputs.
- Camera preview has accessible text and camera errors are announced.
- Touch targets are sized for mobile use.
- The layout remains usable on narrow screens.
- Important messages are text-based and not conveyed by color alone.

## Quality Commands

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Backend integration tests use `mongodb-memory-server`, so they do not require Docker MongoDB or a real MongoDB URI.

## Deployment Mock

`deployHdtForProfile(profile)` is intentionally a mock. It is called only after a profile has been saved successfully. It logs deployment intent without secrets and returns:

- `status: "deploying"`
- `provider: "mock"`
- `image`: the server-controlled `HDT_DEFAULT_IMAGE`, `nginx:latest` by default
- generated `podName`
- `deploymentName: null`
- `namespace: null`
- `lastError: null`
- `updatedAt`

The profile deployment object supports these fields for the future integration point:

- `status`: `not_started`, `pending`, `deploying`, `running`, or `failed`
- `provider`: currently only `mock`
- `image`
- `podName`
- `deploymentName`
- `namespace`
- `lastError`
- `updatedAt`

The deployment service builds this future request shape internally, but the mock adapter does not send it anywhere:

```json
{
  "profileId": "...",
  "userId": "...",
  "hdtId": "...",
  "edgeId": "...",
  "image": "nginx:latest",
  "podName": "hdt-user-...",
  "environment": {
    "PROFILE_ID": "...",
    "USER_ID": "...",
    "HDT_ID": "...",
    "EDGE_ID": "..."
  }
}
```

The Docker image always comes from `HDT_DEFAULT_IMAGE`. QR data and user-submitted profile data cannot set the image, Kubernetes namespace, pod name, privileged settings, or cluster configuration.

No real Kubernetes deployment, Docker image deployment, DockerHub integration, namespace creation, Pod creation, Deployment creation, cluster creation, node addition, or `kubectl` call is implemented.

## Current Limitations

- QR scanning is implemented only for edge registration payload capture. It does not verify tokens with an edge node yet.
- Kubernetes/orchestrator deployment is not implemented.
- This project does not create clusters or add nodes to clusters.
- Local Docker MongoDB uses root credentials for development only.
- Production session, CSRF, and cookie behavior must be tested behind the real HTTPS domain/proxy setup.

## Next Steps

- Add a less-privileged local MongoDB app user.
- Replace the mock deployment provider with a real orchestrator adapter or YAML-based deployment adapter behind the existing service interface.
- Add production deployment documentation and HTTPS/proxy validation.
