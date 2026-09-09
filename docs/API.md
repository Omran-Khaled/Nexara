# 📜 Nexara Digital Library & Living Forest System — API Documentation

**Version:** 2.5.0  
**Base URL:** `https://<domain>/api` (or `http://localhost:3000/api` in development)  
**Protocol:** HTTPS / HTTP (REST JSON)  
**Encoding:** UTF-8  

---

## 📑 Table of Contents
1. [Overview & Architectural Philosophy](#1-overview--architectural-philosophy)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Core REST API Endpoints](#3-core-rest-api-endpoints)
   - [GET /api/health](#get-apihealth)
   - [GET /api/supabase/status](#get-apisupabasestatus)
4. [External & Public Domain Integration Protocols](#4-external--public-domain-integration-protocols)
   - [Open Library Discovery Protocol](#open-library-discovery-protocol)
   - [Internet Archive & Project Gutenberg Direct Streaming](#internet-archive--project-gutenberg-direct-streaming)
5. [Cloud Synchronization Schema (Supabase)](#5-cloud-synchronization-schema-supabase)
   - [Tables & Field Definitions](#tables--field-definitions)
6. [Response Codes & Error Handling](#6-response-codes--error-handling)
7. [Caching & Performance Directives](#7-caching--performance-directives)

---

## 1. Overview & Architectural Philosophy
The Nexara API layer is built on a **High-Performance Full-Stack Express & Vite Runtime**. It prioritizes zero-latency state synchronization, deterministic public domain document resolution, and seamless client-side hydration.

### Key Characteristics:
- **Zero Heavy Dependencies**: Streamlined JSON routing for sub-millisecond status handshakes.
- **Client-Side Offloading**: Audio synthesis (Web Audio API) and PDF generation (`jspdf`) run entirely client-side, reducing server load.
- **Resilient Fallback**: Offline-first persistence via `localStorage` with non-blocking cloud syncing via Supabase.

---

## 2. Authentication & Authorization
Nexara employs a hybrid authentication model:
- **Public Endpoints**: `/api/health` and public domain search queries require no token.
- **Cloud State Synchronization**: Secured via Supabase Auth (JWT bearer tokens stored securely in client storage).
- **Header Format**:
  ```http
  Authorization: Bearer <supabase_jwt_token>
  Content-Type: application/json
  ```

---

## 3. Core REST API Endpoints

### `GET /api/health`

Performs the **readiness** check for the running service. It verifies required runtime dependencies rather than merely confirming that Express can return a response. In the production server, this includes a live MongoDB `ping`, file-storage connectivity, Supabase authentication availability when production configuration makes it required, and the malware scanner when scans are mandatory.

| Endpoint | Purpose | Success | Dependency failure |
|---|---|---:|---:|
| `GET /api/health/live` | Liveness only; confirms the process can accept requests. | `200` | Not used for dependency checks. |
| `GET /api/health` | Backward-compatible readiness endpoint. | `200` | `503` |
| `GET /api/health/ready` | Explicit readiness endpoint. | `200` | `503` |

A readiness response exposes only dependency names, required flags, status, and latency; it does not disclose connection strings, credentials, provider error bodies, or stack traces.

#### Request:
```http
GET /api/health HTTP/1.1
Host: localhost:3000
Accept: application/json
```

#### Response (200 OK):
```json
{
  "status": "ok",
  "service": "Nexara Digital Library & Living Forest System",
  "timestamp": "2026-08-15T09:00:00.000Z",
  "supabaseProjectId": "eubvnnbquunrpgjpjuqk",
  "version": "2.5.0",
  "mode": "development"
}
```

#### Response Attributes:
| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | `string` | System health status (`"ok"`, `"degraded"`, `"error"`). |
| `service` | `string` | Registered service identity. |
| `timestamp` | `ISO 8601 string` | Current server timestamp in UTC. |
| `supabaseProjectId` | `string` | Target cloud database reference project ID. |
| `version` | `string` | Semantic application and engine version. |
| `mode` | `string` | Execution environment (`"development"` \| `"production"`). |

---

### `GET /api/supabase/status`
Returns real-time status of the remote database schema synchronization, active database tables, and cloud gateway endpoints.

#### Request:
```http
GET /api/supabase/status HTTP/1.1
Host: localhost:3000
Accept: application/json
```

#### Response (200 OK):
```json
{
  "connected": true,
  "projectId": "eubvnnbquunrpgjpjuqk",
  "endpoint": "https://eubvnnbquunrpgjpjuqk.supabase.co",
  "tables": [
    "user_profiles",
    "reading_progress",
    "bookmarks",
    "highlights",
    "time_capsules",
    "memory_groves"
  ],
  "lastSync": "2026-08-15T09:00:00.000Z"
}
```

---

### P11 — Personal Library and Community

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/reading-history?limit=50` | Required | Returns the authenticated user's persisted reading events. |
| `POST` | `/api/reading-history/:bookId/open` | Required | Records a verified reader-session opening for an owned session. |
| `PUT` | `/api/collections/:id/books` | Required | Replaces the authenticated owner's collection membership after validating book references. |
| `GET` | `/api/community/reviews?limit=50` | Optional | Returns persisted community reviews; includes viewer like state when authenticated. |
| `PUT` | `/api/reviews/:id/like` | Required | Sets the authenticated user's explicit reaction state with `{ "liked": boolean }`. |
| `GET` | `/api/reviews/:id/comments` | Optional | Lists persisted discussion replies for one review. |
| `POST` | `/api/reviews/:id/comments` | Required | Creates a persisted discussion reply for the authenticated user. |

> User identity is never accepted from P11 request payloads as an authorization source. The server derives ownership from the authenticated principal and validates all book, collection, and review references before writing durable data.

---

## 4. External & Public Domain Integration Protocols

The client discovery engine (`src/lib/onlineBookSearch.ts`) communicates directly with open public domain repositories:

### Open Library Discovery Protocol
- **Endpoint**: `https://openlibrary.org/search.json?q={query}&limit=20`
- **Purpose**: Search indexed metadata across millions of classical works.
- **Transformed Data Model**:
  ```typescript
  interface PublicDomainBookResult {
    id: string;
    title: string;
    author: string;
    firstPublishYear: number;
    coverUrl: string;
    gutenbergId?: string;
    iaId?: string; // Internet Archive ID
    formats: {
      readOnlineUrl?: string;
      pdfUrl?: string;
      epubUrl?: string;
      txtUrl?: string;
    };
  }
  ```

### Internet Archive & Project Gutenberg Direct Streaming
- **Gutenberg Text**: `https://www.gutenberg.org/files/{id}/{id}-0.txt`
- **Internet Archive Details**: `https://archive.org/metadata/{ia_id}`
- **Direct PDF/EPUB Download**: Direct byte streaming via browser blobs managed by `src/lib/downloadEngine.ts`.

---

## 5. Cloud Synchronization Schema (Supabase)

### Target Project: `eubvnnbquunrpgjpjuqk.supabase.co`

```
┌───────────────────────────────────────────────────────────┐
│                     USER PROFILES                         │
│  - id (UUID, PK)                                          │
│  - email (String)                                         │
│  - display_name (String)                                  │
│  - current_streak (Integer)                               │
│  - total_pages_read (Integer)                             │
│  - created_at (Timestamp)                                 │
└─────────────────────────────┬─────────────────────────────┘
                              │ 1:N
           ┌──────────────────┴──────────────────┐
           │                                     │
┌──────────▼───────────────┐          ┌──────────▼───────────────┐
│     READING PROGRESS     │          │      MEMORY GROVES       │
│  - id (UUID, PK)         │          │  - id (UUID, PK)         │
│  - user_id (UUID, FK)    │          │  - user_id (UUID, FK)    │
│  - book_id (String)      │          │  - tree_type (String)    │
│  - current_page (Int)    │          │  - book_title (String)   │
│  - total_pages (Int)     │          │  - reflection (Text)     │
│  - completion_pct (Float)│          │  - coordinates (JSONB)   │
│  - updated_at (Timestamp)│          │  - planted_at (Timestamp)│
└──────────────────────────┘          └──────────────────────────┘
```

---

## 6. Response Codes & Error Handling

Standard HTTP status codes are returned:

| Code | Meaning | Description |
| :--- | :--- | :--- |
| `200 OK` | Success | The request completed successfully and payload is returned. |
| `304 Not Modified`| Cached | Static assets match client ETag. |
| `400 Bad Request` | Invalid Input | Malformed JSON or missing required fields. |
| `404 Not Found` | Route Not Found | The requested resource or API route does not exist. |
| `500 Internal Error` | Server Error | Uncaught server exception; structured error message returned. |

#### Error Response Format:
```json
{
  "error": "Error identifier",
  "message": "Human-readable description of what went wrong",
  "timestamp": "2026-08-15T09:00:00.000Z"
}
```

---

## 7. Caching & Performance Directives

1. **Static Build Assets (`dist/*`)**:
   - `Cache-Control: public, max-age=86400`
   - `ETag: W/"..."` enabled for efficient 304 validation.
2. **Real-time Endpoints (`/api/*`)**:
   - `Cache-Control: no-store, no-cache, must-revalidate`
   - Real-time headers ensure live status reporting without stale proxies.
