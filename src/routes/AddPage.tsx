import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { backend } from '@/services/backend';
import { useAuthStore } from '@/state/authStore';
import { useToastStore } from '@/state/toastStore';
import { useBackendBus } from '@/hooks/useBackendBus';
import { FRIEND_CODE_LENGTH, isValidFriendCode } from '@/lib/friendCode';

type Tab = 'code' | 'requests' | 'group';

export function AddPage() {
  const me = useAuthStore((s) => s.user)!;
  const push = useToastStore((s) => s.push);
  const nav = useNavigate();
  const [search, setSearch] = useSearchParams();
  const tab: Tab = (search.get('tab') as Tab) ?? 'code';
  useBackendBus();

  const setTab = (t: Tab) => {
    if (t === 'code') search.delete('tab');
    else search.set('tab', t);
    setSearch(search, { replace: true });
  };

  return (
    <>
      <AppHeader title="친구·그룹 추가" back />
      <div className="border-b border-white/5 px-4">
        <nav className="flex gap-1">
          <TabBtn active={tab === 'code'} onClick={() => setTab('code')} label="코드로 추가" />
          <TabBtn
            active={tab === 'requests'}
            onClick={() => setTab('requests')}
            label="받은 요청"
            badge={backend.listIncomingRequests(me.id).length}
          />
          <TabBtn active={tab === 'group'} onClick={() => setTab('group')} label="그룹 만들기" />
        </nav>
      </div>
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'code' && <CodeTab onSent={() => push('친구 요청을 보냈어요', 'success')} />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'group' && (
          <GroupTab
            onCreated={(roomId) => {
              push('그룹을 만들었어요', 'success');
              nav(`/room/${encodeURIComponent(roomId)}`, { replace: true });
            }}
          />
        )}
      </main>
    </>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px border-b-2 px-3 py-3 text-sm transition ${
        active ? 'border-brand text-ink' : 'border-transparent text-ink-mute hover:text-ink'
      }`}
    >
      {label}
      {!!badge && badge > 0 && (
        <span className="ml-1 inline-grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function CodeTab({ onSent }: { onSent: () => void }) {
  const me = useAuthStore((s) => s.user)!;
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidFriendCode(code)) {
      setError(`${FRIEND_CODE_LENGTH}자리 영문 대문자/숫자 코드여야 해요. (0, O, 1, I, L 제외)`);
      return;
    }
    setSubmitting(true);
    try {
      await backend.sendFriendRequest(me.id, code);
      setCode('');
      onSent();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? '요청에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-ink-mute">
        친구의 <span className="text-brand">{FRIEND_CODE_LENGTH}자리</span> 친구 코드를
        입력해주세요.
      </p>
      <input
        autoFocus
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, FRIEND_CODE_LENGTH))}
        placeholder="예: A3K9F"
        maxLength={FRIEND_CODE_LENGTH}
        className="input text-center font-mono text-2xl tracking-[0.4em]"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={submitting || code.length < FRIEND_CODE_LENGTH}
      >
        {submitting ? '요청 중...' : '친구 요청 보내기'}
      </button>
    </form>
  );
}

function RequestsTab() {
  const me = useAuthStore((s) => s.user)!;
  const push = useToastStore((s) => s.push);
  useBackendBus();
  const reqs = backend.listIncomingRequests(me.id);
  if (reqs.length === 0) {
    return (
      <EmptyState
        title="받은 요청이 없어요"
        description="누군가 내 코드를 입력해 요청을 보내면 여기에 표시돼요"
      />
    );
  }
  const onDecide = async (id: string, decision: 'accepted' | 'rejected' | 'blocked') => {
    try {
      await backend.respondFriendRequest(id, me.id, decision);
      push(
        decision === 'accepted' ? '친구가 됐어요!' : decision === 'rejected' ? '요청을 거절했어요' : '차단했어요',
        decision === 'accepted' ? 'success' : 'info'
      );
    } catch (e) {
      push((e as Error).message, 'error');
    }
  };
  return (
    <ul className="space-y-2">
      {reqs.map((r) => {
        const from = backend.getProfile(r.fromUserId);
        if (!from) return null;
        return (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-2xl bg-bg-surface p-3 ring-1 ring-white/5"
          >
            <Avatar name={from.nickname} url={from.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{from.nickname}</div>
              <div className="font-mono text-xs tracking-wider text-ink-mute">
                {from.friendCode}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => onDecide(r.id, 'rejected')} className="btn-ghost px-3 py-1.5 text-xs">
                거절
              </button>
              <button onClick={() => onDecide(r.id, 'blocked')} className="btn-danger px-3 py-1.5 text-xs">
                차단
              </button>
              <button onClick={() => onDecide(r.id, 'accepted')} className="btn-primary px-3 py-1.5 text-xs">
                수락
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function GroupTab({ onCreated }: { onCreated: (roomId: string) => void }) {
  const me = useAuthStore((s) => s.user)!;
  const push = useToastStore((s) => s.push);
  const tick = useBackendBus();
  const friends = useMemo(() => {
    return backend
      .listFriendships(me.id)
      .map((f) => {
        const otherId = f.userIds.find((id) => id !== me.id)!;
        return backend.getProfile(otherId);
      })
      .filter((u): u is NonNullable<typeof u> => !!u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, tick]);

  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pickedIds = Object.keys(picked).filter((id) => picked[id]);

  const onCreate = async () => {
    try {
      const r = await backend.createGroup(me.id, name || '새 그룹', pickedIds);
      onCreated(r.id);
    } catch (e) {
      push((e as Error).message, 'error');
    }
  };

  if (friends.length === 0) {
    return (
      <EmptyState
        title="그룹을 만들려면 먼저 친구를 추가해야 해요"
        description="친구 2명 이상을 묶어 최대 8명까지 그룹을 만들 수 있어요"
      />
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs text-ink-mute">그룹 이름</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="예: 점심메이트"
          className="input"
        />
      </label>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-ink-mute">
          <span>친구 선택 ({pickedIds.length + 1}/8)</span>
          <span className="text-ink-dim">최소 2명</span>
        </div>
        <ul className="space-y-1">
          {friends.map((f) => {
            const isPicked = !!picked[f.id];
            const overLimit = !isPicked && pickedIds.length + 1 >= 8;
            return (
              <li key={f.id}>
                <button
                  disabled={overLimit}
                  onClick={() => setPicked((p) => ({ ...p, [f.id]: !p[f.id] }))}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                    isPicked ? 'bg-brand/10 ring-1 ring-brand/40' : 'hover:bg-bg-elevated'
                  } disabled:opacity-50`}
                >
                  <Avatar name={f.nickname} url={f.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{f.nickname}</div>
                    <div className="font-mono text-xs tracking-wider text-ink-mute">
                      {f.friendCode}
                    </div>
                  </div>
                  <div
                    className={`grid h-6 w-6 place-items-center rounded-full border ${
                      isPicked ? 'border-brand bg-brand text-white' : 'border-white/15 text-transparent'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5 9-11"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <button
        onClick={onCreate}
        disabled={pickedIds.length < 2}
        className="btn-primary w-full"
      >
        그룹 만들기
      </button>
    </div>
  );
}
