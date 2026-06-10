// FirebaseBackend
// ---------------
// Drop-in replacement for MockBackend that uses Firebase Auth + Firestore.
//
// Design:
// - Maintains an in-memory cache (`db`) populated by Firestore onSnapshot
//   listeners. This keeps the existing synchronous API surface
//   (`listRooms`, `listMessages`, ...) unchanged so the React components do
//   not need to be rewritten with promises or React Query.
// - Subscribers (`subscribe`) are notified of cache updates via `ServerEvent`
//   objects, matching MockBackend's contract. Components use `useBackendBus`
//   to re-render when data changes.
// - Auth lifecycle: onAuthStateChanged drives signup/signin/signout. On sign-in
//   we start a set of user-scoped listeners; on sign-out we tear them down and
//   clear the cache.

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';

import { firebaseAuth, firestore } from './firebaseInit';
import { dmRoomKey, friendshipKey, uid as makeId } from '@/lib/id';
import { generateFriendCode } from '@/lib/friendCode';
import type {
  ChatRoom,
  FriendRequest,
  Friendship,
  ID,
  Message,
  ServerEvent,
  TypingState,
  UserProfile,
} from '@/types';

export interface SignUpInput {
  email: string;
  password: string;
  nickname: string;
}

type EventHandler = (e: ServerEvent) => void;

interface Cache {
  users: Record<ID, UserProfile>;
  friendships: Record<string, Friendship>;
  friendRequests: Record<ID, FriendRequest>;
  rooms: Record<ID, ChatRoom>;
  messages: Record<ID, Message[]>;
  typing: Record<ID, TypingState>;
}

function emptyCache(): Cache {
  return {
    users: {},
    friendships: {},
    friendRequests: {},
    rooms: {},
    messages: {},
    typing: {},
  };
}

function isoOrNow(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export class FirebaseBackend {
  private db: Cache = emptyCache();
  private listeners = new Set<EventHandler>();

  private currentUid: ID | null = null;
  private userScopedUnsubs: Unsubscribe[] = [];
  private roomMessageUnsubs = new Map<ID, Unsubscribe>();
  private roomTypingUnsubs = new Map<ID, Unsubscribe>();
  private subscribedUsers = new Set<ID>();
  private userUnsubs = new Map<ID, Unsubscribe>();

  private authReadyResolve: ((uid: ID | null) => void) | null = null;
  /** Resolves to the current uid (or null) once Firebase Auth has restored its session. */
  public readonly authReady: Promise<ID | null>;

  constructor() {
    this.authReady = new Promise((resolve) => {
      this.authReadyResolve = resolve;
    });
    if (firebaseAuth) {
      onAuthStateChanged(firebaseAuth, (u) => {
        const uid = u?.uid ?? null;
        if (uid !== this.currentUid) {
          if (this.currentUid) this.teardownUserScope();
          this.currentUid = uid;
          if (uid) this.setupUserScope(uid);
        }
        if (this.authReadyResolve) {
          this.authReadyResolve(uid);
          this.authReadyResolve = null;
        }
      });
    } else if (this.authReadyResolve) {
      this.authReadyResolve(null);
      this.authReadyResolve = null;
    }
  }

  // ===== subscribe =====
  subscribe(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }
  private emit(event: ServerEvent) {
    for (const fn of this.listeners) fn(event);
  }

  // ===== session =====
  /** Returns the current Firebase Auth uid (or null). */
  getSessionUserId(): ID | null {
    return this.currentUid;
  }
  setSessionUserId(_id: ID | null) {
    // No-op for Firebase: Firebase Auth persists across reloads via IndexedDB.
    // Sign-out happens through `signOut()`.
  }

  // ===== auth =====
  async signUp(input: SignUpInput): Promise<UserProfile> {
    if (!firebaseAuth || !firestore) throw new Error('Firebase가 설정되지 않았습니다.');
    const email = input.email.trim().toLowerCase();
    const nickname = input.nickname.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }
    if (input.password.length < 6) {
      throw new Error('비밀번호는 6자 이상이어야 합니다.'); // Firebase Auth minimum
    }
    if (nickname.length < 2 || nickname.length > 12) {
      throw new Error('닉네임은 2~12자여야 합니다.');
    }

    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, input.password);
      const uid = cred.user.uid;

      // Allocate a unique friend code atomically. runTransaction makes the
      // "check friendCodeIndex absent + set" pair atomic, so two concurrent
      // signups can't claim the same code (the check-then-act race). On a rare
      // collision we regenerate inside the transaction's retry.
      // NOTE: For defense in depth, the friendCodeIndex security rule should
      // also be create-only so a code can never be silently overwritten.
      const db = firestore;
      let code = generateFriendCode();
      await runTransaction(db, async (tx) => {
        for (let i = 0; i < 5; i++) {
          const exists = await tx.get(doc(db, 'friendCodeIndex', code));
          if (!exists.exists()) break;
          code = generateFriendCode();
        }
        tx.set(doc(db, 'friendCodeIndex', code), { uid });
      });

      const profile: UserProfile = {
        id: uid,
        email,
        nickname,
        friendCode: code,
        friendCodeRotatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(firestore, 'users', uid), {
        ...profile,
        createdAt: serverTimestamp(),
        friendCodeRotatedAt: serverTimestamp(),
      });

      // Cache immediately so the UI sees the user before the snapshot arrives.
      this.db.users[uid] = profile;
      this.emit({ type: 'profile:updated', payload: profile, at: Date.now() });
      return profile;
    } catch (err: unknown) {
      throw new Error(humanizeFirebaseError(err));
    }
  }
  async signIn(email: string, password: string): Promise<UserProfile> {
    if (!firebaseAuth) throw new Error('Firebase가 설정되지 않았습니다.');
    try {
      const cred = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim().toLowerCase(),
        password
      );
      // Profile will be fetched by the auth listener; also fetch eagerly here
      // so the caller can return it.
      const snap = await getDoc(doc(firestore!, 'users', cred.user.uid));
      if (!snap.exists()) throw new Error('사용자 프로필을 찾을 수 없습니다.');
      const p = snap.data() as UserProfile;
      return normalizeUser(p, cred.user.uid);
    } catch (err) {
      throw new Error(humanizeFirebaseError(err));
    }
  }
  async signOut(): Promise<void> {
    if (!firebaseAuth) return;
    await fbSignOut(firebaseAuth);
  }

  // ===== profile =====
  listUsers(): UserProfile[] {
    return Object.values(this.db.users);
  }
  getProfile(id: ID): UserProfile | null {
    const cached = this.db.users[id] ?? null;
    if (!cached) void this.ensureUserSubscribed(id);
    return cached;
  }
  async findByFriendCode(code: string): Promise<UserProfile | null> {
    if (!firestore) return null;
    const idx = await getDoc(doc(firestore, 'friendCodeIndex', code));
    if (!idx.exists()) return null;
    const uid = idx.data().uid as string;
    const userSnap = await getDoc(doc(firestore, 'users', uid));
    if (!userSnap.exists()) return null;
    const u = normalizeUser(userSnap.data(), uid);
    this.db.users[uid] = u;
    return u;
  }
  async updateProfile(
    id: ID,
    patch: Partial<Pick<UserProfile, 'nickname' | 'avatarUrl'>>
  ): Promise<UserProfile> {
    if (!firestore) throw new Error('firestore not initialized');
    if (id !== this.currentUid) throw new Error('본인 프로필만 수정할 수 있습니다.');
    await updateDoc(doc(firestore, 'users', id), patch);
    const u = { ...(this.db.users[id] ?? ({} as UserProfile)), ...patch };
    this.db.users[id] = u;
    this.emit({ type: 'profile:updated', payload: u, at: Date.now() });
    return u;
  }
  async rotateFriendCode(id: ID): Promise<UserProfile> {
    if (!firestore) throw new Error('firestore not initialized');
    if (id !== this.currentUid) throw new Error('본인 프로필만 수정할 수 있습니다.');
    const u = this.db.users[id];
    if (!u) throw new Error('user not found');
    const last = new Date(u.friendCodeRotatedAt).getTime();
    const hours = (Date.now() - last) / 36e5;
    if (hours < 24) {
      throw new Error(`재발급은 24시간에 1회만 가능합니다. (${Math.ceil(24 - hours)}시간 후)`);
    }

    // Rotate the friend code atomically: claim the new index entry, drop the
    // old one, and update the user doc in a single transaction so a concurrent
    // signup/rotation can't grab the same code between our check and set.
    // NOTE: For defense in depth, the friendCodeIndex security rule should also
    // be create-only so a code can never be silently overwritten.
    const db = firestore;
    let code = generateFriendCode();
    await runTransaction(db, async (tx) => {
      for (let i = 0; i < 5; i++) {
        const exists = await tx.get(doc(db, 'friendCodeIndex', code));
        if (!exists.exists()) break;
        code = generateFriendCode();
      }
      tx.delete(doc(db, 'friendCodeIndex', u.friendCode));
      tx.set(doc(db, 'friendCodeIndex', code), { uid: id });
      tx.update(doc(db, 'users', id), {
        friendCode: code,
        friendCodeRotatedAt: serverTimestamp(),
      });
    });

    const next: UserProfile = {
      ...u,
      friendCode: code,
      friendCodeRotatedAt: new Date().toISOString(),
    };
    this.db.users[id] = next;
    this.emit({ type: 'profile:updated', payload: next, at: Date.now() });
    return next;
  }

  // ===== friend requests =====
  listIncomingRequests(userId: ID): FriendRequest[] {
    return Object.values(this.db.friendRequests).filter(
      (r) => r.toUserId === userId && r.status === 'pending'
    );
  }
  listOutgoingRequests(userId: ID): FriendRequest[] {
    return Object.values(this.db.friendRequests).filter(
      (r) => r.fromUserId === userId && r.status === 'pending'
    );
  }
  async sendFriendRequest(fromUserId: ID, toCode: string): Promise<FriendRequest> {
    if (!firestore) throw new Error('firestore not initialized');
    if (fromUserId !== this.currentUid) throw new Error('권한이 없습니다.');
    const to = await this.findByFriendCode(toCode);
    if (!to) throw new Error('해당 코드의 사용자를 찾을 수 없습니다.');
    if (to.id === fromUserId) throw new Error('본인에게는 요청을 보낼 수 없습니다.');
    const fkey = friendshipKey(fromUserId, to.id);
    const existingFs = await getDoc(doc(firestore, 'friendships', fkey));
    if (existingFs.exists()) throw new Error('이미 친구입니다.');

    // Already a pending request between us?
    const existing = Object.values(this.db.friendRequests).find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUserId === fromUserId && r.toUserId === to.id) ||
          (r.fromUserId === to.id && r.toUserId === fromUserId))
    );
    if (existing) {
      if (existing.fromUserId === to.id) {
        return this.respondFriendRequest(existing.id, fromUserId, 'accepted');
      }
      throw new Error('이미 요청을 보냈습니다.');
    }

    const id = makeId('fr_');
    const req: FriendRequest = {
      id,
      fromUserId,
      toUserId: to.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(firestore, 'friendRequests', id), {
      ...req,
      createdAt: serverTimestamp(),
    });
    this.emit({ type: 'friend:requested', payload: req, at: Date.now() });
    return req;
  }
  async respondFriendRequest(
    reqId: ID,
    responderId: ID,
    decision: 'accepted' | 'rejected' | 'blocked'
  ): Promise<FriendRequest> {
    if (!firestore) throw new Error('firestore not initialized');
    if (responderId !== this.currentUid) throw new Error('권한이 없습니다.');
    const reqRef = doc(firestore, 'friendRequests', reqId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('요청을 찾을 수 없습니다.');
    const req = reqSnap.data() as FriendRequest;
    if (req.toUserId !== responderId) throw new Error('권한이 없습니다.');

    // Bundle the request status update with friendship + room creation into a
    // single writeBatch so we never end up with an "accepted" request that has
    // no friendship (or vice versa). friendshipKey/dmRoomKey are deterministic,
    // so re-running this is idempotent (set overwrites the same docs).
    const batch = writeBatch(firestore);
    batch.update(reqRef, {
      status: decision,
      respondedAt: serverTimestamp(),
    });

    if (decision === 'accepted') {
      const fkey = friendshipKey(req.fromUserId, req.toUserId);
      const existing = await getDoc(doc(firestore, 'friendships', fkey));
      if (!existing.exists()) {
        const a = req.fromUserId;
        const b = req.toUserId;
        const sorted = [a, b].sort() as [ID, ID];
        const roomId = dmRoomKey(a, b);
        const friendship: Friendship = {
          id: fkey,
          userIds: sorted,
          createdAt: new Date().toISOString(),
          // Firestore disallows `undefined`. Use an empty map and let
          // `nicknames[uid]` return undefined naturally for unset entries.
          nicknames: {},
          mutedBy: { [a]: false, [b]: false },
          blockedBy: { [a]: false, [b]: false },
          chatRoomId: roomId,
        };
        batch.set(doc(firestore, 'friendships', fkey), {
          ...friendship,
          createdAt: serverTimestamp(),
        });
        batch.set(doc(firestore, 'rooms', roomId), {
          id: roomId,
          type: 'dm',
          memberIds: sorted,
          createdAt: serverTimestamp(),
        });
      }
      // If the friendship already exists we only update the request status.
    }

    await batch.commit();

    const next: FriendRequest = {
      ...req,
      status: decision,
      respondedAt: new Date().toISOString(),
    };
    this.emit({ type: 'friend:updated', payload: next, at: Date.now() });
    return next;
  }

  // ===== friendships =====
  listFriendships(userId: ID): Friendship[] {
    return Object.values(this.db.friendships).filter((f) => f.userIds.includes(userId));
  }
  getFriendship(a: ID, b: ID): Friendship | null {
    return this.db.friendships[friendshipKey(a, b)] ?? null;
  }
  async setFriendAlias(meId: ID, otherId: ID, alias: string | undefined) {
    if (!firestore) throw new Error('firestore not initialized');
    const f = this.getFriendship(meId, otherId);
    if (!f) throw new Error('친구 관계가 없습니다.');
    const nicknames = { ...f.nicknames, [otherId]: alias && alias.trim() ? alias.trim() : null };
    await updateDoc(doc(firestore, 'friendships', f.id), { nicknames });
    return { ...f, nicknames: { ...f.nicknames, [otherId]: alias?.trim() || undefined } };
  }
  async setFriendMuted(meId: ID, otherId: ID, muted: boolean) {
    if (!firestore) throw new Error('firestore not initialized');
    const f = this.getFriendship(meId, otherId);
    if (!f) throw new Error('친구 관계가 없습니다.');
    const mutedBy = { ...f.mutedBy, [meId]: muted };
    await updateDoc(doc(firestore, 'friendships', f.id), { mutedBy });
    return { ...f, mutedBy };
  }
  async setFriendBlocked(meId: ID, otherId: ID, blocked: boolean) {
    if (!firestore) throw new Error('firestore not initialized');
    const f = this.getFriendship(meId, otherId);
    if (!f) throw new Error('친구 관계가 없습니다.');
    const blockedBy = { ...f.blockedBy, [meId]: blocked };
    await updateDoc(doc(firestore, 'friendships', f.id), { blockedBy });
    return { ...f, blockedBy };
  }
  async deleteFriendship(meId: ID, otherId: ID) {
    if (!firestore) throw new Error('firestore not initialized');
    const key = friendshipKey(meId, otherId);
    const f = this.db.friendships[key];
    if (!f) return;
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'friendships', key));
    // We don't delete the room or its messages here — both members would lose
    // history. Acceptable for the demo; tweak rules + add a `leftBy` field if
    // needed.
    await batch.commit();
  }

  // ===== rooms =====
  listRooms(userId: ID): ChatRoom[] {
    return Object.values(this.db.rooms)
      .filter((r) => r.memberIds.includes(userId))
      .filter((r) => {
        // Hide orphaned DM rooms: after a friend is removed the room doc still
        // exists (we keep history) but it shouldn't show on the home list when
        // there's no longer a friendship backing it.
        if (r.type !== 'dm') return true;
        const otherId = r.memberIds.find((m) => m !== userId);
        if (!otherId) return false;
        return this.getFriendship(userId, otherId) != null;
      })
      .sort((a, b) =>
        (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt)
      );
  }
  getRoom(roomId: ID): ChatRoom | null {
    const cached = this.db.rooms[roomId] ?? null;
    if (cached) {
      void this.ensureRoomMessagesSubscribed(roomId);
      void this.ensureRoomTypingSubscribed(roomId);
    }
    return cached;
  }
  async createGroup(ownerId: ID, name: string, memberIds: ID[]): Promise<ChatRoom> {
    if (!firestore) throw new Error('firestore not initialized');
    if (ownerId !== this.currentUid) throw new Error('권한이 없습니다.');
    const ids = Array.from(new Set([ownerId, ...memberIds]));
    if (ids.length < 3) throw new Error('그룹은 최소 3명이 필요합니다.');
    if (ids.length > 8) throw new Error('그룹 최대 인원은 8명입니다.');
    const id = makeId('grp_');
    const room: ChatRoom = {
      id,
      type: 'group',
      name: name.trim() || '새 그룹',
      memberIds: ids,
      ownerId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(firestore, 'rooms', id), {
      ...room,
      createdAt: serverTimestamp(),
    });
    this.emit({ type: 'room:updated', payload: room, at: Date.now() });
    return room;
  }
  async leaveGroup(roomId: ID, userId: ID): Promise<void> {
    if (!firestore) throw new Error('firestore not initialized');
    const r = this.db.rooms[roomId];
    if (!r || r.type !== 'group') return;
    const next = r.memberIds.filter((m) => m !== userId);
    if (next.length === 0) {
      await deleteDoc(doc(firestore, 'rooms', roomId));
    } else {
      await updateDoc(doc(firestore, 'rooms', roomId), { memberIds: next });
    }
  }

  // ===== messages =====
  listMessages(roomId: ID): Message[] {
    void this.ensureRoomMessagesSubscribed(roomId);
    return [...(this.db.messages[roomId] ?? [])];
  }
  /** Count of messages in `roomId` that `userId` hasn't read yet (and didn't send themselves). */
  unreadCount(roomId: ID, userId: ID): number {
    const list = this.db.messages[roomId];
    if (!list) return 0;
    let count = 0;
    for (const m of list) {
      if (m.senderId === userId) continue;
      if (m.deleted) continue;
      if (m.readBy.includes(userId)) continue;
      count++;
    }
    return count;
  }
  async sendMessage(roomId: ID, senderId: ID, text: string): Promise<Message> {
    if (!firestore) throw new Error('firestore not initialized');
    if (senderId !== this.currentUid) throw new Error('권한이 없습니다.');
    const trimmed = text.trim();
    if (!trimmed) throw new Error('빈 메시지는 보낼 수 없습니다.');
    if (trimmed.length > 500) throw new Error('메시지는 500자까지 입력할 수 있습니다.');

    // Client-side first line of defense for blocking on DM rooms: refuse to send
    // if either side has blocked the other. (The receiving-side filter and
    // security rules provide the real enforcement.)
    const room = this.db.rooms[roomId];
    if (room?.type === 'dm') {
      const otherId = room.memberIds.find((m) => m !== senderId);
      if (otherId) {
        const f = this.getFriendship(senderId, otherId);
        if (f && (f.blockedBy?.[otherId] === true || f.blockedBy?.[senderId] === true)) {
          throw new Error('차단된 상대에게는 메시지를 보낼 수 없습니다.');
        }
      }
    }

    const id = makeId('m_');
    const msg: Message = {
      id,
      roomId,
      senderId,
      text: trimmed,
      createdAt: new Date().toISOString(),
      readBy: [senderId],
    };
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'rooms', roomId, 'messages', id), {
      ...msg,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(firestore, 'rooms', roomId), {
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: trimmed.slice(0, 60),
    });
    await batch.commit();
    return msg;
  }
  async deleteMessage(roomId: ID, messageId: ID, requesterId: ID): Promise<void> {
    if (!firestore) throw new Error('firestore not initialized');
    const list = this.db.messages[roomId] ?? [];
    const m = list.find((x) => x.id === messageId);
    if (!m) return;
    if (m.senderId !== requesterId) throw new Error('본인 메시지만 삭제할 수 있습니다.');
    const ageSec = (Date.now() - new Date(m.createdAt).getTime()) / 1000;
    if (ageSec > 5 * 60) throw new Error('전송 후 5분 이내만 삭제할 수 있습니다.');
    await updateDoc(doc(firestore, 'rooms', roomId, 'messages', messageId), {
      deleted: true,
      text: '',
    });
  }
  async markRead(roomId: ID, userId: ID): Promise<void> {
    if (!firestore) return;
    if (userId !== this.currentUid) return;
    const list = this.db.messages[roomId] ?? [];
    const toMark = list.filter((m) => !m.readBy.includes(userId) && m.senderId !== userId);
    if (toMark.length === 0) return;
    const batch = writeBatch(firestore);
    for (const m of toMark) {
      // arrayUnion appends atomically server-side, so a concurrent reader's
      // readBy entry won't be clobbered by our stale local copy of the array.
      batch.update(doc(firestore, 'rooms', roomId, 'messages', m.id), {
        readBy: arrayUnion(userId),
      });
    }
    try {
      await batch.commit();
    } catch {
      // Rules might block in rare races; ignore.
    }
  }

  // ===== typing =====
  async setTyping(roomId: ID, userId: ID, isTyping: boolean): Promise<void> {
    if (!firestore) return;
    if (userId !== this.currentUid) return;
    const ref = doc(firestore, 'rooms', roomId, 'typing', userId);
    if (isTyping) {
      await setDoc(ref, { expiresAt: Date.now() + 4000 });
    } else {
      await deleteDoc(ref).catch(() => undefined);
    }
  }
  getTyping(roomId: ID): TypingState {
    const map = { ...(this.db.typing[roomId] ?? {}) };
    const now = Date.now();
    for (const [u, exp] of Object.entries(map)) {
      if (exp < now) delete map[u];
    }
    return map;
  }

  // ===== reset (used by Settings "데모 데이터 초기화") =====
  async resetAll(): Promise<void> {
    // We can't safely wipe the multi-tenant Firestore from the client; just
    // sign out so the user lands back on the login screen.
    await this.signOut();
  }

  // ===== listeners setup =====
  private setupUserScope(uid: ID) {
    if (!firestore) return;

    // own profile
    this.ensureUserSubscribed(uid);

    // friendships involving me
    this.userScopedUnsubs.push(
      onSnapshot(
        query(collection(firestore, 'friendships'), where('userIds', 'array-contains', uid)),
        (snap) => this.applyFriendshipsSnap(snap),
        (err) => console.error('[tts-chat] listener error', err)
      )
    );

    // incoming friend requests
    this.userScopedUnsubs.push(
      onSnapshot(
        query(collection(firestore, 'friendRequests'), where('toUserId', '==', uid)),
        (snap) => this.applyFriendRequestsSnap(snap),
        (err) => console.error('[tts-chat] listener error', err)
      )
    );
    // outgoing friend requests (so the user sees their own pending list)
    this.userScopedUnsubs.push(
      onSnapshot(
        query(collection(firestore, 'friendRequests'), where('fromUserId', '==', uid)),
        (snap) => this.applyFriendRequestsSnap(snap),
        (err) => console.error('[tts-chat] listener error', err)
      )
    );

    // rooms (DM + group)
    this.userScopedUnsubs.push(
      onSnapshot(
        query(collection(firestore, 'rooms'), where('memberIds', 'array-contains', uid)),
        (snap) => this.applyRoomsSnap(snap),
        (err) => console.error('[tts-chat] listener error', err)
      )
    );
  }
  private teardownUserScope() {
    for (const u of this.userScopedUnsubs) u();
    this.userScopedUnsubs = [];
    for (const u of this.roomMessageUnsubs.values()) u();
    this.roomMessageUnsubs.clear();
    for (const u of this.roomTypingUnsubs.values()) u();
    this.roomTypingUnsubs.clear();
    for (const u of this.userUnsubs.values()) u();
    this.userUnsubs.clear();
    this.subscribedUsers.clear();
    this.db = emptyCache();
    this.emit({ type: 'profile:updated', payload: { reset: true }, at: Date.now() });
  }

  private ensureUserSubscribed(uid: ID) {
    if (!firestore) return;
    if (this.subscribedUsers.has(uid)) return;
    this.subscribedUsers.add(uid);
    const unsub = onSnapshot(
      doc(firestore, 'users', uid),
      (snap) => {
        if (!snap.exists()) {
          delete this.db.users[uid];
        } else {
          this.db.users[uid] = normalizeUser(snap.data(), uid);
        }
        this.emit({ type: 'profile:updated', payload: { id: uid }, at: Date.now() });
      },
      (err) => console.error('[tts-chat] listener error', err)
    );
    this.userUnsubs.set(uid, unsub);
  }
  private ensureRoomMessagesSubscribed(roomId: ID) {
    if (!firestore) return;
    if (this.roomMessageUnsubs.has(roomId)) return;
    // Only subscribe to the last 30 days of messages to bound the read volume.
    // Locally-pending messages have an unresolved serverTimestamp (createdAt is
    // momentarily null) — Firestore still surfaces them in the snapshot with
    // hasPendingWrites set, so a just-sent message isn't dropped by this filter
    // before its server timestamp settles.
    const cutoff = Timestamp.fromMillis(Date.now() - 30 * 24 * 3600 * 1000);
    const messagesQuery = query(
      collection(firestore, 'rooms', roomId, 'messages'),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      messagesQuery,
      (snap) => {
        const arr: Message[] = [];
        snap.forEach((d) => {
          const data = d.data();
          arr.push(normalizeMessage(data, d.id, roomId));
        });
        arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        this.db.messages[roomId] = arr;
        this.emit({ type: 'message:new', payload: { roomId }, at: Date.now() });
      },
      (err) => {
        // Surface listener errors (most commonly rule denials) so they don't
        // disappear silently.
        console.error('[tts-chat] messages listener error', roomId, err);
      }
    );
    this.roomMessageUnsubs.set(roomId, unsub);
  }
  private ensureRoomTypingSubscribed(roomId: ID) {
    if (!firestore) return;
    if (this.roomTypingUnsubs.has(roomId)) return;
    const unsub = onSnapshot(
      collection(firestore, 'rooms', roomId, 'typing'),
      (snap) => {
        const map: TypingState = {};
        snap.forEach((d) => {
          const exp = (d.data() as { expiresAt?: number })?.expiresAt;
          if (typeof exp === 'number') map[d.id] = exp;
        });
        this.db.typing[roomId] = map;
        this.emit({ type: 'typing', payload: { roomId, typing: map }, at: Date.now() });
      },
      (err) => console.error('[tts-chat] listener error', err)
    );
    this.roomTypingUnsubs.set(roomId, unsub);
  }

  private applyFriendshipsSnap(snap: QuerySnapshot<DocumentData>) {
    const seen = new Set<string>();
    snap.forEach((d) => {
      seen.add(d.id);
      const data = d.data();
      const f: Friendship = {
        id: d.id,
        userIds: data.userIds as [ID, ID],
        createdAt: isoOrNow(data.createdAt),
        nicknames: data.nicknames ?? {},
        mutedBy: data.mutedBy ?? {},
        blockedBy: data.blockedBy ?? {},
        chatRoomId: data.chatRoomId ?? dmRoomKey(data.userIds[0], data.userIds[1]),
      };
      this.db.friendships[d.id] = f;
      // Make sure both members' profiles are subscribed for display.
      for (const id of f.userIds) this.ensureUserSubscribed(id);
    });
    // Remove any friendships that disappeared from this user's scope.
    for (const id of Object.keys(this.db.friendships)) {
      const f = this.db.friendships[id];
      if (!seen.has(id) && f.userIds.includes(this.currentUid ?? '')) {
        delete this.db.friendships[id];
      }
    }
    this.emit({ type: 'friend:updated', payload: {}, at: Date.now() });
  }
  private applyFriendRequestsSnap(snap: QuerySnapshot<DocumentData>) {
    snap.forEach((d) => {
      const data = d.data();
      const r: FriendRequest = {
        id: d.id,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        status: data.status,
        createdAt: isoOrNow(data.createdAt),
        respondedAt: data.respondedAt ? isoOrNow(data.respondedAt) : undefined,
      };
      this.db.friendRequests[d.id] = r;
      this.ensureUserSubscribed(r.fromUserId);
      this.ensureUserSubscribed(r.toUserId);
    });
    this.emit({ type: 'friend:requested', payload: {}, at: Date.now() });
  }
  private applyRoomsSnap(snap: QuerySnapshot<DocumentData>) {
    const seen = new Set<string>();
    snap.forEach((d) => {
      seen.add(d.id);
      const data = d.data();
      const r: ChatRoom = {
        id: d.id,
        type: data.type,
        name: data.name,
        memberIds: data.memberIds,
        ownerId: data.ownerId,
        createdAt: isoOrNow(data.createdAt),
        lastMessageAt: data.lastMessageAt ? isoOrNow(data.lastMessageAt) : undefined,
        lastMessagePreview: data.lastMessagePreview,
      };
      this.db.rooms[d.id] = r;
      for (const id of r.memberIds) this.ensureUserSubscribed(id);
      // Subscribe to messages eagerly so HomePage can compute unread counts
      // without the user having to open each room first.
      this.ensureRoomMessagesSubscribed(d.id);
    });
    for (const id of Object.keys(this.db.rooms)) {
      const r = this.db.rooms[id];
      if (!seen.has(id) && r.memberIds.includes(this.currentUid ?? '')) {
        delete this.db.rooms[id];
        delete this.db.messages[id];
        delete this.db.typing[id];
        const mu = this.roomMessageUnsubs.get(id);
        if (mu) {
          mu();
          this.roomMessageUnsubs.delete(id);
        }
        const tu = this.roomTypingUnsubs.get(id);
        if (tu) {
          tu();
          this.roomTypingUnsubs.delete(id);
        }
      }
    }
    this.emit({ type: 'room:updated', payload: {}, at: Date.now() });
  }
}

// ===== helpers =====
function normalizeUser(data: DocumentData, uid: string): UserProfile {
  return {
    id: uid,
    email: data.email ?? '',
    nickname: data.nickname ?? '익명',
    avatarUrl: data.avatarUrl,
    friendCode: data.friendCode ?? '',
    friendCodeRotatedAt: isoOrNow(data.friendCodeRotatedAt),
    createdAt: isoOrNow(data.createdAt),
  };
}
function normalizeMessage(data: DocumentData, id: string, roomId: string): Message {
  return {
    id,
    roomId,
    senderId: data.senderId,
    text: data.text ?? '',
    createdAt: isoOrNow(data.createdAt),
    readBy: Array.isArray(data.readBy) ? data.readBy : [],
    deleted: !!data.deleted,
  };
}
function humanizeFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다.';
    case 'auth/invalid-email':
      return '올바른 이메일 형식이 아닙니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 일치하지 않습니다.';
    case 'auth/too-many-requests':
      return '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
    default:
      return (err as Error)?.message ?? '알 수 없는 오류가 발생했습니다.';
  }
}
