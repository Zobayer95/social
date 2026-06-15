import { FeedClient } from "@/components/feed/feed-client";
import { getCurrentUser } from "@/lib/auth-session";
import { serverRpc } from "@/lib/rpc/server";

// Always render fresh — the feed is per-viewer and frequently updated.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function FeedPage() {
  const user = await getCurrentUser();
  // AppLayout already guards this, but narrow the type for TS.
  if (!user) return null;

  const initial = await serverRpc.post.getFeed({ limit: PAGE_SIZE });

  return (
    <FeedClient
      currentUser={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image ?? null,
      }}
      initialData={initial}
      pageSize={PAGE_SIZE}
    />
  );
}
