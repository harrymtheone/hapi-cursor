# Why HAPI?

[Happy](https://github.com/slopus/happy) is an excellent project. So why build HAPI?

**The short answer**: Happy uses a centralized server that stores your encrypted data. HAPI is decentralized — each user runs their own hub, and the relay server only forwards encrypted traffic without storing anything. These different goals lead to fundamentally different architectures.

## TL;DR

| Aspect | Happy | HAPI |
|--------|-------|------|
| **Architecture** | Centralized (cloud server stores encrypted data) | Decentralized (each user runs own hub) |
| **Users** | Multi-user on shared server | Any number (each runs own hub) |
| **Data** | Encrypted on server (server cannot read) | Stays on your machine |
| **Encryption** | Application-layer E2EE (client encrypts before sending) | WireGuard + TLS via relay; or none needed if self-hosted |
| **Deployment** | Multiple services (PostgreSQL, Redis, app server) | Single binary |
| **Complexity** | High (E2EE, key management, scaling) | Low (one command) |

**Choose HAPI if**: You want data sovereignty, self-hosting, and minimal setup.

**Choose Happy if**: You need a managed cloud service with multi-user collaboration.

## Architecture Comparison

### Happy: Centralized Cloud

Happy's centralized design requires:

- **Application-layer E2EE** — Clients encrypt before sending; the server stores encrypted blobs it cannot read
- **Distributed database + cache** — PostgreSQL + Redis for multi-user scaling
- **Complex deployment** — Docker, multiple services, config files

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             PUBLIC INTERNET                             │
│                                                                         │
│   ┌─────────────┐                    ┌─────────────────────────────────┐│
│   │             │                    │        Cloud Server             ││
│   │  Mobile App │◄───── E2EE ───────►│                                 ││
│   │             │                    │  ┌─────────────────────────────┐││
│   └─────────────┘                    │  │   Encrypted Database        │││
│                                      │  │   (server cannot read)      │││
│                                      │  └─────────────────────────────┘││
│                                      └────────────────┬────────────────┘│
│                                                       │ E2EE            │
└───────────────────────────────────────────────────────┼─────────────────┘
                                                        ▼
                                             ┌───────────────────┐
                                             │       CLI         │
                                             │ (holds the keys)  │
                                             └───────────────────┘
```

The server stores encrypted data — it never sees plaintext, but it does hold your data.

### HAPI: Decentralized

Each user runs their own hub. This fork is optimized for one remote access path:

- **User-managed private networking** (Tailscale, own server, or another path you control) — Your hub stays local and you control the full network path
- **Single embedded database** — SQLite, no external services
- **One-command deployment** — Single binary, zero config

#### Mode 1: Self-Hosted (own server or tunnel)

You control the entire path. No encryption beyond standard HTTPS is needed.

```
┌────────────────────────────────────────────────────────────────────────┐
│                       YOUR NETWORK / TUNNEL                            │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                   Single Process / Binary                      │   │
│   │                                                                │   │
│   │  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │   │
│   │  │   CLI    │◄──►│   Hub    │◄──►│ Web App  │                  │   │
│   │  └──────────┘    └────┬─────┘    └──────────┘                  │   │
│   │                       │                                        │   │
│   │                       ▼                                        │   │
│   │              ┌────────────────┐                                │   │
│   │              │ Local Database │                                │   │
│   │              │  (plaintext)   │                                │   │
│   │              └────────────────┘                                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                            │                                           │
│                            ▼ HTTPS                                     │
│               ┌────────────────────────┐                               │
│               │ Cloudflare / Tailscale │                               │
│               │ / Public IP / etc.     │                               │
│               └────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────────┘
```

#### Mode 2: Private Network Access

For phone or tablet access, run the hub locally and reach it through your own private network.

```
┌────────────────────────────────────────────────────────────────────────┐
│                       YOUR MACHINE                                     │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                   Single Process / Binary                      │   │
│   │                                                                │   │
│   │  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │   │
│   │  │   CLI    │◄──►│   Hub    │◄──►│ Web App  │                  │   │
│   │  └──────────┘    └────┬─────┘    └──────────┘                  │   │
│   │                       │                                        │   │
│   │                       ▼                                        │   │
│   │              ┌────────────────┐                                │   │
│   │              │ Local Database │                                │   │
│   │              │  (plaintext)   │                                │   │
│   │              └────────────────┘                                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                            │                                           │
│                            ▼ Private network / HTTPS                   │
└────────────────────────────┼───────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Your Phone /   │
                    │  Browser        │
                    └─────────────────┘
```

## Key Differences

### Data Location

| Aspect | Happy | HAPI |
|--------|-------|------|
| **Where data lives** | Cloud server (encrypted blobs) | Your own machine |
| **Who stores it** | Central server holds encrypted data | Only your hub, locally |
| **Data at rest** | Encrypted (server cannot read) | Plaintext (protected by OS) |
| **Server's role** | Stores encrypted data + syncs devices | No shared server; your own hub serves the app |

### Deployment Model

**Happy** requires orchestrating multiple components:

```
┌───────────────────────────────────────────────────────────────────┐
│   Distributed Services (4+ components)                            │
│                                                                   │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│   │ Database │  │  Cache   │  │ Storage  │  │  Server  │          │
│   │(Postgres)│  │ (Redis)  │  │ (Files)  │  │(Node.js) │          │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                   │
│   Requires: Container orchestration, multiple config files        │
└───────────────────────────────────────────────────────────────────┘
```

**HAPI** bundles everything:

```
┌───────────────────────────────────────────────────────────────────┐
│   Single Binary (everything bundled)                              │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────────┐ │
│   │  CLI + Hub + Web App + Database (SQLite, embedded)          │ │
│   └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│   Requires: One command to run                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Security Approach

| Aspect | Happy | HAPI |
|--------|-------|------|
| **Problem** | Data on untrusted server | Remote access to your local hub |
| **Solution** | Application-layer E2EE | User-managed private networking or HTTPS |
| **Key management** | Client holds keys; server never sees plaintext | Not needed for the single-user local hub model |
| **Data at rest** | Encrypted on server | Plaintext on your machine |

## Why Different Architectures?

### Happy: Centralized

```
Goal: Multi-user cloud platform
         │
         ├──► Server stores user data
         │         └──► Must encrypt everything (application-layer E2EE)
         │
         ├──► Many concurrent users on one server
         │         └──► Must scale horizontally (PostgreSQL, Redis)
         │
         └──► Multiple devices per user
                   └──► Must sync encrypted state across devices
```

**Result**: Sophisticated infrastructure with zero-knowledge server

### HAPI: Decentralized

```
Goal: Self-hosted tool — each user runs their own hub
         │
         ├──► Data never leaves your machine
         │         └──► No application-layer E2EE needed
         │
         ├──► Each user has their own hub
         │         └──► No horizontal scaling needed; unlimited users in aggregate
         │
        ├──► Private network access (Tailscale / own server)
         │         └──► You control the full path — HTTPS sufficient
```

**Result**: Simple, portable, one-command deployment

## Summary

| Dimension | Happy | HAPI |
|-----------|-------|------|
| **Architecture** | Centralized cloud server | Decentralized (each user runs own hub) |
| **Server's role** | Stores encrypted data | Your local hub serves your own devices |
| **Data location** | Server (encrypted, zero-knowledge) | Local (plaintext, your machine) |
| **Deployment** | Multiple services (PostgreSQL, Redis, Node.js) | Single binary (embedded SQLite) |
| **Encryption** | Application-layer E2EE (client-side) | Your private network or HTTPS |
| **Scaling** | Horizontal (multi-user on shared server) | Per-user (each runs own hub) |
| **Target user** | Managed cloud service users | Self-hosters who want data sovereignty |

## Conclusion

The architectural differences stem from a centralized vs decentralized design:

- **Happy**: Centralized cloud server that stores your encrypted data. The server never sees plaintext (zero-knowledge), but it does hold your data. This requires application-layer E2EE, key management, and distributed infrastructure (PostgreSQL, Redis, scaling).

- **HAPI**: Decentralized — each user runs their own hub. Your data stays on your machine. For remote access, use a network path you control, such as Tailscale or your own HTTPS endpoint. This keeps deployment simple without a bundled public tunnel.

The core tradeoff: Happy solves the "untrusted server" problem with sophisticated encryption. HAPI avoids the problem entirely by keeping your data on your own machine.
