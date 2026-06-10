# 🎧 TTS-chat

> **메시지를 보내면 상대방의 귀로 전달되는, 듣는 채팅**
> Real-time chat where every incoming message is automatically read aloud by the device — built for people who want to keep chatting while their eyes and hands are busy.

🌐 **Live:** https://tts-chat-amber.vercel.app

![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![tech](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![tech](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![tech](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![tech](https://img.shields.io/badge/Firebase-10-FFCA28?logo=firebase&logoColor=black)
![tech](https://img.shields.io/badge/PWA-✓-5A0FC8?logo=pwa&logoColor=white)
![tech](https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white)

---

## 🤔 왜 만들었나

기존 메신저는 모두 **"읽는" 채팅**입니다. 운전·요리·운동·강의 청취 중에는 화면을 볼 수도, 손가락으로 답장할 수도 없어요. TTS-chat은 **"메시지가 귀로 전달되는"** 채팅을 만들어 그 공백을 메웁니다.

- 👀 **눈은 자유, 대화는 계속** — 화면 안 봐도 친구의 메시지를 음성으로 들음
- 🔇 **듣고 싶지 않을 때는 텍스트로** — 전역·친구별 음소거
- 🤝 **폐쇄형 친구 네트워크** — 5자리 친구 코드 공유로 연결

---

## ✨ 주요 기능

### 💬 채팅
- 이메일/비밀번호 가입·로그인 (Firebase Auth)
- **5자리 친구 코드** 발급·공유 (헷갈리는 `0/O/1/I/L` 제외)
- 1:1 + **그룹 채팅** (최대 8명)
- 실시간 동기화 (Firestore `onSnapshot`)
- 타이핑 인디케이터, 읽음 표시, 안 읽은 메시지 배지
- 본인 메시지 5분 이내 삭제
- 메시지 길이 500자 제한

### 🎙️ TTS (이 앱의 핵심)
- Web Speech API 기반, **신규 메시지 자동 재생**
- 그룹 채팅에서 **발신자별 음성 자동 매핑** (해시 기반 안정적 할당) + 색상 차별화
- 전역 / 친구별 음소거
- 음성 종류 / 재생 속도 (0.8x–1.5x) / 음량 조절
- **TTS 큐**: 순차 재생, 일시정지, 큐 비우기
- 메시지 다시듣기, 보내기 전 미리듣기
- 발신자 호명 옵션 (`"○○님, ..."`)

### 🛡️ TTS 전처리 규칙
| 원문 | 음성 |
|---|---|
| ❤️ | "하트" |
| https://example.com | "링크" |
| ㅋㅋㅋ | "웃음" |
| ㅠㅠ | "훌쩍" |
| 욕설 | "삐-" (텍스트는 원본 유지) |
| 220자 초과 | 문장 단위로 분할 재생 |

### 📱 PWA & 알림
- 홈 화면 추가 (모바일/데스크톱)
- **데스크톱 시스템 알림** (메시지 도착 시, 보고 있지 않은 방만)
- 오프라인 셸 (서비스 워커)
- iOS 안전영역 처리

### 🔒 보안
- Firestore 보안 규칙 (`firestore.rules`) — 멤버 외엔 방/메시지 접근 불가
- 강력한 HTTP 보안 헤더 (CSP / HSTS / X-Frame-Options / Permissions-Policy ...)
- 비밀번호는 Firebase Auth가 관리 (앱은 평문을 저장·전송하지 않음)

---

## 🚀 빠른 시작

### 1. 클론 + 의존성 설치

```bash
git clone https://github.com/hanni316/tts-chat.git
cd tts-chat
npm install
```

### 2. Firebase 프로젝트 생성

1. [Firebase 콘솔](https://console.firebase.google.com) → **프로젝트 추가**
2. **Authentication** → 시작하기 → **이메일/비밀번호** 활성화
3. **Firestore Database** → 데이터베이스 만들기 → 위치 `asia-northeast3` (서울)
4. 보안 규칙·인덱스 배포:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add               # 위에서 만든 프로젝트 선택
   firebase deploy --only firestore:rules,firestore:indexes
   ```
5. 프로젝트 설정 → **웹 앱 추가** → 보여주는 `firebaseConfig`를 다음 단계에 사용

### 3. 환경변수 설정

루트에 `.env.local` 생성:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> Firebase **웹 SDK config 값들은 공개돼도 되는 값**입니다 ([공식 설명](https://firebase.google.com/docs/projects/api-keys#api-keys-for-firebase-are-different)). 실제 보안은 Firestore 규칙에서 강제합니다.

### 4. 실행

```bash
npm run dev          # http://localhost:5173
npm run build        # 프로덕션 번들 + 서비스 워커
npm run preview      # 빌드 결과 미리보기
npm run test         # vitest 단위 테스트
```

### 5. 두 사람 채팅 시연

1. 시크릿 창 / 다른 브라우저 / 다른 기기에서 각각 다른 이메일로 가입
2. A의 친구 코드를 B가 입력 → 친구 요청 → A가 수락
3. 채팅방에서 메시지 주고받기 → 상대 기기에서 자동 TTS 재생

> 💡 한국어 TTS 음성이 안 나오면: Windows 설정 → 시간 및 언어 → 음성 → "음성 추가"에서 한국어 음성팩(Heami, SunHi) 설치. macOS는 시스템 설정 → 손쉬운 사용 → 음성 콘텐츠 → 한국어 다운로드.

---

## 🌐 배포 (Vercel)

```bash
npm i -g vercel
vercel login
vercel --prod
```

배포 후 Vercel 대시보드 → **Settings → Environment Variables** 에 `VITE_FIREBASE_*` 6개를 등록하고, Firebase 콘솔 → **Authentication → 설정 → 승인된 도메인**에 Vercel 도메인(`your-app.vercel.app`)을 추가하세요. 그러지 않으면 배포된 사이트에서 로그인이 차단됩니다.

`vercel.json`에 SPA fallback, PWA 캐싱, 강력한 보안 헤더가 사전 구성돼 있습니다.

---

## 🏗️ 아키텍처

### Backend 파사드 패턴

모든 화면은 `src/services/backend.ts`가 export하는 **단일 `backend` 객체**만 호출합니다. 실체는 `FirebaseBackend` (`src/services/firebaseBackend.ts`)이고, 교체 지점이 한 곳으로 격리되어 있어 다른 백엔드로의 마이그레이션이 용이합니다.

### Firestore 데이터 모델

| 컬렉션 | 키 | 용도 |
|---|---|---|
| `users/{uid}` | Firebase Auth UID | 프로필 (닉네임, 친구 코드, ...) |
| `friendCodeIndex/{code}` | 5자리 코드 | 역방향 친구 코드 조회 |
| `friendships/{sortedPair}` | 두 UID 정렬 | 친구 관계 + 별명/음소거/차단 |
| `friendRequests/{id}` | 랜덤 | pending/accepted/rejected/blocked |
| `rooms/{roomId}` | DM은 결정적 키, 그룹은 랜덤 | 방 메타 + `memberIds: array` |
| `rooms/{id}/messages/{msgId}` | 랜덤 | 메시지 본문 + `readBy: array` |
| `rooms/{id}/typing/{uid}` | UID | 타이핑 상태 (TTL ~4초) |

### 실시간 흐름

```
사용자 A 메시지 전송
       ↓
Firestore writeBatch (메시지 + 방의 lastMessageAt)
       ↓
       ├──> A의 onSnapshot 리스너 → 캐시 갱신 → UI 즉시 반영
       └──> B의 onSnapshot 리스너 → 캐시 갱신 → UI 즉시 반영 + TTS 자동 재생
```

### 폴더 구조

```
src/
├─ App.tsx               # 라우팅 + 알림 hook 부착
├─ main.tsx              # 진입점 (PWA SW 등록 + dev에서 stale SW 정리)
├─ types/                # 도메인 모델 + AppSettings
├─ lib/                  # friendCode, profanity, ttsTransforms, safeDecode, ...
├─ services/             # backend 파사드 + FirebaseBackend + Firebase 초기화
├─ tts/                  # Web Speech API 래퍼 (큐, 발신자 음성)
├─ state/                # zustand: auth / settings / toast
├─ hooks/                # backend 이벤트 구독, TTS 상태, 한국어 음성 목록, 데스크톱 알림
├─ components/           # Avatar, AppHeader, ChatInput, MessageBubble, ...
└─ routes/               # 7개 화면 (S1~S7)

tests/                   # vitest 단위 테스트
firestore.rules          # Firestore 보안 규칙
firestore.indexes.json   # 복합 인덱스 정의
vercel.json              # Vercel 라우팅 + 보안 헤더
```

---

## 🗺️ 화면

| # | 화면 | 라우트 |
|---|---|---|
| S1 | 랜딩 (로그인) | `/` |
| S2 | 회원가입 | `/signup` |
| S3 | 홈 (친구·그룹 목록, 내 친구 코드) | `/home` |
| S4 | 친구·그룹 추가 (코드 입력 / 받은 요청 / 그룹 만들기) | `/add` |
| S5 | 채팅방 | `/room/:roomId` |
| S6 | 친구/그룹 상세 | `/detail/friend/:otherId`, `/detail/group/:roomId` |
| S7 | 설정 | `/settings` |

---

## 🧪 검증된 항목

- `npm run build` 성공 (타입 체크 + Vite 빌드 + PWA 서비스 워커 생성)
- `npm run test`: 친구 코드 / 욕설 필터 / TTS 변환 단위 테스트 통과
- 모바일 사파리 PWA: viewport-fit, safe-area-inset 처리
- 외부 보안 스캔 (Security Headers): Grade A 적용 완료

---

## 🛣️ 로드맵 (v2 후보)

- 음성 메모 (마이크 녹음 → 전송 → 자동 재생)
- 음성으로 입력 (Web Speech Recognition)
- 이미지 첨부 (Firebase Storage)
- 메시지 답장 / 이모지 리액션 / 검색
- 친구 코드 QR / 카카오톡 공유
- 모바일 FCM 푸시 알림 (앱 닫혀있을 때도)
- 다국어 TTS / 클라우드 TTS (자연스러운 신경망 음성)
- 라이트 모드 / 글자 크기 조정

---

## 📜 라이선스

개인 학습·포트폴리오 프로젝트입니다. 코드는 자유롭게 참고하시되, 상업적 사용 전엔 문의해주세요.

---

## 🙋 만든 사람

[@hanni316](https://github.com/hanni316) · `hanni316@naver.com`

기획서는 [`기획서.md`](./기획서.md) 참고.
