export type ID = string;

export type Iso = string;

export interface UserProfile {
  /** Same value as Firebase Auth uid. Named `id` to avoid ripple changes
   * through the codebase that already reads `me.id` everywhere. */
  id: ID;
  email: string;
  nickname: string;
  avatarUrl?: string;
  friendCode: string;
  friendCodeRotatedAt: Iso;
  createdAt: Iso;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface FriendRequest {
  id: ID;
  fromUserId: ID;
  toUserId: ID;
  status: FriendRequestStatus;
  createdAt: Iso;
  respondedAt?: Iso;
}

export interface Friendship {
  id: ID; // canonical: sorted([a,b]).join(':')
  userIds: [ID, ID];
  createdAt: Iso;
  nicknames: Record<ID, string | undefined>; // alias for each side
  mutedBy: Record<ID, boolean>; // per-user TTS mute
  blockedBy: Record<ID, boolean>;
  chatRoomId: ID;
}

export type ChatRoomType = 'dm' | 'group';

export interface ChatRoom {
  id: ID;
  type: ChatRoomType;
  name?: string; // group name (dm name comes from the other participant)
  memberIds: ID[];
  ownerId?: ID; // group creator
  createdAt: Iso;
  lastMessageAt?: Iso;
  lastMessagePreview?: string;
}

export interface Message {
  id: ID;
  roomId: ID;
  senderId: ID;
  text: string;
  createdAt: Iso;
  // who has read it (user ids). For dm: 0 or 1 reader. For group: counted.
  readBy: ID[];
  deleted?: boolean;
}

export type TypingState = Record<ID /* userId */, number /* expiresAt ms */>;

export interface AppSettings {
  globalMuted: boolean;
  autoplay: boolean;
  language: 'ko-KR';
  voiceURI?: string; // preferred default voice
  rate: 0.8 | 1.0 | 1.2 | 1.5;
  volume: number; // 0..1
  announceSender: boolean; // group: prepend "○○님:" before TTS
  emojiToSpeech: boolean;
  profanityMask: boolean;
  desktopNotifications: boolean; // OS-level toast on incoming messages
}

export const DEFAULT_SETTINGS: AppSettings = {
  globalMuted: false,
  autoplay: true,
  language: 'ko-KR',
  voiceURI: undefined,
  rate: 1.0,
  volume: 0.8,
  announceSender: true,
  emojiToSpeech: true,
  profanityMask: true,
  desktopNotifications: false,
};

export interface ServerEvent {
  type:
    | 'message:new'
    | 'message:deleted'
    | 'message:read'
    | 'room:updated'
    | 'friend:requested'
    | 'friend:updated'
    | 'typing'
    | 'profile:updated';
  payload: unknown;
  at: number;
}
