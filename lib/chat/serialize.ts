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
    /** Cuando es true, el preview se renderiza como "Mensaje eliminado". */
    isDeleted?: boolean;
  } | null;
  unreadCount: number;
  /** Estado personal de cada usuario sobre la conversacion. */
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  /** ISO si esta silenciada y todavia no ha caducado el mute. */
  mutedUntil: string | null;
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

/** Reaccion agrupada a un mensaje. */
export type ChatReactionSummary = {
  emoji: string;
  count: number;
  /** Ids de los usuarios que la han marcado. */
  userIds: string[];
  /** True si el usuario actual la ha marcado. */
  mine: boolean;
};

/** Snippet de un mensaje al que se esta respondiendo, lo justo para
 *  renderizar el bloque cita encima del mensaje. */
export type ChatReplySnippet = {
  id: string;
  /** Si el snippet refiere a un mensaje borrado, body sera null. */
  body: string | null;
  senderId: string;
  senderName: string;
  /** Tipo de adjunto principal (si solo era adjunto sin texto). */
  attachmentHint: ChatAttachmentKind | null;
  isDeleted: boolean;
};

export type ChatMessageItem = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  isMine: boolean;
  sender: ChatPeer;
  attachments: ChatAttachmentItem[];
  /** Marca de edicion del autor. */
  editedAt: string | null;
  /** Soft-delete; cuando viene se renderiza "Mensaje eliminado" y no debe
   *  exponer body ni adjuntos. */
  isDeleted: boolean;
  /** Mensaje al que responde (o null si no es una respuesta). */
  replyTo: ChatReplySnippet | null;
  /** Reacciones agrupadas por emoji. */
  reactions: ChatReactionSummary[];
};
