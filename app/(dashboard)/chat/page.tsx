import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ChatView } from "@/components/chat/ChatView";
import type { SessionUser } from "@/lib/auth/types";
import { Loader2 } from "lucide-react";

function ChatLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/30" />
    </div>
  );
}


export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;

  return (
    <div className="chat-page-root flex h-full min-h-0 flex-col overflow-hidden">
      <Header user={user} breadcrumb={[{ label: "Mensajes" }]} />
      <Suspense fallback={<ChatLoading />}>
        <ChatView />
      </Suspense>
    </div>
  );
}
