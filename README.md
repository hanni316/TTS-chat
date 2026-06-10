# TTS-chat (MVP)

기획서(`기획서.md`)의 모든 MVP 요구사항(M1~M10)을 구현한 React + Vite + TS + Tailwind + PWA 데모입니다.
백엔드는 **Firebase Auth(이메일/비밀번호) + Firestore 실시간(onSnapshot) 백엔드**가 유일하며,
`backend` 파사드(`src/services/backend.ts`) 한 곳에서만 호출되도록 격리되어 있습니다.
실행하려면 `.env.local`에 **`VITE_FIREBASE_*`** 값이 채워져 있어야 하며, 미설정 시 `backend`
메서드 호출 시점에 명확한 메시지와 함께 throw 됩니다(콘솔에 경고도 함께 출력).

## 빠른 시작

```bash
npm install        # 이미 완료된 상태로 제공됩니다
npm run dev        # http://localhost:5173
npm run build      # 프로덕션 번들 + 서비스 워커 생성
npm run preview    # 빌드 결과 미리보기
npm run test       # 단위 테스트 (vitest)
```

### Firebase 환경변수 (`.env.local`)

프로젝트 루트에 `.env.local`을 만들고 Firebase 콘솔의 웹 앱 설정값을 채워주세요. 값이 비어 있으면
`backend` 호출 시 throw 되므로 채팅이 동작하지 않습니다.

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase 콘솔에서 **Authentication → 이메일/비밀번호 로그인**을 활성화하고, **Firestore**를 생성한 뒤
보안 규칙을 배포해야 합니다(아래 "Firestore 보안 규칙 배포" 참고).

## 데모를 둘러보는 법

1. 랜딩 화면(`/`)에서 **이메일 + 비밀번호로 로그인**하거나, "회원가입"으로 이동해 이메일·비밀번호·닉네임
   (2~12자)을 입력해 가입합니다. 가입과 동시에 본인의 5자리 친구 코드가 발급됩니다.
2. **두 명이 채팅하는 모습을 보고 싶다면 서로 다른 두 이메일 계정으로** 각각 다른 탭/창(또는 다른 기기)에서
   가입하세요.
3. 한쪽에서 본인의 5자리 코드를 확인·복사한 뒤, 다른 쪽의 "친구 추가"에서 그 코드를 입력해 요청을 보내고
   상대가 수락하면 1:1 채팅방이 자동 생성됩니다(**친구코드 교환 → 채팅**).
4. 한쪽에서 보낸 메시지는 Firestore `onSnapshot`을 통해 다른 쪽 채팅방에 실시간으로 도착하고
   **TTS로 자동 재생**됩니다.

## 구현된 MVP 기능 (기획서 §우선순위)

| ID | 기능 | 위치 |
|----|------|------|
| M1 | 이메일/비밀번호 로그인 + 닉네임 가입 (2~12자) | `routes/LandingPage.tsx`, `routes/NicknamePage.tsx`, `state/authStore.ts` |
| M2 | 5자리 친구 코드 (0/O/1/I/L 제외) · 복사 · 24시간 1회 재발급 | `lib/friendCode.ts`, `components/FriendCodeChip.tsx`, `services/backend.ts` |
| M3 | 친구 요청 · 수락 / 거절 / 차단 / 삭제 | `routes/AddPage.tsx`, `routes/DetailPage.tsx` |
| M4 | 1:1 + 그룹(최대 8명) 실시간 텍스트 채팅, 타이핑 인디케이터, 읽음 표시 | `routes/ChatRoomPage.tsx` |
| M5 | Web Speech API TTS 자동 재생 (포그라운드, 신규 메시지만) | `tts/ttsEngine.ts`, `routes/ChatRoomPage.tsx` |
| M6 | 전역 + 친구별 음소거 | `state/settingsStore.ts`, `routes/ChatRoomPage.tsx`, `routes/DetailPage.tsx` |
| M7 | TTS 음성 / 속도 (0.8·1.0·1.2·1.5) / 음량 설정 | `routes/SettingsPage.tsx` |
| M8 | 메시지 다시듣기(말풍선 탭) + 보내기 전 미리듣기 | `components/MessageBubble.tsx`, `components/ChatInput.tsx` |
| M9 | 욕설 마스킹(TTS는 "삐-", 텍스트는 원본) | `lib/profanity.ts`, `lib/ttsTransforms.ts` |
| M10 | TTS 큐 (순차 재생, 큐 비우기, 일시정지/재생) | `tts/ttsEngine.ts`, `components/TTSStatusBar.tsx` |

추가 처리:
- 이모지 → 한국어 음독 (예: ❤️ → "하트")
- URL → "링크" 축약
- ㅋㅋㅋ → "웃음", ㅠㅠ → "훌쩍", ㄷㄷ → "깜짝"
- 그룹 채팅에서 발신자별 음성 자동 할당(해시 매핑) + 발신자 색상 차별화
- "○○님," 호명 옵션 (기획서 리스크 §그룹 채팅 TTS 혼란 대응)
- 500자 메시지 길이 제한
- 본인 메시지 5분 이내 삭제
- 메시지가 220자를 넘으면 문장 단위로 분할 재생 (Web Speech API 안정성)

## 화면 매핑 (기획서 §화면 구성)

| # | 화면 | 라우트 |
|---|------|--------|
| S1 | 랜딩 (이메일/비밀번호 로그인) | `/` |
| S2 | 회원가입 (이메일·비밀번호·닉네임) | `/signup` |
| S3 | 홈 (친구/그룹 목록 + 내 코드) | `/home` |
| S4 | 친구 추가 · 받은 요청 · 그룹 만들기 | `/add` |
| S5 | 채팅방 | `/room/:roomId` |
| S6 | 친구/그룹 상세 | `/detail/friend/:otherId`, `/detail/group/:roomId` |
| S7 | 전역 설정 | `/settings` |

## 한국어 TTS 음성이 안 나올 때

- **Windows**: 설정 → 시간 및 언어 → 음성 → "음성 추가" → 한국어를 설치하면 Chrome / Edge 모두에서
  `Microsoft Heami / Microsoft SunHi` 음성을 사용할 수 있습니다.
- **macOS**: 시스템 설정 → 손쉬운 사용 → 음성 콘텐츠 → 시스템 음성 → 한국어(예: 유나, 진수) 다운로드.
- 음성이 없어도 영문 메시지는 시스템 기본 음성으로 재생됩니다.

## 백엔드 구조 (backend 파사드)

이 프로젝트의 백엔드는 **Firebase 단일 구현**입니다. 모든 화면은 `src/services/backend.ts`가 export
하는 `backend` 객체만 호출하고, 그 실체는 `FirebaseBackend`(`src/services/firebaseBackend.ts`)입니다.
이렇게 **교체 지점을 한 곳(파사드)에 격리**해 두었기 때문에, 향후 다른 백엔드로 바꾸더라도
`backend.ts`에서 export 하는 인스턴스 하나만 교체하면 화면 코드는 그대로 동작합니다.

`FirebaseBackend`가 노출하는 메서드:

- 인증: `signIn`, `signUp`, `signOut`, `onAuthStateChanged`(`state/authStore.ts`에서 구독)
- 실시간 구독: `onSnapshot` 기반 리스너 (방/메시지/친구요청/타이핑 변경을 실시간 반영)
- 프로필: `updateProfile`, `rotateFriendCode`, `findByFriendCode`
- 친구: `sendFriendRequest`, `respondFriendRequest`, `listIncomingRequests`, `setFriendAlias/Muted/Blocked`, `deleteFriendship`
- 방: `listRooms`, `getRoom`, `createGroup`, `leaveGroup`
- 메시지: `listMessages`, `sendMessage`, `deleteMessage`, `markRead`
- 타이핑: `setTyping`, `getTyping`

Firestore 데이터 구성:
| 도메인 | Firestore 구성 |
|--------|----------------|
| 사용자 | `users/{uid}` (+ `friendCode` 조회용 매핑) |
| 친구관계 | `friendships/{sortedPair}` |
| 친구요청 | `friendRequests/{id}` |
| 방 | `rooms/{roomId}` (memberIds: array) |
| 메시지 | `rooms/{roomId}/messages/{id}` (createdAt 인덱스, `firestore.indexes.json`) |
| 타이핑 | `rooms/{roomId}/typing/{uid}` |
| 실시간 동기화 | Firestore `onSnapshot` 리스너 |

## Firestore 보안 규칙 배포

보안 규칙은 루트의 `firestore.rules`에 정의되어 있습니다. Firebase CLI로 배포하세요.

```bash
firebase deploy --only firestore:rules
```

인덱스까지 함께 배포하려면 `firebase deploy --only firestore:rules,firestore:indexes`를 사용합니다.

## 폴더 구조

```
src/
├─ App.tsx
├─ main.tsx
├─ types/                # 도메인 모델 + AppSettings (index.ts)
├─ lib/                  # friendCode, profanity, ttsTransforms, safeDecode, id, storage
├─ services/            # backend(파사드) + firebaseBackend + firebaseInit
├─ tts/ttsEngine.ts      # Web Speech API 래퍼 (큐, 발신자 음성)
├─ state/                # zustand: authStore, settingsStore, toastStore
├─ hooks/                # backend 버스 구독, TTS 상태, 한국어 음성 목록, 데스크톱 알림
├─ components/           # Avatar, AppHeader, ChatInput, MessageBubble, TTSStatusBar, ...
└─ routes/               # 7개 화면 (S1~S7)
```

루트에는 `firestore.rules`, `firestore.indexes.json`, `firebase.json`, 단위 테스트(`tests/`)가 있습니다.

## 검증된 항목

- `npm run build` 성공 (타입 체크 + Vite 빌드 + PWA 서비스워커 생성)
- `npm run test` (vitest) — 친구 코드(`tests/friendCode.test.ts`), 욕설 필터(`tests/profanity.test.ts`),
  TTS 변환(`tests/ttsTransforms.test.ts`) 단위 테스트 통과
- iOS / 모바일 사파리 PWA: viewport-fit, safe-area-inset 처리

## 알려진 한계 (v2 후보)

- 인증은 현재 **이메일/비밀번호** 1종 (Google 등 소셜 OAuth 로그인 전환은 v2 범위)
- 서버 TTS / 다국어 / 이미지 첨부 / 푸시 알림 / QR 친구 추가는 v2 범위
- 욕설 사전이 최소 셋. 운영 시 `korean-badwords` 등 더 포괄적인 사전 또는 서버 필터 권장
- 메시지 30일 자동 보관 정리는 Firebase Cloud Functions 도입 시 구현
