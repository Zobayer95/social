# Social Feed — Execution Plan

Planning document for the Appifylab Full Stack Engineer selection task.

---

## 1. Scope (from requirements)

Convert the three provided HTML/CSS pages (**Login**, **Register**, **Feed**) into a
full-stack **Next.js** app. Stick to the provided design — do not redesign.

**Auth & Authorization**
- Secure session-based auth with proper authorization.
- Register: `firstName`, `lastName`, `email`, `password`.
- Login → access the feed. No "forgot password" needed.

**Feed (protected route)**
1. Create posts with **text + image**.
2. Show posts **newest first**.
3. Correct **like/unlike** state per viewer.
4. **Comments, replies**, and like/unlike on each.
5. Show **who liked** a post / comment / reply.
6. **Private** (author-only) vs **Public** (everyone) posts.

**Cross-cutting:** best practices, standard DB modeling, designed for **millions of posts/reads**,
**security + UX** as top priorities.

**Deliverables:** GitHub repo · YouTube walkthrough (unlisted) · live deployment (recommended) · brief docs.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router)** — fullstack, TypeScript (strict) |
| Auth | **Better Auth** — email/password, session-based, cookie sessions |
| ORM | **Prisma** |
| Database | **Neon Postgres** (pooled `DATABASE_URL`; unpooled for migrations) |
| Data layer | **oRPC** — typed procedures under `server/[module]/`, one router+service per module |
| Server reads | `serverRpc` (oRPC `createRouterClient`) called **directly in RSCs** — no HTTP round-trip |
| Client interactions | `@orpc/tanstack-query` over the `/api/rpc` HTTP handler — caching, optimistic likes, infinite scroll |
| Styling | Provided HTML/CSS → Tailwind or CSS Modules (match the supplied design) |
| Image upload | UploadThing / Cloudinary (object storage) — **no DB blobs** |
| Validation | **Zod** schemas, shared as procedure `.input()` contracts |
| Deployment | **Vercel** + Neon |

> Pattern adapted from the reference project `proa-erp` (oRPC + Better Auth), swapping Drizzle → **Prisma** and co-located `_modules/` → the requested **`server/[module]/`** layout.

---

## 3. Project Structure

**Single Next.js app — not a monorepo.** The rpc plumbing the reference kept in `packages/rpc`
is inlined under `src/lib/rpc/`. Business modules live in `src/server/[module]/`.

```
social/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/register/page.tsx
│   │   ├── (app)/feed/page.tsx              # protected RSC — reads via serverRpc
│   │   ├── api/auth/[...all]/route.ts       # Better Auth handler
│   │   ├── api/rpc/[[...rest]]/route.ts     # oRPC HTTP handler (client calls)
│   │   └── layout.tsx                       # wraps QueryClientProvider
│   ├── server/                              # ── the data layer: one folder per module
│   │   ├── post/
│   │   │   ├── post.router.ts               # procedures (.input + .handler → service)
│   │   │   ├── post.service.ts              # business logic + Prisma queries
│   │   │   └── post.validation.ts           # Zod input schemas
│   │   ├── comment/                          # comments + replies (self-referential)
│   │   ├── like/                             # toggle like on post / comment / reply
│   │   ├── upload/                           # image upload procedure
│   │   └── auth/                             # auth.router + auth.service (register/login)
│   ├── lib/
│   │   ├── rpc/
│   │   │   ├── base.ts                       # os.$context<BaseContext>(), procedures
│   │   │   ├── middlewares.ts                # error, logging, auth (validateSession)
│   │   │   ├── router.ts                     # appRouter = { post, comment, like, ... }
│   │   │   ├── server.ts                     # serverRpc = createRouterClient (RSC)
│   │   │   ├── client.ts                     # HTTP client → /api/rpc
│   │   │   └── query.ts                      # orpc = createTanstackQueryUtils(client)
│   │   ├── auth.ts                           # Better Auth server config + Prisma adapter
│   │   ├── auth-client.ts                    # Better Auth client
│   │   └── prisma.ts                         # singleton PrismaClient
│   ├── components/                           # UI ported from the provided design
│   └── middleware.ts                         # edge guard on /feed
└── .env
```

**Module convention (`server/[module]/`):** each module = **router + service + validation**.
- `*.router.ts` — oRPC procedures: `protectedProcedure.input(Schema).handler(({input, context}) => service(...))`. Thin; no logic.
- `*.service.ts` — `import 'server-only'`; the actual Prisma queries and business rules.
- `*.validation.ts` — Zod schemas used as `.input()` contracts (typed end-to-end on the client).

All module routers are registered in `src/lib/rpc/router.ts` as `appRouter`.

**Two consumption paths from the same procedures:**
- **Server (RSC):** `import { serverRpc } from '@/lib/rpc/server'` → `await serverRpc.post.getFeed({cursor})`. Direct call, no HTTP, runs in the request — ideal for the initial feed render.
- **Client:** `import { orpc } from '@/lib/rpc/query'` → `useQuery(orpc.post.getFeed.queryOptions(...))` / `useMutation(orpc.like.toggle.mutationOptions(...))`. Powers optimistic likes, comment posting, infinite scroll, and cache invalidation.

---

## 4. Data Model (Prisma)

Designed for scale: integer/cuid PKs, polymorphic-free likes via separate join tables,
indexes on every hot query path, denormalized counters to avoid `COUNT(*)` at read time.

```
User        id, firstName, lastName, email(unique), createdAt          (+ Better Auth tables: account, session, verification)
Post        id, authorId→User, text, imageUrl?, visibility(PUBLIC|PRIVATE), likeCount, commentCount, createdAt
Comment     id, postId→Post, authorId→User, parentId?→Comment (reply), text, likeCount, createdAt
PostLike    id, postId, userId        @@unique([postId, userId])
CommentLike id, commentId, userId     @@unique([commentId, userId])
```

**Key indexes**
- `Post(visibility, createdAt desc)` — public feed, newest first.
- `Post(authorId, createdAt desc)` — author's own private posts.
- `Comment(postId, createdAt)` and `Comment(parentId)` — threads & replies.
- `@@unique` on likes prevents double-likes and powers "did *I* like this".

**Decisions**
- `replies` = self-referential `Comment.parentId` (one level, per spec). Keeps one table, one like system.
- `likeCount` / `commentCount` denormalized, updated in the same transaction as the like/comment
  → feed renders without aggregate scans (the "millions of reads" requirement).
- "Who liked" = paginated query on the `*Like` table joined to `User`, loaded on demand (modal), not in the feed payload.
- Images stored in object storage; DB holds only `imageUrl`.

---

## 4a. oRPC Layer (the data layer)

Three procedure tiers, each composing middlewares (adapted from `proa-erp`):

```ts
// src/lib/rpc/base.ts
const base = os.$context<BaseContext>().use(errorMiddleware).use(loggingMiddleware);
export const publicProcedure    = base;                    // register, login
export const protectedProcedure = base.use(authMiddleware); // everything in the feed
```

- **`authMiddleware`** calls Better Auth's `validateSession()`; on success injects `{ user, session }`
  into context and throws `ORPCError('UNAUTHORIZED')` otherwise. `authorId`/`userId` always come
  from `context.user.id` — never from client input.
- **Router** (`src/lib/rpc/router.ts`) = `{ auth, post, comment, like, upload }`.
- **HTTP handler** at `app/api/rpc/[[...rest]]/route.ts` exports `GET, POST` from `createHandler(appRouter, { prefix: '/api/rpc' })` — reads are `GET` (cacheable), mutations `POST`.
- **`serverRpc`** = `createRouterClient(appRouter, { context: async () => ({ headers: await headers() }) })` for RSC reads.
- **`orpc`** = `createTanstackQueryUtils(client)` for client components.

Example module:
```ts
// server/post/post.router.ts
export const postRouter = {
  getFeed: protectedProcedure.route({ method: 'GET' }).input(FeedQuerySchema)
    .handler(({ input, context }) => PostService.getFeed(input, context.user.id)),
  create: protectedProcedure.route({ method: 'POST' }).input(CreatePostSchema)
    .handler(({ input, context }) => PostService.create(input, context.user.id)),
};
```

## 5. Authorization Rules

| Action | Rule |
|---|---|
| View feed | Authenticated only (middleware + action-level check). |
| View post | PUBLIC → anyone logged in. PRIVATE → author only. |
| Create post/comment/like | Authenticated; `authorId` = session user (never trusted from client). |
| Delete post/comment | Author only. |
| Toggle like | Authenticated; one row per (target, user) enforced by `@@unique`. |

Every server action re-checks the session — never rely on the client or middleware alone.

---

## 6. Build Phases

1. **Scaffold** — Next.js + TS strict, Tailwind, Prisma, ESLint, TanStack Query provider. Commit `.env` keys (Neon URLs).
2. **DB & Prisma** — write `schema.prisma`, `prisma migrate` against Neon (unpooled URL), generate client, singleton.
3. **oRPC plumbing** — `lib/rpc/{base,middlewares,router,server,client,query}.ts` + `api/rpc` handler. Empty `appRouter` first, verify a ping procedure end-to-end (RSC + client).
4. **Better Auth** — config, Prisma adapter, `auth` module (register/login procedures), `validateSession`, `authMiddleware`, edge middleware on `/feed`.
5. **Auth pages** — port Login + Register HTML/CSS, wire to `auth` procedures, Zod validation, error UX.
6. **Feed read path** — `post` module `getFeed` (visibility filter + cursor pagination), render feed RSC via `serverRpc` (newest first), client infinite scroll via `orpc`.
7. **Create post** — text + image upload procedure, optimistic UI, query invalidation.
8. **Likes** — `like.toggle` for posts (then comments/replies), correct per-viewer state, "who liked" modal.
9. **Comments & replies** — create/list, one-level replies, their like system.
10. **Visibility** — public/private toggle on compose, enforced in `PostService` queries.
11. **Hardening** — rate-limit mutations, validate uploads (type/size), error boundaries, loading/empty states.
12. **Deliverables** — deploy to Vercel, README/docs, record YouTube walkthrough.

---

## 7. Security & Performance Checklist

- Sessions in httpOnly, secure, sameSite cookies (Better Auth defaults).
- All input validated server-side via Zod `.input()` contracts; never trust client-supplied `authorId`/`userId` — derive from `context.user.id`.
- Authorization enforced in `authMiddleware` + re-checked in each service (ownership/visibility), not just edge middleware.
- Cursor-based pagination on feed & comments (no `OFFSET` at scale); feed reads use `GET` procedures for cacheability.
- Denormalized counters + targeted indexes for read-heavy load.
- Image uploads: restrict MIME/size, store off-DB, serve via CDN.
- Rate-limit write actions; basic abuse protection.
- No secrets in client bundles; `.env` only on server.

---

## 8. Open Items / Assumptions

- **HTML/CSS source files not yet in repo** — needed before porting auth pages & feed (Phase 4). Drop the three provided files in `/design` or share them.
- Image host: defaulting to **UploadThing** for speed; swap to Cloudinary if preferred.
- Replies limited to **one level** (comment → reply), matching the spec; deeper nesting not built.
- Following the provided design as-is; only functional gaps (modals for "who liked", toggles) added minimally.

---

## 9. Environment

```
DATABASE_URL=<Neon pooled>            # app runtime (pgbouncer)
DATABASE_URL_UNPOOLED=<Neon direct>  # prisma migrate / introspection
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=http://localhost:3000
UPLOADTHING_TOKEN=<upload provider>
```
