import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation for destructive actions.
 *
 * `Alert.alert` is a native-only API — react-native-web ships it as a stub, so
 * on web the callback never fires and the button silently does nothing. Every
 * delete in this app is behind a confirmation, which meant every delete was
 * dead on web. This routes to `window.confirm` there instead.
 *
 * Resolves true when the user confirms.
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel = 'Delete',
}: {
  title: string;
  message: string;
  confirmLabel?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(!!ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
