export type ChatPeer = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  imageFocusX: number | null;
  imageFocusY: number | null;
  profileBanner: string | null;
  bannerFocusX: number | null;
  bannerFocusY: number | null;
};

export type ChatConversationItem = {
  id: string;
  updatedAt: string;
  /** True si es un grupo (>=3 personas). */
  isGroup: boolean;
  /** Titulo del grupo (solo grupos). */
  title: string | null;
  /** Imagen del grupo (solo grupos). */
  image: string | null;
  /** Para 1-a-1: el otro participante. Para grupos: no se usa (peer es null). */
  peer: ChatPeer | null;
  /** Lista de miembros (sin contar al usuario actual). */
  members: ChatPeer[];
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    senderName: string;
    isMine: boolean;
  } | null;
  unreadCount: number;
};

export type ChatAttachmentKind = "FILE" | "IMAGE" | "TASK" | "PROJECT" | "NOTE";

export type ChatAttachmentItem = {
  id: string;
  kind: ChatAttachmentKind;
  // File / image
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  // Referencias internas (tarea / proyecto / nota)
  refId: string | null;
  refLabel: string | null;
  refMeta: Record<string, unknown> | null;
};

export type ChatMessageItem = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  isMine: boolean;
  sender: ChatPeer;
  attachments: ChatAttachmentItem[];
};
