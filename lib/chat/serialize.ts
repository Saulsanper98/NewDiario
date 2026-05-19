export type ChatPeer = {
  id: string;
  name: string;
  email: string;
  image: string | null;
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
