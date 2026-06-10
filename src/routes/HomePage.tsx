import { Link, useNavigate } from 'react-router-dom';
import { backend } from '@/services/backend';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useBackendBus } from '@/hooks/useBackendBus';
import { useNotificationToggle } from '@/hooks/useNotificationToggle';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { FriendCodeChip } from '@/components/FriendCodeChip';
import { EmptyState } from '@/components/EmptyState';
import { Toggle } from '@/components/Toggle';

export function HomePage() {
  const me = useAuthStore((s) => s.user)!;
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.set);
  const notif = useNotificationToggle();
  // recompute every time the backend emits any event
  useBackendBus();
  const nav = useNavigate();

  const rooms = backend.listRooms(me.id);
  const friendships = backend.listFriendships(me.id);
  const friendsById = new Map<string, ReturnType<typeof backend.getProfile>>();
  for (const f of friendships) {
    const other = f.userIds.find((id) => id !== me.id)!;
    friendsById.set(other, backend.getProfile(other));
  }
  const pendingIncoming = backend.listIncomingRequests(me.id).length;

  const dmRooms = rooms.filter((r) => r.type === 'dm');
  const groupRooms = rooms.filter((r) => r.type === 'group');

  return (
    <>
      <AppHeader
        title={`안녕하세요, ${me.nickname}`}
        right={
          <Link
            to="/settings"
            aria-label="설정"
            className="rounded-full p-2 text-ink-mute hover:bg-bg-elevated"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </Link>
        }
      />

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        {/* My code card */}
        <section className="card flex items-center gap-4 p-4">
          <Avatar name={me.nickname} url={me.avatarUrl} size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-mute">내 친구 코드</div>
            <div className="mt-1">
              <FriendCodeChip code={me.friendCode} />
            </div>
          </div>
        </section>

        {/* Quick toggles: TTS + desktop notifications */}
        <section className="rounded-2xl bg-bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-semibold">전역 TTS</div>
              <div className="text-xs text-ink-mute">
                {settings.globalMuted ? '음소거 중 · 텍스트만 표시돼요' : '새 메시지가 음성으로 재생돼요'}
              </div>
            </div>
            <Toggle
              checked={!settings.globalMuted}
              onChange={(v) => setSetting('globalMuted', !v)}
              label="전역 TTS"
            />
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">데스크톱 알림</div>
              <div className="text-xs text-ink-mute">
                {!notif.supported
                  ? '이 브라우저는 알림을 지원하지 않아요'
                  : notif.permission === 'denied'
                  ? '브라우저에서 알림이 차단되어 있어요'
                  : notif.enabled
                  ? '새 메시지가 도착하면 시스템 알림으로 표시'
                  : '꺼짐 · 켜면 OS 알림으로 새 메시지를 받아요'}
              </div>
            </div>
            <Toggle checked={notif.enabled} onChange={notif.toggle} label="데스크톱 알림" />
          </div>
        </section>

        {/* Add / requests */}
        <section className="grid grid-cols-2 gap-2">
          <button onClick={() => nav('/add')} className="btn-ghost">
            <Plus />
            친구·그룹 추가
          </button>
          <button onClick={() => nav('/add?tab=requests')} className="btn-ghost relative">
            <Inbox />
            받은 요청
            {pendingIncoming > 0 && (
              <span className="absolute right-3 top-2 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand px-1 text-[11px] text-white">
                {pendingIncoming}
              </span>
            )}
          </button>
        </section>

        {/* Group list */}
        <section>
          <SectionTitle text="그룹" count={groupRooms.length} />
          {groupRooms.length === 0 ? (
            <p className="px-1 text-xs text-ink-dim">아직 그룹이 없어요.</p>
          ) : (
            <ul className="space-y-1">
              {groupRooms.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/room/${encodeURIComponent(r.id)}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg-elevated"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-elevated text-base">
                      👥
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.name}</div>
                      <div className="truncate text-xs text-ink-mute">
                        {r.memberIds.length}명 ·{' '}
                        {r.lastMessagePreview ?? '아직 대화가 없어요'}
                      </div>
                    </div>
                    <UnreadBadge count={backend.unreadCount(r.id, me.id)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Friend list */}
        <section className="flex-1">
          <SectionTitle text="친구" count={dmRooms.length} />
          {dmRooms.length === 0 ? (
            <EmptyState
              title="아직 친구가 없어요"
              description="친구 코드를 공유해서 첫 친구를 추가해보세요"
              action={
                <button onClick={() => nav('/add')} className="btn-primary mt-2">
                  친구 추가하기
                </button>
              }
            />
          ) : (
            <ul className="space-y-1">
              {dmRooms.map((r) => {
                const otherId = r.memberIds.find((m) => m !== me.id)!;
                const friend = friendsById.get(otherId);
                if (!friend) return null;
                return (
                  <li key={r.id}>
                    <Link
                      to={`/room/${encodeURIComponent(r.id)}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg-elevated"
                    >
                      <Avatar name={friend.nickname} url={friend.avatarUrl} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {backend.getFriendship(me.id, otherId)?.nicknames[otherId] ??
                              friend.nickname}
                          </span>
                          {backend.getFriendship(me.id, otherId)?.mutedBy[me.id] && (
                            <span className="chip">🔇 음소거</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-ink-mute">
                          {r.lastMessagePreview ?? `안녕! ${friend.nickname}님과 채팅을 시작해보세요`}
                        </div>
                      </div>
                      <UnreadBadge count={backend.unreadCount(r.id, me.id)} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SectionTitle({ text, count }: { text: string; count: number }) {
  return (
    <div className="mb-1 flex items-baseline gap-2 px-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{text}</h3>
      <span className="text-xs text-ink-dim">{count}</span>
    </div>
  );
}

function Plus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function Inbox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 12h-6l-2 3h-4l-2-3H2m20 0v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6m20 0l-3.5-7A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.9 1L2 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
