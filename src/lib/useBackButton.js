import { useEffect, useRef } from 'react';

/* 
 * Handles Android/browser back button.
 * Pushes a dummy history entry on mount, listens for popstate.
 * When user presses back → onBack() runs.
 * When modal unmounts programmatically, listener is removed.
 */
export function useBackButton(onBack, enabled = true) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    try {
      window.history.pushState({ __modal: true }, '');
    } catch {
      // ignore — some browsers may block
    }

    const onPop = () => {
      onBackRef.current?.();
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [enabled]);
}