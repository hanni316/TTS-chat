// Hooks into the backend's message bus and fires OS-level Web Notifications
// for incoming messages.
//
// Rules:
// - Only fire if the user has granted permission AND has the setting enabled.
// - Never fire for the user's own messages.
// - Never fire while the user is actively viewing that exact room AND the
//   window has focus (they're already seeing the message).
// - Per-room dedupe via the `tag` field — multiple messages from the same room
//   collapse into a single notification.
// - Clicking the notification focuses the window and navigates to the room.

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { backend } from '@/services/backend';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import type { ID, ServerEvent } from '@/types';

export function useDesktopNotifications(): void {
  const me = useAuthStore((s) => s.user);
  const enabled = useSettingsStore((s) => s.settings.desktopNotifications);
  const location = useLocation();
  const nav = useNavigate();

  // Remembers the latest message id we've already accounted for in each room,
  // so a snapshot fired for read-receipt updates doesn't re-notify.
  const lastSeenRef = useRef<Map<ID, string>>(new Map());
  // Keeps the latest location/nav available inside the (long-lived) subscription
  // closure without re-subscribing on every navigation.
  const locationRef = useRef(location);
  locationRef.current = location;
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    if (!me) return;
    if (typeof Notification === 'undefined') return;

    const unsub = backend.subscribe((e: ServerEvent) => {
      if (e.type !== 'message:new') return;
      const payload = e.payload as { roomId?: string } | undefined;
      const roomId = payload?.roomId;
      if (!roomId) return;

      const messages = backend.listMessages(roomId);
      if (messages.length === 0) return;

      const latest = messages[messages.length - 1];
      const previousLatestId = lastSeenRef.current.get(roomId);

      // First time we observe this room — seed without notifying so history
      // doesn't fire a flood on app load.
      if (!previousLatestId) {
        lastSeenRef.current.set(roomId, latest.id);
        return;
      }
      if (latest.id === previousLatestId) return; // same latest → readBy update, not a new message

      // Figure out which messages are new since we last looked at this room.
      const prevIdx = messages.findIndex((m) => m.id === previousLatestId);
      const newMessages =
        prevIdx >= 0 ? messages.slice(prevIdx + 1) : [latest];
      lastSeenRef.current.set(roomId, latest.id);

      // Filter to messages from other people, not deleted.
      const fromOthers = newMessages.filter(
        (m) => m.senderId !== me.id && !m.deleted
      );
      if (fromOthers.length === 0) return;

      // Re-check permission + setting at fire time (user might have flipped it).
      if (!enabled) return;
      if (Notification.permission !== 'granted') return;

      // Skip if already viewing this exact room with the window focused.
      const inThisRoom =
        locationRef.current.pathname === `/room/${encodeURIComponent(roomId)}`;
      if (inThisRoom && typeof document !== 'undefined' && document.hasFocus()) {
        return;
      }

      // Show the freshest message; older ones in the burst are collapsed into
      // a "(외 N개)" suffix to avoid flooding the OS notification center.
      const latestNew = fromOthers[fromOthers.length - 1];
      const extraCount = fromOthers.length - 1;
      const room = backend.getRoom(roomId);
      const sender = backend.getProfile(latestNew.senderId);
      const title =
        room?.type === 'group' && room.name
          ? `${sender?.nickname ?? '알 수 없음'} · ${room.name}`
          : sender?.nickname ?? '새 메시지';
      const body = extraCount > 0
        ? `${latestNew.text}\n(외 ${extraCount}개의 새 메시지)`
        : latestNew.text || '(새 메시지)';

      try {
        const n = new Notification(title, {
          body,
          icon: '/pwa-192.svg',
          tag: roomId,
          // Keep visible until clicked — chat notifications shouldn't auto-dismiss
          // before the user sees them.
          requireInteraction: false,
        });
        n.onclick = () => {
          window.focus();
          navRef.current(`/room/${encodeURIComponent(roomId)}`);
          n.close();
        };
      } catch {
        // Some browsers throw on construction without active SW; ignore.
      }
    });

    return () => {
      unsub();
    };
  }, [me, enabled]);
}
