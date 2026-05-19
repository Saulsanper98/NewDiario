import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { countUnreadChatMessages } from "@/lib/chat/access";
import type { SessionUser } from "@/lib/auth/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const unread = await countUnreadChatMessages(user.id);
  return NextResponse.json({ unread });
}
