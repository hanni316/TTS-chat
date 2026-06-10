import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';

// "/" route — email + password login.
export function LandingPage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) nav('/home', { replace: true });
  }, [user, nav]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // onAuthStateChanged in authStore will populate `user`; the effect above
      // navigates to /home on the next render.
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
      <section className="text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand to-accent shadow-soft">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 8h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-5l-4 3v-3H5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z"
              fill="white"
            />
            <circle cx="9" cy="13" r="1.2" fill="#7C5CFF" />
            <circle cx="12" cy="13" r="1.2" fill="#7C5CFF" />
            <circle cx="15" cy="13" r="1.2" fill="#7C5CFF" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">TTS-chat</h1>
        <p className="mt-1 text-sm text-ink-mute">
          메시지를 보내면 상대방의 <span className="text-brand">귀로 전달되는</span> 채팅
        </p>
      </section>

      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-mute">이메일</span>
          <input
            autoFocus
            type="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            placeholder="you@example.com"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-mute">비밀번호</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="input"
          />
        </label>
        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger ring-1 ring-danger/30">
            {error}
          </p>
        )}
        <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
          {submitting ? '로그인 중...' : '로그인'}
        </button>
        <div className="text-center text-xs text-ink-mute">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="text-brand hover:underline">
            회원가입
          </Link>
        </div>
      </form>

      <div className="mt-8 rounded-2xl bg-bg-surface p-4 text-[11px] text-ink-mute ring-1 ring-white/5">
        다른 기기에서 친구와 채팅하려면 각자 이메일 계정으로 가입해야 해요. 가입과 동시에
        <span className="text-brand"> 5자리 친구 코드</span>가 발급되고, 그 코드를 공유해서
        친구를 추가할 수 있습니다.
      </div>
    </main>
  );
}
