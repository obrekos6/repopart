import { useEffect, useRef } from 'react';

/*
 * Handles Android/browser back button.
 * Pushes a tagged history entry on mount, listens for popstate.
 *
 * - user presses back   → onBack() runs, the browser consumes our entry
 * - modal closes itself → cleanup removes our entry via history.back()
 *                         (listener is detached first, so no false close)
 *
 * Each entry carries a unique id, so stacked modals don't pop
 * each other's history entries.
 */
export function useBackButton(onBack, enabled = true) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    const id = Math.random().toString(36).slice(2);

    try {
      window.history.pushState({ __modal: true, __modalId: id }, '');
    } catch {
      // some browsers may block pushState — skip the history trick entirely
      return;
    }

    const onPop = () => {
      onBackRef.current?.();
    };

    window.addEventListener('popstate', onPop);

    return () => {
      // detach first — otherwise our own history.back() would re-trigger onBack
      window.removeEventListener('popstate', onPop);

      // pop only if our entry is still on top.
      // it won't be if the user pressed back themselves (entry consumed),
      // or if a stacked modal has already popped past us.
      if (window.history.state?.__modalId === id) {
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [enabled]);
}