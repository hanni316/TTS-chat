import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/Toggle';
import { backend } from '@/services/backend';
import { useAuthStore } from '@/state/authStore';
import { useBackendBus } from '@/hooks/useBackendBus';
import { useToastStore } from '@/state/toastStore';
import { safeDecode } from '@/lib/safeDecode';

interface Props {
  kind: 'friend' | 'group';
}

export function DetailPage({ kind }: Props) {
  const me = useAuthStore((s) => s.user)!;
  const push = useToastStore((s) => s.push);
  const nav = useNavigate();
  useBackendBus();
  const params = useParams();

  if (kind === 'friend') {
    const otherId = safeDecode(params.otherId);
    const friend = backend.getProfile(otherId);
    const friendship = backend.getFriendship(me.id, otherId);
    if (!friend || !friendship) {
      return (
        <>
          <AppHeader title="친구 상세" back />
          <div className="p-6 text-sm text-ink-mute">친구 정보를 찾을 수 없어요.</div>
        </>
      );
    }
    const alias = friendship.nicknames[otherId];
    const muted = friendship.mutedBy[me.id];
    const blocked = friendship.blockedBy[me.id];
    return (
      <>
        <AppHeader title="친구 상세" back />
        <main className="flex-1 space-y-5 overflow-y-auto p-4">
          <section className="card flex flex-col items-center gap-2 p-6">
            <Avatar name={friend.nickname} url={friend.avatarUrl} size={72} />
            <div className="text-lg font-semibold">{alias ?? friend.nickname}</div>
            <div className="font-mono text-xs tracking-wider text-ink-mute">
              {friend.friendCode}
            </div>
          </section>

          <AliasEditor
            initial={alias ?? ''}
            onSave={async (v) => {
              await backend.setFriendAlias(me.id, otherId, v || undefined);
              push('별명을 저장했어요', 'success');
            }}
          />

          <SettingRow
            label="이 친구만 음소거"
            desc="이 친구 메시지는 TTS로 재생되지 않아요"
          >
            <Toggle
              checked={muted}
              onChange={async (v) => {
                await backend.setFriendMuted(me.id, otherId, v);
              }}
            />
          </SettingRow>

          <SettingRow label="차단" desc="차단하면 메시지가 더 이상 도착하지 않아요">
            <Toggle
              checked={blocked}
              onChange={async (v) => {
                await backend.setFriendBlocked(me.id, otherId, v);
                push(v ? '차단했어요' : '차단을 해제했어요', 'info');
              }}
            />
          </SettingRow>

          <button
            onClick={async () => {
              if (!confirm('정말 친구 관계를 삭제할까요? 친구 관계만 삭제돼요. 채팅 기록은 양쪽에 남습니다.')) return;
              await backend.deleteFriendship(me.id, otherId);
              push('친구를 삭제했어요', 'info');
              nav('/home', { replace: true });
            }}
            className="btn-danger w-full"
          >
            친구 삭제
          </button>
        </main>
      </>
    );
  }

  // group detail
  const roomId = safeDecode(params.roomId);
  const room = backend.getRoom(roomId);
  if (!room || room.type !== 'group') {
    return (
      <>
        <AppHeader title="그룹 상세" back />
        <div className="p-6 text-sm text-ink-mute">그룹을 찾을 수 없어요.</div>
      </>
    );
  }
  const members = room.memberIds.map((id) => backend.getProfile(id)).filter(Boolean) as NonNullable<
    ReturnType<typeof backend.getProfile>
  >[];
  return (
    <>
      <AppHeader title="그룹 상세" back />
      <main className="space-y-5 p-4">
        <section className="card flex flex-col items-center gap-2 p-6">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-bg-elevated text-2xl">
            👥
          </div>
          <div className="text-lg font-semibold">{room.name}</div>
          <div className="text-xs text-ink-mute">{members.length}명 · 최대 8명</div>
        </section>

        <section>
          <div className="mb-2 text-xs uppercase tracking-wider text-ink-mute">멤버</div>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl bg-bg-surface p-3">
                <Avatar name={m.nickname} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {m.nickname} {m.id === room.ownerId && <span className="chip ml-1">방장</span>}
                  </div>
                  <div className="text-xs text-ink-mute">{m.id === me.id ? '나' : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <button
          onClick={async () => {
            if (!confirm('이 그룹에서 나갈까요?')) return;
            await backend.leaveGroup(room.id, me.id);
            push('그룹에서 나갔어요', 'info');
            nav('/home', { replace: true });
          }}
          className="btn-danger w-full"
        >
          그룹 나가기
        </button>
      </main>
    </>
  );
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-bg-surface p-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {desc && <div className="mt-0.5 text-xs text-ink-mute">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AliasEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="rounded-2xl bg-bg-surface p-4">
      <label className="block text-xs font-medium text-ink-mute">별명</label>
      <div className="mt-2 flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value.slice(0, 16))}
          placeholder="예: 회사동기 가은"
          className="input"
        />
        <button
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(v);
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="btn-primary px-4"
        >
          저장
        </button>
      </div>
    </div>
  );
}
