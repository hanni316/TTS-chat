// Shared logic for the desktop-notification toggle. Used by both the home
// screen quick-toggle and the Settings row so they stay in sync and request
// permission identically.

import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';

export type NotificationPermissionState = 'granted' | 'denied' | 'default';

export interface NotificationToggleState {
  supported: boolean;
  permission: NotificationPermissionState;
  /** True only when the user has enabled the setting AND the browser has granted permission. */
  enabled: boolean;
  toggle: (next: boolean) => Promise<void>;
}

export function useNotificationToggle(): NotificationToggleState {
  const settingEnabled = useSettingsStore((s) => s.settings.desktopNotifications);
  const setSetting = useSettingsStore((s) => s.set);
  const push = useToastStore((s) => s.push);

  const supported = typeof Notification !== 'undefined';
  const permission: NotificationPermissionState = supported
    ? (Notification.permission as NotificationPermissionState)
    : 'denied';

  const toggle = async (next: boolean) => {
    if (!supported) {
      push('이 브라우저는 알림을 지원하지 않습니다', 'error');
      return;
    }
    if (next) {
      if (permission === 'denied') {
        push(
          '브라우저에서 알림이 차단되어 있어요. 주소창 자물쇠 → 알림 → 허용으로 변경해주세요.',
          'error'
        );
        return;
      }
      if (permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          push('알림 권한이 거부되었어요', 'error');
          return;
        }
      }
      setSetting('desktopNotifications', true);
      push('데스크톱 알림을 켰어요', 'success');
    } else {
      setSetting('desktopNotifications', false);
    }
  };

  return {
    supported,
    permission,
    enabled: settingEnabled && permission === 'granted',
    toggle,
  };
}
