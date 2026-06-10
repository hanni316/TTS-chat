import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';
import { useToastStore } from '@/state/toastStore';
import { AppHeader } from '@/components/AppHeader';

// "/signup" route — email + password + nickname.
export function NicknamePage() {
  const nav = useNavigate();
  const signUp = useAuthStore((s) => s.signUp);
  const push = useToastStore((s) => s.push);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwValid = password.length >= 6;
  const pwMatch = password === passwordConfirm && password.length > 0;
  const nickValid = nickname.trim().length >= 2 && nickname.trim().length <= 12;
  const canSubmit = emailValid && pwValid && pwMatch && nickValid && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const u = await signUp({ email, password, nickname });
      push(`${u.nickname}님 환영해요! 친구 코드는 ${u.friendCode} 예요.`, 'success');
      nav('/home', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="회원가입" back />
      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        <section>
          <h2 className="text-xl font-bold">계정을 만들어볼게요</h2>
          <p className="mt-1 text-sm text-ink-mute">
            이메일·비밀번호·닉네임만 있으면 가입할 수 있어요.
          </p>
        </section>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            label="이메일"
            help={
              email.length > 0 && !emailValid
                ? '올바른 이메일 형식이 아닙니다'
                : '로그인에 사용할 이메일'
            }
            valid={email.length === 0 || emailValid}
          >
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
          </Field>

          <Field label="비밀번호" help="6자 이상" valid={password.length === 0 || pwValid}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="input"
            />
          </Field>

          <Field
            label="비밀번호 확인"
            help={
              passwordConfirm.length > 0 && !pwMatch
                ? '비밀번호가 일치하지 않아요'
                : '한 번 더 입력해주세요'
            }
            valid={passwordConfirm.length === 0 || pwMatch}
          >
            <input
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 확인"
              className="input"
            />
          </Field>

          <Field
            label="닉네임"
            help={
              nickname.length > 0 && !nickValid ? '2~12자 사이로 입력해주세요' : '2~12자'
            }
            valid={nickname.length === 0 || nickValid}
          >
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 12))}
              placeholder="예: 듣고싶은가은"
              className="input"
            />
          </Field>

          {error && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger ring-1 ring-danger/30">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {submitting ? '가입 중...' : '가입하고 시작하기'}
          </button>

          <div className="text-center text-xs text-ink-mute">
            이미 계정이 있나요?{' '}
            <Link to="/" className="text-brand hover:underline">
              로그인
            </Link>
          </div>
        </form>

        <div className="rounded-2xl bg-bg-surface p-4 text-[11px] text-ink-mute ring-1 ring-white/5">
          가입과 동시에 5자리 친구 코드가 자동으로 발급돼요. 친구에게 코드만 알려주면 다른
          기기에서도 친구 추가 후 채팅할 수 있어요.
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  help,
  valid,
  children,
}: {
  label: string;
  help?: string;
  valid: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-mute">{label}</span>
      {children}
      {help && (
        <p className={`mt-1 text-[11px] ${valid ? 'text-ink-dim' : 'text-danger'}`}>{help}</p>
      )}
    </label>
  );
}
