import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from './AppIcon';

type AppSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function AppSheet({
  open,
  title,
  description,
  onClose,
  children,
  className = '',
}: AppSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `sheet-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = previousOverflow;
      };
    }

    setVisible(false);
    previousFocusRef.current?.focus();
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open && mounted) closeRef.current?.focus();
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden={!visible}
      className={`sheet-layer${visible ? ' is-open' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`app-sheet ${className}`}
        ref={dialogRef}
        role="dialog"
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            aria-label="Close"
            className="icon-button sheet-close"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <AppIcon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
