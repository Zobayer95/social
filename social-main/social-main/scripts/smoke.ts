/**
 * End-to-end smoke test: drives the real HTTP stack (Better Auth + oRPC).
 * Run against a running server:  BASE=http://localhost:3001 bunx tsx scripts/smoke.ts
 */
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "../src/lib/rpc/router";

const BASE = process.env.BASE ?? "http://localhost:3001";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function signUp(email: string) {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Better Auth CSRF: Origin must match the configured baseURL.
      origin: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    },
    body: JSON.stringify({
      email,
      password: "password123",
      name: "Test User",
      firstName: "Test",
      lastName: "User",
    }),
  });
  assert(res.ok, `sign-up ${res.status} ${await res.text()}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert(cookie.includes("session"), "session cookie set");
  return cookie;
}

function clientFor(cookie: string): RouterClient<AppRouter> {
  const link = new RPCLink({ url: `${BASE}/api/rpc`, headers: () => ({ cookie }) });
  return createORPCClient(link);
}

async function main() {
  const stamp = Date.now();
  const cookieA = await signUp(`alice_${stamp}@test.dev`);
  const cookieB = await signUp(`bob_${stamp}@test.dev`);
  const alice = clientFor(cookieA);
  const bob = clientFor(cookieB);
  console.log("✓ two users registered (Better Auth + Prisma + Neon)");

  // unauthenticated rpc must be rejected
  let rejected = false;
  try {
    await clientFor("").post.getFeed({ limit: 5 });
  } catch {
    rejected = true;
  }
  assert(rejected, "unauthenticated getFeed rejected");
  console.log("✓ unauthenticated rpc rejected (authMiddleware)");

  // Alice creates a public + a private post
  const pub = await alice.post.create({ text: "Alice public post", visibility: "PUBLIC" });
  const priv = await alice.post.create({ text: "Alice private post", visibility: "PRIVATE" });
  console.log("✓ posts created");

  // Bob's feed: sees Alice's public, NOT her private
  const bobFeed = await bob.post.getFeed({ limit: 50 });
  const ids = bobFeed.items.map((p) => p.id);
  assert(ids.includes(pub.id), "bob sees public post");
  assert(!ids.includes(priv.id), "bob does NOT see private post");
  console.log("✓ visibility enforced (public visible, private hidden)");

  // newest first
  const p2 = await alice.post.create({ text: "newest" });
  const aliceFeed = await alice.post.getFeed({ limit: 50 });
  assert(aliceFeed.items[0]?.id === p2.id, "newest first");
  console.log("✓ newest-first ordering");

  // Bob likes Alice's public post (toggle on/off)
  const like1 = await bob.like.togglePost({ postId: pub.id });
  assert(like1.liked && like1.likeCount === 1, "like adds");
  const likers = await alice.post.likers({ postId: pub.id });
  assert(likers.items.some((l) => l.user.firstName === "Test"), "who-liked lists bob");
  const like2 = await bob.like.togglePost({ postId: pub.id });
  assert(!like2.liked && like2.likeCount === 0, "unlike removes");
  console.log("✓ like / unlike / who-liked");

  // Bob can't toggle like on Alice's private post
  let privLikeRejected = false;
  try {
    await bob.like.togglePost({ postId: priv.id });
  } catch {
    privLikeRejected = true;
  }
  assert(privLikeRejected, "bob cannot like private post");
  console.log("✓ private post protected from non-author actions");

  // Comments + replies + comment likes
  const comment = await bob.comment.create({ postId: pub.id, text: "nice!" });
  const reply = await alice.comment.create({
    postId: pub.id,
    parentId: comment.id,
    text: "thanks!",
  });
  assert(reply.parentId === comment.id, "reply linked to parent");
  // nested reply must be rejected (one level)
  let nestedRejected = false;
  try {
    await bob.comment.create({ postId: pub.id, parentId: reply.id, text: "no" });
  } catch {
    nestedRejected = true;
  }
  assert(nestedRejected, "nested replies rejected");

  const cLike = await alice.like.toggleComment({ commentId: comment.id });
  assert(cLike.liked && cLike.likeCount === 1, "comment like");

  const topComments = await bob.comment.forPost({ postId: pub.id });
  assert(topComments.items.length === 1, "one top-level comment");
  assert(topComments.items[0]?.replyCount === 1, "reply count = 1");
  const replies = await bob.comment.replies({ commentId: comment.id });
  assert(replies.items.length === 1, "one reply");
  console.log("✓ comments, replies (1-level), comment likes, counts");

  // commentCount denormalized on post
  const feedAfter = await alice.post.getFeed({ limit: 50 });
  const pubRow = feedAfter.items.find((p) => p.id === pub.id);
  assert(pubRow?.commentCount === 1, "post.commentCount = 1 (top-level only)");
  console.log("✓ denormalized commentCount correct");

  console.log("\nALL SMOKE TESTS PASSED ✅");
}

main().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
