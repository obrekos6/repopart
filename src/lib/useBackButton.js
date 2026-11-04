import { useEffect, useRef } from 'react';

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
      // If our entry is still the current one, another modal's entry
      if (window.history.state?.__modalId === id) return;
      onBackRef.current?.();
    };

    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);

      // Defer back() to the next task. If another modal was opened in the same
      // commit (e.g. SideMenu → ProfileScreen), its pushState runs before this
      // timeout fires, so history.state won't belong to us anymore — and we
      // won't accidentally pop the newly opened modal.
      setTimeout(() => {
        if (window.history.state?.__modalId === id) {
          try {
            window.history.back();
          } catch {
            // ignore
          }
        }
      }, 0);
    };
  }, [enabled]);
}