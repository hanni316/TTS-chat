import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ChatInput } from '@/components/ChatInput';
import { MessageBubble } from '@/components/MessageBubble';
import { EmptyState } from '@/components/EmptyState';
import { TTSStatusBar } from '@/components/TTSStatusBar';
import { backend } from '@/services/backend';
import { ttsEngine } from '@/tts/ttsEngine';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';
import { useBackendBus } from '@/hooks/useBackendBus';
import { safeDecode } from '@/lib/safeDecode';
import type { Message, ServerEvent } from '@/types';

const SENDER_COLORS = [
  '#A88BFF',
  '#22D3EE',
  '#34D399',
  '#F472B6',
  '#FBBF24',
  '#F87171',
  '#60A5FA',
  '#FB7185',
];

export function ChatRoomPage() {
  const me = useAuthStore((s) => s.user)!;
  const settings = useSettingsStore((s) => s.settings);
  const push = useToastStore((s) => s.push);
  const nav = useNavigate();
  const { roomId: rawRoomId } = useParams<{ roomId: string }>();
  const roomId = safeDecode(rawRoomId);
  // re-render on any event for this room
  useBackendBus(
    useMemo(
      () =>
        (e: ServerEvent) => {
          const p = e.payload as { roomId?: string; senderId?: string } | undefined;
          if (e.type === 'message:new' || e.type === 'message:deleted') {
            return p?.roomId === roomId;
          }
          if (e.type === 'typing') return p?.roomId === roomId;
          if (e.type === 'room:updated' || e.type === 'friend:updated') return true;
          if (e.type === 'message:read') return p?.roomId === roomId;
          return false;
        },
      [roomId]
    )
  );

  const room = backend.getRoom(roomId);
  const messages = backend.listMessages(roomId);
  const memberProfiles = useMemo(() => {
    if (!room) return new Map<string, ReturnType<typeof backend.getProfile>>();
    const m = new Map<string, ReturnType<typeof backend.getProfile>>();
    for (const id of room.memberIds) m.set(id, backend.getProfile(id));
    return m;
  }, [room]);

  const senderColor = useMemo(() => {
    const map = new Map<string, string>();
    if (!room) return map;
    const others = room.memberIds.filter((id) => id !== me.id);
    others.forEach((id, i) => map.set(id, SENDER_COLORS[i % SENDER_COLORS.length]));
    return map;
  }, [room, me.id]);

  const otherDmId = room?.type === 'dm' ? room.memberIds.find((m) => m !== me.id) : undefined;
  const dmFriendship = otherDmId ? backend.getFriendship(me.id, otherDmId) : null;
  const mutedForFriend = dmFriendship?.mutedBy[me.id] ?? false;
  const blockedFriend = dmFriendship?.blockedBy[me.id] ?? false;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, room?.id]);

  // Mark read whenever the room is visible
  useEffect(() => {
    if (!room) return;
    backend.markRead(room.id, me.id);
  }, [room, me.id, messages.length]);

  // Autoplay new incoming messages
  const lastSpokenIdsRef = useRef<Set<string>>(new Set());
  const autoplaySeededRef = useRef(false);
  useEffect(() => {
    if (!room) return;
    // On first run, seed every existing message id so we never replay history
    // (e.g. when entering the room via a notification). Only ids that arrive
    // after this seed will be spoken.
    if (!autoplaySeededRef.current) {
      autoplaySeededRef.current = true;
      for (const m of messages) lastSpokenIdsRef.current.add(m.id);
      return;
    }
    if (settings.globalMuted) return;
    if (!settings.autoplay) return;
    if (mutedForFriend) return;
    if (blockedFriend) return;
    for (const m of messages) {
      if (m.senderId === me.id) {
        lastSpokenIdsRef.current.add(m.id);
        continue;
      }
      if (m.deleted) continue;
      if (lastSpokenIdsRef.current.has(m.id)) continue;
      const sender = memberProfiles.get(m.senderId);
      ttsEngine.speak(
        {
          text: m.text,
          senderId: m.senderId,
          senderName: sender?.nickname,
          announceSender: room.type === 'group',
        },
        settings
      );
      lastSpokenIdsRef.current.add(m.id);
    }
  }, [messages, settings, room, me.id, memberProfiles, mutedForFriend, blockedFriend]);

  // Stop TTS when leaving the room
  useEffect(() => {
    return () => ttsEngine.clearQueue();
  }, []);

  const onSend = async (text: string): Promise<boolean> => {
    try {
      await backend.sendMessage(roomId, me.id, text);
      return true;
    } catch (e) {
      push((e as Error).message, 'error');
      return false;
    }
  };

  // Throttle typing writes: only emit typing=true once every few seconds so we
  // don't issue a Firestore write on every keystroke. typing=false is sent
  // immediately and resets the throttle.
  const lastTypingSentRef = useRef(0);
  const TYPING_THROTTLE_MS = 2500;
  const onTyping = (typing: boolean) => {
    if (!typing) {
      lastTypingSentRef.current = 0;
      backend.setTyping(roomId, me.id, false);
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    backend.setTyping(roomId, me.id, true);
  };

  const onReplay = (m: Message) => {
    const sender = memberProfiles.get(m.senderId);
    ttsEngine.speak(
      {
        text: m.text,
        senderId: m.senderId,
        senderName: sender?.nickname,
        announceSender: room?.type === 'group',
      },
      settings
    );
  };

  const onDelete = async (m: Message) => {
    try {
      await backend.deleteMessage(roomId, m.id, me.id);
    } catch (e) {
      push((e as Error).message, 'error');
    }
  };

  const toggleMuteFriend = async () => {
    if (!otherDmId || !dmFriendship) return;
    try {
      await backend.setFriendMuted(me.id, otherDmId, !mutedForFriend);
    } catch (e) {
      push((e as Error).message, 'error');
    }
  };

  if (!room) {
    return (
      <>
        <AppHeader title="채팅방" back />
        <EmptyState
          title="채팅방을 찾을 수 없어요"
          action={
            <button onClick={() => nav('/home')} className="btn-primary mt-2">
              홈으로
            </button>
          }
        />
      </>
    );
  }

  const title =
    room.type === 'group'
      ? room.name ?? '그룹'
      : (() => {
          const otherId = room.memberIds.find((m) => m !== me.id)!;
          const o = memberProfiles.get(otherId);
          return (
            backend.getFriendship(me.id, otherId)?.nicknames[otherId] ?? o?.nickname ?? '친구'
          );
        })();

  const subtitle =
    room.type === 'group'
      ? `${room.memberIds.length}명`
      : (() => {
          const other = room.memberIds.find((m) => m !== me.id)!;
          const o = memberProfiles.get(other);
          return o ? `친구 코드 ${o.friendCode}` : '';
        })();

  const typing = backend.getTyping(roomId);
  const typingNames = Object.keys(typing)
    .filter((id) => id !== me.id)
    .map((id) => memberProfiles.get(id)?.nickname)
    .filter(Boolean) as string[];

  const detailHref =
    room.type === 'group'
      ? `/detail/group/${encodeURIComponent(room.id)}`
      : `/detail/friend/${encodeURIComponent(room.memberIds.find((m) => m !== me.id)!)}`;

  return (
    <>
      <AppHeader
        title={title}
        subtitle={subtitle}
        back
        right={
          <div className="flex items-center gap-1">
            {room.type === 'dm' && (
              <button
                onClick={toggleMuteFriend}
                aria-label="이 친구 TTS 음소거"
                className={`rounded-full p-2 ${
                  mutedForFriend ? 'text-brand bg-brand/15' : 'text-ink-mute hover:bg-bg-elevated'
                }`}
              >
                {mutedForFriend ? '🔇' : '🔊'}
              </button>
            )}
            <Link
              to={detailHref}
              aria-label="상세"
              className="rounded-full p-2 text-ink-mute hover:bg-bg-elevated"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="19" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </Link>
          </div>
        }
      />
      <TTSStatusBar />

      <main ref={scrollRef} className="scroll-fade flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <EmptyState
            title={room.type === 'dm' ? '첫 메시지를 보내보세요' : '그룹의 첫 메시지를 남겨보세요'}
            description="메시지를 보내면 상대 기기의 TTS로 재생돼요"
          />
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const isMe = m.senderId === me.id;
              const showSender =
                room.type === 'group' && (!prev || prev.senderId !== m.senderId);
              const sender = memberProfiles.get(m.senderId) ?? undefined;
              const color = senderColor.get(m.senderId);

              let readByLabel: string | undefined;
              if (isMe) {
                if (room.type === 'dm') {
                  const otherRead = m.readBy.some((id) => id !== me.id);
                  readByLabel = otherRead ? undefined : '안읽음';
                } else {
                  const readers = m.readBy.filter((id) => id !== me.id).length;
                  const total = room.memberIds.length - 1;
                  if (readers < total) readByLabel = `${total - readers}명 안읽음`;
                }
              }

              return (
                <li key={m.id}>
                  <MessageBubble
                    message={m}
                    sender={sender ?? undefined}
                    isMe={isMe}
                    showSender={showSender}
                    senderColor={color}
                    readByLabel={readByLabel}
                    onReplay={() => onReplay(m)}
                    onDelete={() => void onDelete(m)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {typingNames.length > 0 && (
          <div className="mt-2 px-1 text-xs text-ink-mute">
            {room.type === 'group'
              ? `${typingNames.join(', ')}님이 입력 중...`
              : '입력 중...'}
          </div>
        )}
      </main>

      <ChatInput onSend={onSend} onTyping={onTyping} />
    </>
  );
}
