# Social Feed

A full-stack social feed: register, sign in, and share posts (text + image) that
others can like, comment on, and reply to — with public/private visibility.

Built for the Appifylab Full Stack Engineer selection task. See [`PLANNING.md`](./PLANNING.md)
for the original execution plan.

## Features

- **Auth & authorization** — email/password (first name, last name, email, password)
  via session cookies. The feed is a protected route.
- **Feed** — public posts from everyone + your own private posts, newest first,
  cursor-paginated (infinite scroll).
- **Posts** — create with text and/or image; `PUBLIC` (everyone) or `PRIVATE` (author only); delete your own.
- **Likes** — like/unlike posts, comments, and replies, with correct per-viewer state
  and a "liked by" list.
- **Comments & replies** — threaded one level deep, each with its own like system.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Turbopack), React 19, TypeScript (strict) |
| Auth | [Better Auth](https://better-auth.com) — email/password, cookie sessions |
| Data layer | [oRPC](https://orpc.dev) — typed procedures, `server/[module]/` pattern |
| Client data | TanStack Query (`@orpc/tanstack-query`) — caching, optimistic likes, infinite scroll |
| ORM / DB | Prisma 7 (pg driver adapter) on Neon Postgres |
| UI | shadcn/ui + Tailwind CSS v4 |
| Validation | Zod (procedure `.input()` contracts) |

## Architecture

```
src/
├── app/
│   ├── (auth)/{login,register}/   # auth pages (Better Auth client)
│   ├── (app)/feed/                # protected feed (RSC initial fetch)
│   ├── api/auth/[...all]/         # Better Auth handler
│   ├── api/rpc/[[...rest]]/       # oRPC HTTP handler (client calls)
│   └── api/upload/                # protected image upload
├── server/<module>/               # data layer: router + service + validation
│   ├── post/  comment/  like/  upload/
├── lib/
│   ├── rpc/                        # oRPC plumbing (base, middlewares, router, server, client, query)
│   ├── auth.ts  auth-client.ts  auth-session.ts
│   └── prisma.ts
├── components/feed/                # feed UI
└── proxy.ts                        # Next 16 route guard (optimistic)
```

**Two ways the same procedures are consumed** (the core oRPC concept):

- **Server (RSC):** `serverRpc.post.getFeed(...)` runs the procedure directly — no HTTP
  round-trip — to render the initial feed.
- **Client:** `orpc.post.getFeed.infiniteOptions(...)` / `orpc.like.togglePost.mutationOptions(...)`
  go over `/api/rpc` for caching, optimistic updates, and infinite scroll.

Each module is **thin router → service → validation**: routers wire `protectedProcedure`
to Zod-validated inputs; services hold the Prisma logic. `authMiddleware` validates the
session and injects `context.user` — the user id always comes from the session, never the client.

## Key design decisions

- **Built for read scale.** Denormalized `likeCount` / `commentCount` (updated in the same
  transaction as the write) so the feed never runs `COUNT(*)`. Composite indexes back every
  hot query: `(visibility, createdAt desc)` for the public feed, `(authorId, createdAt desc)`
  for own posts, and `@@unique([postId, userId])` on likes (prevents double-likes and powers
  "did I like this"). Cursor pagination everywhere — no `OFFSET`.
- **Replies = self-referential comments** (`parentId`), capped at one level per the spec —
  one table, one like system.
- **Authorization in depth.** Optimistic cookie check in `proxy.ts`, real checks in
  `authMiddleware` + per-service visibility/ownership rules (e.g. you can't like or comment
  on someone else's private post).
- **Security.** httpOnly/secure/sameSite session cookies, Better Auth CSRF (Origin) checks,
  Zod validation on every input, upload MIME/size limits, emails never exposed in DTOs.

## Getting started

Requires Node 20.9+ and [bun](https://bun.sh) (or npm).

```bash
bun install
cp .env.example .env      # fill in DATABASE_URL(s) + BETTER_AUTH_SECRET
bun run db:generate       # generate Prisma client
bun run db:migrate        # apply migrations to your database
bun run dev               # http://localhost:3000
```

Environment variables (see `.env.example`):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon URL — app runtime |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL — Prisma migrations |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | App origin (e.g. `http://localhost:3000`) |

## Scripts

| Script | Description |
|---|---|
| `bun run dev` / `build` / `start` | Next.js dev / build / serve |
| `bun run lint` / `typecheck` | ESLint / TypeScript strict check |
| `bun run db:migrate` / `db:deploy` / `db:studio` | Prisma migrate / deploy / studio |
| `bun run smoke` | End-to-end test against a running server (`BASE=http://localhost:3001 bun run smoke`) |

The smoke test (`scripts/smoke.ts`) registers users and exercises the full HTTP stack:
auth, visibility, ordering, likes/who-liked, comments/replies, nested-reply rejection, and
denormalized counters.

## Deploying to Vercel

1. **Push to GitHub** and import the repo in Vercel.
2. **Create a Neon Postgres** integration (or reuse your DB) and a **Vercel Blob store**
   (Storage tab) — the Blob store injects `BLOB_READ_WRITE_TOKEN` automatically.
3. **Set environment variables** (Project → Settings → Environment Variables):

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled URL |
   | `DATABASE_URL_UNPOOLED` | Neon direct URL |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | `https://<your-domain>` |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` |
   | `BLOB_READ_WRITE_TOKEN` | auto-added by the Blob store |

4. **Migrations** — the schema is already applied to Neon. After future schema changes run
   `bun run db:deploy` (locally against prod, or as a build step).
5. **Deploy.** `build` runs `prisma generate && next build`.

Notes:
- **Image uploads** use **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set. Locally (no token)
  they're written to `./uploads` and served via `GET /api/uploads/[name]` — not `public/`, since
  Next only serves files present in `public/` at startup. Only the returned URL is stored in the DB.
- **Preview deployments** get fresh domains; `auth.ts` adds `VERCEL_URL` to `trustedOrigins`
  so Better Auth's CSRF checks pass there too.

## Notes on the provided design

The task referenced three HTML/CSS pages (Login, Register, Feed) that were not included in the
handoff. The UI here is a clean, functional implementation with shadcn/ui covering all required
behaviors; drop the original markup into the components to match the exact design.
