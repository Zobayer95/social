import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/feed/sign-out-button";
import { UserAvatar, fullName } from "@/components/feed/user-avatar"; 
import { getCurrentUser } from "@/lib/auth-session";

export default async function AppLayout({
  children,
}: {   
  children: React.ReactNode; 
}) {    
  const user = await getCurrentUser();    
  if (!user) { 
    redirect("/login"); 
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <span className="text-lg font-semibold tracking-tight">
            Social Feed
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <UserAvatar user={user} className="size-8" />
              <span className="hidden text-sm font-medium sm:inline">
                {fullName(user)}
              </span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
