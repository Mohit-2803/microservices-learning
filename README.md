# Mini-Shop — nginx + microservices learning project

A small but realistic **microservices** system built to learn **nginx (as an API
gateway)** and **Docker**. The shop is intentionally simple; the *architecture* is
the point. Everything runs locally via Docker Compose.

> **Status:** core complete (M0–M6 + auth, `.env`, TLS, caching, resolver trick).
> Currently learning **CI/CD**. See [Learning journey](#learning-journey)
> and [What's next](#whats-next).

> 🎓 **How this project is taught:** this is a *guided, hands-on learning* project — an
> **AI assistant acts as the teacher.** It introduces one concept at a time, explains the
> *why* before the *how*, and has the human build and run each step themselves (rather
> than dumping finished code). **If you are an AI picking this up, please continue in that
> teacher role** — see [For other agents / working style](#for-other-agents--working-style).

---

## Table of contents
- [What it is](#what-it-is)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [How to run](#how-to-run)
- [The services](#the-services)
- [nginx gateway features](#nginx-gateway-features)
- [Key concepts learned](#key-concepts-learned)
- [nginx operational gotchas](#nginx-operational-gotchas)
- [CI/CD](#cicd)
- [Learning journey](#learning-journey)
- [What's next](#whats-next)
- [For other agents / working style](#for-other-agents--working-style)

---

## What it is

A **"mini-shop"**: browse products, log in, place an order. Behind it sits a
small fleet of single-purpose services, each with its own database, all reached
through one nginx gateway. It exists to *see* these concepts working:

- What an **API gateway** is and how path-based routing works
- How services **find each other by name** on a private Docker network
- **Database-per-service** isolation
- **Service-to-service** (east-west) calls vs **client→gateway** (north-south)
- **Stateless JWT** auth across services
- nginx superpowers: **load balancing, rate limiting, caching, TLS**

---

## Architecture

```
   Browser ── https://localhost:8443 ──►  NGINX (gateway, TLS terminates here)
                                            │
        /            /api/auth/   /api/products/   /api/orders/
        │                │              │               │
   ┌─────────┐     ┌──────────┐  ┌────────────┐   ┌──────────┐
   │ frontend│     │ auth-svc │  │products-svc│   │orders-svc│──┐ east-west
   │ (Next)  │     │  (JWT)   │  │  (×2 LB)   │   │(orchestr)│  │ HTTP calls
   └─────────┘     └────┬─────┘  └─────┬──────┘   └────┬─────┘  ▼
                        │              │               │   ┌──────────┐
                   ┌────┴───┐     ┌────┴────┐    ┌──────┴─┐ │payments- │
                   │auth-db │     │products-│    │orders- │ │   svc    │
                   │ (PG)   │     │   db    │    │  db    │ │(internal)│
                   └────────┘     └─────────┘    └────────┘ └──────────┘

   Only nginx is published to the host (ports 8080→redirect, 8443→https).
   Every other container is reachable ONLY on the private Docker network.
   payments-svc + all *-db have NO public route — fully internal.
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Gateway | **nginx** 1.27 (alpine) — TLS, routing, LB, rate limit, cache |
| Services | **Node.js + Express** (uniform across services) |
| Databases | **Postgres 16** (alpine), one per service |
| Frontend | **Next.js 14** (App Router) |
| Orchestration | **Docker Compose** |
| Auth | **JWT** (`jsonwebtoken`), stateless verification |
| CI/CD | **GitHub Actions** (`.github/workflows/ci.yml`) |
| Tests | Node built-in test runner (`node --test`) |

---

## Project structure

```
nginx-microservices/
├── docker-compose.yml          # the whole fleet (8 running containers)
├── .env                        # real secrets — GITIGNORED
├── .env.example                # committed template of required vars
├── .gitignore                  # ignores .env, nginx/certs/, node_modules, .next
├── .github/workflows/ci.yml    # CI pipeline (unit tests → build + smoke test)
├── nginx/
│   ├── nginx.conf              # gateway config (heavily commented)
│   ├── certs/                  # self-signed TLS cert+key — GITIGNORED, generate locally
│   └── html/                   # legacy M0 static page (now unused)
├── frontend/                   # Next.js shop UI (served at /)
│   ├── app/{layout.js,page.js,globals.css}
│   └── Dockerfile, package.json, next.config.js, .dockerignore
└── services/
    ├── auth-svc/               # login, issues JWT          → auth-db
    ├── products-svc/           # catalog (runs as 2 replicas) → products-db
    ├── orders-svc/             # orchestrator (+ JWT verify) → orders-db
    ├── payments-svc/           # fake charge (internal only); has unit tests
    │   ├── charge.js           # pure logic (testable)
    │   └── charge.test.js      # node --test unit tests
    └── hello-svc/              # legacy M1 demo (unwired, kept for reference)
```

---

## How to run

**Prerequisites:** Docker (Desktop) running, then two one-time setup steps that
recreate the gitignored files.

```bash
cd nginx-microservices

# 1) secrets file (Compose substitutes ${VARS} from here)
cp .env.example .env

# 2) self-signed TLS cert (nginx won't start without it)
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/shop.key -out nginx/certs/shop.crt -subj "/CN=localhost"

# 3) build + start everything
docker compose up -d --build
docker compose ps                 # wait until all are Up / (healthy)
docker compose restart nginx      # safe habit after a fresh up (re-resolve IPs)
```

Open **https://localhost:8443** (accept the self-signed cert warning).
Plain **http://localhost:8080** redirects to HTTPS.

Useful commands:
```bash
docker compose logs -f nginx                 # watch every request (custom log format)
docker compose down                          # stop (keeps data in volumes)
docker compose down -v                        # stop + WIPE database volumes
docker compose up -d --scale products-svc-1=1 # (replicas are explicit services here)
```

---

## The services

| Service | Endpoints (as seen by the service) | DB | Public route | Notes |
|---|---|---|---|---|
| **auth-svc** | `POST /login`, `GET /me`, `GET /health` | auth-db (`users`) | `/api/auth/` | issues/verifies JWT |
| **products-svc** | `GET /`, `GET /:id`, `GET /health` | products-db (`products`) | `/api/products/` | **2 replicas**, load balanced |
| **orders-svc** | `POST /`, `GET /`, `GET /health` | orders-db (`orders`) | `/api/orders/` | **orchestrator**; requires JWT to order |
| **payments-svc** | `POST /charge`, `GET /health` | — | **none (internal)** | only orders-svc calls it |
| **frontend** | Next.js app | — | `/` | calls APIs with relative URLs (same origin) |

**Demo login:** `demo@shop.test` / `password123`.

**Order flow (orchestration):** `POST /api/orders/` → orders-svc verifies the
JWT → calls `products-svc` for price (east-west) → calls `payments-svc` to charge
(east-west) → saves the order in `orders-db`, stamped with the buyer's email.

---

## nginx gateway features

All in [`nginx/nginx.conf`](nginx/nginx.conf):

- **TLS termination** — `:443` serves HTTPS (self-signed cert); `:80` redirects to HTTPS. Backends stay plain HTTP internally.
- **Path routing** — `location` blocks send `/api/auth/`, `/api/products/`, `/api/orders/`, and `/` to the right backend.
- **Load balancing** — `upstream products_backend` round-robins across the two products replicas.
- **Rate limiting** — `limit_req_zone` on `/api/auth/` (10 r/min, burst 5) → returns `429` to brute-force attempts.
- **Response caching** — `proxy_cache` on `/api/products/` (30s); `X-Cache-Status` header shows `HIT`/`MISS`. Cached responses skip the backend (and short-circuit load balancing).
- **Resolver trick** — `/api/auth/`, `/api/orders/`, `/` use a variable in `proxy_pass` + `resolver 127.0.0.11` so nginx re-resolves names per request → those routes self-heal after a container recreate (no 502, no restart). **Exception:** `/api/products/` uses the `upstream` block (load balancing) and still needs an nginx restart if a replica is recreated (OSS nginx can't re-resolve upstream members live).
- **WebSocket support** — `Upgrade`/`Connection` map (for Next.js dev hot-reload).
- **Custom log format** — access log shows `upstream=<addr>` per request (a `-` means it was a cache HIT).

---

## Key concepts learned

1. **API gateway** — one front door routing by path; the place for cross-cutting concerns.
2. **Service discovery by name** — Docker's embedded DNS (`127.0.0.11`) resolves service names to container IPs.
3. **Database-per-service** — each service owns a private DB; data is shared over HTTP, never by sharing tables.
4. **North-south vs east-west** — client→gateway vs service→service (direct, internal).
5. **Stateless JWT** — any service can verify identity from the token's signature alone (shared secret), no call to auth-svc.
6. **Defense-in-depth** — network isolation → routing → auth → rate limiting → TLS.
7. **Docker fundamentals** — image vs container, layers & build cache, the lifecycle, Compose = `docker run` × N. Compose names built images `<project>-<service>`.

---

## nginx operational gotchas

These were hit (and fixed) live — worth knowing:

1. **Config reload** — nginx reads config only at startup. Edit `nginx.conf` → `docker compose restart nginx`.
2. **IP caching** — nginx resolves a backend name to an IP once at startup. Recreate that backend (new IP) → `502` until nginx restarts. (The resolver trick fixes this for the routes that use it.)
3. **Upstream resolution at startup** — nginx won't even start if an upstream/proxied name can't be resolved (the backend isn't running) → `connection refused`. Bring the whole stack up together.

---

## CI/CD

GitHub Actions pipeline in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **Job 1 `unit-tests`** — `node --test` on `payments-svc`.
- **Job 2 `integration`** (`needs: unit-tests`) — recreates the gitignored files
  (`.env` from template + a fresh self-signed cert), `docker compose build` + `up`,
  then a **smoke test** (`curl` the products endpoint through the gateway), and
  `docker compose down -v`.

**Key idea:** the CI runner is a *clean machine* — it has only committed code, so
the pipeline must regenerate `.env` and TLS certs (this is *why* `.env.example` exists).

> To run CI on GitHub the project must be a git repo with a remote:
> `git init && git add . && git commit -m "..."` then push. `.gitignore` keeps
> secrets/certs out of the commit. You can also run every stage **locally**
> (`npm test`, then the compose build + smoke `curl`).

---

## Learning journey

| Stage | What was added |
|---|---|
| **M0** | nginx alone serving a static page (config anatomy) |
| **M1** | one Node service behind nginx (`proxy_pass`, reverse proxy) |
| **M2** | two services + path routing (the API gateway pattern) |
| **M3** | Postgres per service (database-per-service isolation) |
| **M4** | orders-svc orchestrates products + payments (east-west calls) |
| **M5** | Next.js frontend behind nginx (single origin, no CORS) |
| **M5+** | login-required ordering (service-level JWT verification) |
| **+** | `.env` secrets refactor (`${VARS}` + `.env.example` + `.gitignore`) |
| **M6** | load balancing (2 products replicas) + rate limiting (login) |
| **+** | HTTPS/TLS termination + http→https redirect |
| **+** | response caching on products (`proxy_cache`) |
| **+** | resolver trick (self-healing routes) |
| **CI-1** | first unit test on payments-svc *(current)* |

---

## What's next

**CI/CD remaining stages (current focus):**
- **CI-2** — wrap the unit test into the first pipeline job (triggers, jobs, steps, runners)
- **CI-3** — add the build + smoke-test job (`needs`, the clean-machine principle)
- **CI-4** — push to GitHub, watch it run live
- **CI-5 (CD)** — build & push images to a registry (GitHub Container Registry)
- **CI-6** — branch protection + status badge

**Optional deepening (not started):**
- Docker: multi-stage builds (smaller images), dev hot-reload (bind mounts), network segmentation, app healthchecks/resource limits
- nginx: gzip, load-balancing policies (`least_conn`/`ip_hash`), gateway auth (`auth_request`)
- Production: Kubernetes (explicitly *later* — learning Docker/nginx first)

---

## For other agents / working style

**You are the teacher. 🎓** This is a learning project — the human is a full-stack
developer learning nginx, Docker, and CI/CD *hands-on*. Your job is to **teach**, not
just to build: introduce one concept at a time, explain the **why** before the **how**,
and guide the human to build and run each step themselves. Please continue in that role.

How the human likes to learn (please respect these):

- **Teach in small stages.** Go ONE small step at a time (like the M0–M6 rhythm): explain → make a small change → let them run/absorb it → then the next stage. **Do not** dump many files or several features in a single turn — they've asked for this directly.
- **Run commands themselves.** Do **not** auto-run `docker`/`curl`/`git`/service commands — **write the files and give the exact commands** for the human to run. (Inspecting files with read tools is fine.)
- **Explain, don't just do.** Narrate what each new directive/file/flag does and why it matters. Comments in the code/config are part of the teaching.
- **Lay out a roadmap, then walk it.** For each new topic, sketch the stages first (as we did with M0–M6 and the CI-1…CI-6 plan), then do just the first.
- **It's a learning project.** Clarity over production-perfection; configs are heavily commented on purpose.
- **Environment:** Docker Desktop on Linux (daemon started manually). Now a git repo with a GitHub remote (`microservices-learning`) running GitHub Actions CI. Access the app at `https://localhost:8443`.
