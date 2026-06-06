import { redirect } from "next/navigation";

/* Chat DESACTIVADO por decisión de producto.
 *
 * Esta página redirige a /dashboard para cualquier usuario que aún tenga
 * el enlace en marcadores o llegue desde una notificación antigua.
 *
 * El código original (Header + Suspense + ChatView) está intacto en el
 * histórico de git. Para reactivar: revertir este archivo + el commit que
 * tocó Sidebar/MobileNav/layout del dashboard. APIs (`/api/chat/*`),
 * modelos Prisma (ChatConversation, ChatParticipant, ChatMessage,
 * ChatAttachment, ChatMessageReaction) y datos en BD permanecen intactos.
 */
export default function ChatPage(): never {
  redirect("/dashboard");
}
