import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { FriendCodeChip } from '@/components/FriendCodeChip';
import { Toggle } from '@/components/Toggle';
import { ttsEngine } from '@/tts/ttsEngine';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';
import { useKoreanVoices } from '@/hooks/useKoreanVoices';
import { useNotificationToggle } from '@/hooks/useNotificationToggle';
import type { AppSettings } from '@/types';

export function SettingsPage() {
  const me = useAuthStore((s) => s.user)!;
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.set);
  const push = useToastStore((s) => s.push);
  const signOut = useAuthStore((s) => s.signOut);
  const rotate = useAuthStore((s) => s.rotateCode);
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const voices = useKoreanVoices();
  const nav = useNavigate();
  const [nickname, setNickname] = useState(me.nickname);

  const onRotate = async () => {
    try {
      await rotate();
      push('새 친구 코드를 발급했어요. 기존 코드는 무효화돼요.', 'success');
    } catch (e) {
      push((e as Error).message, 'error');
    }
  };

  const onSaveNickname = async () => {
    const v = nickname.trim();
    if (v.length < 2 || v.length > 12) {
      push('닉네임은 2~12자여야 해요', 'error');
      return;
    }
    await updateNickname(v);
    push('닉네임을 저장했어요', 'success');
  };

  const testVoice = (voiceURI?: string) => {
    ttsEngine.speak(
      {
        text: '안녕하세요, 음성 테스트입니다. TTS-chat에 오신 것을 환영해요.',
        announceSender: false,
        voiceHint: voiceURI,
      },
      settings
    );
  };

  const rates: AppSettings['rate'][] = [0.8, 1.0, 1.2, 1.5];

  return (
    <>
      <AppHeader title="설정" back />
      <main className="flex-1 space-y-5 overflow-y-auto p-4">
        <section className="card flex items-center gap-3 p-4">
          <Avatar name={me.nickname} url={me.avatarUrl} size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-mute">내 친구 코드</div>
            <div className="mt-1">
              <FriendCodeChip code={me.friendCode} />
            </div>
          </div>
        </section>

        <Group title="프로필">
          <div className="rounded-2xl bg-bg-surface p-4">
            <label className="block text-xs text-ink-mute">닉네임</label>
            <div className="mt-2 flex gap-2">
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 12))}
              />
              <button onClick={onSaveNickname} className="btn-primary px-4">
                저장
              </button>
            </div>
            <p className="mt-1 text-[11px] text-ink-dim">2~12자</p>
          </div>
        </Group>

        <Group title="TTS">
          <Row label="전역 음소거" desc="모든 메시지를 텍스트로만 표시">
            <Toggle
              checked={settings.globalMuted}
              onChange={(v) => setSetting('globalMuted', v)}
            />
          </Row>
          <Row label="자동 재생" desc="새 메시지가 도착하면 즉시 재생">
            <Toggle checked={settings.autoplay} onChange={(v) => setSetting('autoplay', v)} />
          </Row>
          <Row label="발신자 호명 (그룹)" desc="그룹 메시지 앞에 '○○님,' 을 붙여 읽어줘요">
            <Toggle
              checked={settings.announceSender}
              onChange={(v) => setSetting('announceSender', v)}
            />
          </Row>
          <Row label="이모지 음독" desc="이모지를 한국어로 읽어줘요 (예: ❤️ → '하트')">
            <Toggle
              checked={settings.emojiToSpeech}
              onChange={(v) => setSetting('emojiToSpeech', v)}
            />
          </Row>
          <Row label="욕설 마스킹" desc="TTS에서 욕설은 '삐-' 처리, 텍스트는 그대로 표시">
            <Toggle
              checked={settings.profanityMask}
              onChange={(v) => setSetting('profanityMask', v)}
            />
          </Row>
        </Group>

        <Group title="알림">
          <DesktopNotificationRow />
        </Group>

        <Group title="음성">
          <div className="rounded-2xl bg-bg-surface p-4">
            <label className="block text-xs text-ink-mute">기본 음성</label>
            <select
              className="input mt-2"
              value={settings.voiceURI ?? ''}
              onChange={(e) => setSetting('voiceURI', e.target.value || undefined)}
            >
              <option value="">시스템 기본 / 발신자별 자동</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => testVoice(settings.voiceURI)}
                className="chip hover:text-brand"
              >
                ▶︎ 음성 테스트
              </button>
              {voices.length === 0 && (
                <span className="text-[11px] text-ink-dim">
                  사용 가능한 한국어 음성이 없어요. Windows 설정 → 음성에서 한국어 음성을 설치해주세요.
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-bg-surface p-4">
            <label className="block text-xs text-ink-mute">재생 속도</label>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {rates.map((r) => (
                <button
                  key={r}
                  onClick={() => setSetting('rate', r)}
                  className={`rounded-xl py-2 text-sm transition ${
                    settings.rate === r
                      ? 'bg-brand text-white'
                      : 'bg-bg-elevated text-ink hover:brightness-110'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-ink-mute">음량</label>
              <span className="text-xs text-ink-mute">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => setSetting('volume', Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>
        </Group>

        <Group title="계정">
          <button onClick={onRotate} className="btn-ghost w-full">
            친구 코드 재발급 (24시간 1회)
          </button>
          <button
            onClick={async () => {
              await signOut();
              nav('/', { replace: true });
            }}
            className="btn-danger w-full"
          >
            로그아웃
          </button>
        </Group>
      </main>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
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

function DesktopNotificationRow() {
  const notif = useNotificationToggle();
  const desc = !notif.supported
    ? '이 브라우저는 알림을 지원하지 않아요'
    : notif.permission === 'denied'
    ? '브라우저에서 알림이 차단되어 있어요. 주소창 자물쇠 → 알림 → 허용으로 변경'
    : '새 메시지가 도착하면 시스템 알림으로 표시 (현재 보고 있는 방은 제외)';
  return (
    <Row label="데스크톱 알림" desc={desc}>
      <Toggle checked={notif.enabled} onChange={notif.toggle} label="데스크톱 알림" />
    </Row>
  );
}
