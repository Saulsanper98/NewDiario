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
  peer: ChatPeer;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    isMine: boolean;
  } | null;
  unreadCount: number;
};

export type ChatMessageItem = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  isMine: boolean;
  sender: ChatPeer;
};
