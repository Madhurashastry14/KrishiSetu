# KrishiSetu 🌾

**KrishiSetu** is a bilingual marketplace MVP connecting farmers in Dakshina Kannada and Udupi with nearby produce buyers. It helps farmers list their produce, discover buyer requirements, negotiate offers, and compare expected prices with available mandi price observations.

The platform aims to improve direct market access, price transparency, and accessibility for local farmers through an English and Kannada interface.

> **Note:** KrishiSetu is a demonstration product, not a production marketplace. Demo accounts and sample market prices are synthetic and clearly labelled. Live mandi prices are available only when the required API configuration is provided.

## Features

- **Farmer marketplace:** Create, manage, and browse produce listings.
- **Buyer requests and offers:** Buyers can publish requirements, and farmers can submit offers.
- **Price transparency:** View reference mandi prices and historical price insights.
- **Fair Price Meter:** Compare a farmer's expected price with a matching mandi modal price.
- **Bilingual interface:** English and Kannada support for core workflows.
- **User authentication:** Role-based access for farmers and buyers.
- **Privacy controls:** Farmers and buyers control whether their phone numbers are shared.
- **Listing images:** Upload optional images of produce.

## Tech Stack

| Layer                         | Technologies                                        |
| ----------------------------- | --------------------------------------------------- |
| Frontend                      | React, Vite, JavaScript, Tailwind CSS, React Router |
| UI and charts                 | Lucide, Recharts                                    |
| Backend                       | Node.js, Express.js                                 |
| Validation and authentication | Zod, JWT, bcrypt                                    |
| Database                      | PostgreSQL, Prisma ORM                              |

## Project Structure

```text
KrishiSetu/
├── client/                 # React frontend
│   ├── src/                # UI, pages, and API integration
│   ├── index.html
│   └── package.json
│
├── server/                 # Node.js and Express backend
│   ├── prisma/             # Database schema, migrations, and seed
│   ├── src/                # API routes, authentication, and business logic
│   ├── package.json
│   └── prisma.config.ts
│
├── .env.example            # Environment configuration template
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Getting Started

### Prerequisites

Install the following before running KrishiSetu:

- Node.js 20.19 or later
- npm
- PostgreSQL 14 or later

Optional: data.gov.in API credentials for live mandi price imports.

### 1. Clone the repository

```powershell
git clone https://github.com/Madhurashastry14/KrishiSetu.git
cd KrishiSetu
```

### 2. Install dependencies

Run this command from the repository root:

```powershell
npm install
```

This installs the dependencies configured for the project and its npm workspaces.

### 3. Configure environment variables

Create the server environment file:

```powershell
Copy-Item .env.example server\.env
```

Edit `server/.env` and configure the following variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/krishisetu"
JWT_SECRET="replace-with-a-random-secret-of-at-least-32-characters"
CLIENT_ORIGIN="http://localhost:5173"
PORT=4000
NODE_ENV=development
```

Replace the database username and password with your local PostgreSQL credentials. Use a private, randomly generated JWT secret.

### 4. Create the PostgreSQL database

Open PostgreSQL using `psql` or pgAdmin and execute:

```sql
CREATE DATABASE krishisetu;
```

Ensure that the database name and credentials match `DATABASE_URL`.

### 5. Initialize the database

From the repository root, run:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

- `db:generate` generates the Prisma Client.
- `db:migrate` applies the checked-in database migrations.
- `db:seed` inserts demonstration data and demo accounts.

Run the seed command only when you want the demonstration records. If the database is already populated, check the seed script before running it again.

### 6. Start the application

Run both the frontend and backend development servers:

```powershell
npm run dev
```

Open the following URLs:

- Frontend: http://localhost:5173
- API health check: http://localhost:4000/api/health

A successful health check should return a successful response indicating that the API is available.

### 7. Sign in with a demo account

| Role   | Email                       | Password       |
| ------ | --------------------------- | -------------- |
| Farmer | `farmer@demo.krishisetu.in` | `Farmer@12345` |
| Buyer  | `buyer@demo.krishisetu.in`  | `Buyer@12345`  |

These credentials work only after the seed script has created the demo accounts.

### Running Individual Workspaces

To start only the frontend:

```powershell
npm run dev --workspace client
```

To start only the backend:

```powershell
npm run dev --workspace server
```

These commands require the root `package.json` to define the corresponding npm workspaces.

## API Overview

The backend exposes RESTful APIs under `/api`.

| Method     | Endpoint                              | Purpose                               |
| ---------- | ------------------------------------- | ------------------------------------- |
| GET        | `/api/health`                         | Check API availability                |
| POST       | `/api/auth/register`                  | Register a farmer or buyer            |
| POST       | `/api/auth/login`                     | Authenticate a user                   |
| POST       | `/api/auth/logout`                    | End the browser session               |
| GET, PATCH | `/api/auth/me`                        | View or update the user's profile     |
| GET        | `/api/dashboard`                      | Retrieve role-specific dashboard data |
| GET        | `/api/listings/marketplace`           | Browse and filter produce listings    |
| GET, POST  | `/api/listings`                       | View or create the user's listings    |
| PATCH      | `/api/listings/:id`                   | Update an owned listing               |
| GET, POST  | `/api/requests`                       | Browse or create buyer requests       |
| PATCH      | `/api/requests/:id`                   | Update an owned buyer request         |
| POST       | `/api/requests/:id/responses`         | Submit an offer                       |
| PATCH      | `/api/requests/responses/:responseId` | Accept or decline an offer            |
| GET        | `/api/prices`                         | Retrieve reference price observations |
| GET        | `/api/prices/insights`                | Retrieve price history and insights   |
| GET        | `/api/prices/compare`                 | Compare expected and reference prices |
| POST       | `/api/prices/sync`                    | Import configured mandi price data    |
| POST       | `/api/uploads`                        | Upload a listing image                |

Authenticated endpoints use the HttpOnly `krishisetu_session` cookie. Access is restricted according to user roles and resource ownership.

## Mandi Prices and Fair Price Meter

KrishiSetu supports reference price observations and an optional integration with the data.gov.in Agmarknet dataset.

To enable live imports, configure the following server environment variables:

```env
AGMARKNET_API_KEY=your_api_key
AGMARKNET_RESOURCE_ID=your_resource_id
```

The authenticated endpoint `POST /api/prices/sync` imports recognized records from the configured dataset.

The Fair Price Meter compares the farmer's expected price with the matching mandi modal price. Its indicative categories are:

- **Green:** Expected price is at least 95% of the reference price.
- **Amber:** Expected price is at least 80% but below 95%.
- **Red:** Expected price is below 80%.

The comparison requires compatible units and valid, sufficiently recent price observations. Prices are not silently converted between units.

**Important:** The meter is an indicative comparison, not a guarantee of fair market value. Live API access and the selected dataset's field names and units must be verified before relying on imported observations. Without valid API configuration, the application uses labelled demonstration or historical observations as applicable; sample prices must never be presented as live market data.

## Testing and Build

Run the automated tests:

```powershell
npm test
```

Build the application:

```powershell
npm run build
```

The current test suite covers Fair Price Meter logic, API health and unauthenticated access, and selected frontend rendering and language-switching behavior. Database-backed workflows should also be tested against a configured PostgreSQL database.

## Security and Limitations

- Passwords are hashed using bcrypt.
- Request inputs are validated using Zod.
- Role-based authorization and resource ownership checks protect restricted operations.
- JWT authentication uses an HttpOnly cookie with a 15-minute expiry.
- CORS restrictions, security headers, and authentication rate limiting provide additional safeguards.
- Phone numbers are shared with other users only when the account holder opts in.
- The application has not undergone a production security audit.
- Logout clears the browser cookie, but a copied JWT remains valid until it expires because server-side token revocation is not implemented.
- Listing images are stored locally and require object storage or a CDN for a production deployment.
- Kannada translations cover core workflows, but some secondary text and chart labels remain in English.
- External photography and font resources may require an internet connection.

## Future Improvements

- Verified live mandi price integration.
- Cloud-based image storage.
- Expanded Kannada translations.
- Production-grade session revocation and security review.
- Broader automated tests for database workflows and marketplace transactions.

## Team Members

| Sl. No. | Name                      | USN        |
| ------- | ------------------------- | ---------- |
| 1       | Akanksha                  | 4VP24CS006 |
| 2       | G Madhura Shastry         | 4VP24CS035 |
| 3       | Muralikrishna D           | 4VP24CS060 |
| 4       | Niveditha marcopolo totar | 4VP24CS065 |

---

**KrishiSetu — Connecting Farmers to Markets, Building Fairer Opportunities.**
