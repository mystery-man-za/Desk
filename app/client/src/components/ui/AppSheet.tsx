import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from './AppIcon';

type AppSheetProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  dragToClose?: boolean;
  exitDuration?: number;
  focusContainer?: boolean;
};

export function AppSheet({
  open,
  title,
  description,
  onClose,
  children,
  className = '',
  dragToClose = false,
  exitDuration = 180,
  focusContainer = false,
}: AppSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; element: HTMLElement } | null>(null);
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
    }, exitDuration);
    return () => window.clearTimeout(timer);
  }, [exitDuration, open]);

  function startDrag(event: PointerEvent<HTMLElement>) {
    if (!dragToClose || event.pointerType === 'mouse' || !event.isPrimary) return;
    const target = event.target;
    const scrollable = target instanceof HTMLElement
      ? target.closest<HTMLElement>('.sheet-nav-list, [data-sheet-scroll]')
      : null;
    if (scrollable && scrollable.scrollTop > 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      element: event.currentTarget,
    };
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const offset = event.clientY - drag.startY;
    if (offset < 6) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    drag.element.style.transition = 'none';
    drag.element.style.transform = `translateY(${offset}px)`;
  }

  function finishDrag(event: PointerEvent<HTMLElement>, dismiss: boolean) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const shouldClose =
      dismiss &&
      event.clientY - drag.startY >
        Math.max(100, drag.element.offsetHeight * 0.25);
    drag.element.style.removeProperty('transition');
    drag.element.style.removeProperty('transform');
    dragRef.current = null;
    if (shouldClose) onClose();
  }

  useEffect(() => {
    if (!dragToClose || !open || !mounted) return;
    const sheet = dialogRef.current;
    if (!sheet) return;

    let startY = 0;
    let startX = 0;
    let latestY = 0;
    let latestTime = 0;
    let phase: 'idle' | 'pending' | 'dragging' = 'idle';
    let canDragFromStart = false;
    let settleTimer = 0;

    function clearDrag() {
      phase = 'idle';
      sheet.style.removeProperty('transition');
      sheet.style.removeProperty('transform');
    }

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) {
        clearDrag();
        return;
      }
      const touch = event.touches[0];
      const target = event.target;
      const handle = target instanceof Element &&
        target.closest('.sheet-grabber, .sheet-heading');
      const scrollable = target instanceof Element
        ? target.closest<HTMLElement>('.sheet-nav-list, [data-sheet-scroll]')
        : null;
      startY = touch.clientY;
      startX = touch.clientX;
      latestY = touch.clientY;
      latestTime = performance.now();
      canDragFromStart = Boolean(handle) || !scrollable || scrollable.scrollTop <= 0;
      phase = 'pending';
    }

    function handleTouchMove(event: TouchEvent) {
      if (phase === 'idle' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaY = touch.clientY - startY;
      const deltaX = touch.clientX - startX;
      if (phase === 'pending') {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          phase = 'idle';
          return;
        }
        if (deltaY <= 6) return;
        if (!canDragFromStart) {
          phase = 'idle';
          return;
        }
        phase = 'dragging';
      }
      if (phase !== 'dragging') return;
      if (event.cancelable) event.preventDefault();
      latestY = touch.clientY;
      latestTime = performance.now();
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
    }

    function handleTouchEnd() {
      if (phase !== 'dragging') {
        phase = 'idle';
        return;
      }
      const delta = Math.max(0, latestY - startY);
      const distanceThreshold = Math.max(100, sheet.offsetHeight * 0.25);
      const elapsed = performance.now() - latestTime;
      const velocity = elapsed > 0 ? (latestY - startY) / elapsed : 0;
      sheet.style.removeProperty('transition');
      sheet.style.removeProperty('transform');
      phase = 'idle';
      if (delta > distanceThreshold || (delta > 24 && velocity > 0.5)) {
        onClose();
      } else {
        sheet.style.transition = 'transform 200ms cubic-bezier(.32, .72, 0, 1)';
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(
          () => sheet.style.removeProperty('transition'),
          200,
        );
      }
    }

    sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
    sheet.addEventListener('touchend', handleTouchEnd, { passive: true });
    sheet.addEventListener('touchcancel', clearDrag, { passive: true });
    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart);
      sheet.removeEventListener('touchmove', handleTouchMove);
      sheet.removeEventListener('touchend', handleTouchEnd);
      sheet.removeEventListener('touchcancel', clearDrag);
      window.clearTimeout(settleTimer);
      clearDrag();
    };
  }, [dragToClose, mounted, onClose, open]);

  useEffect(() => {
    if (!open || !mounted) return;
    if (focusContainer) {
      dialogRef.current?.focus();
      return;
    }
    closeRef.current?.focus();
  }, [focusContainer, open, mounted]);

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
        tabIndex={focusContainer ? -1 : undefined}
        onPointerCancel={(event) => finishDrag(event, false)}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={(event) => finishDrag(event, true)}
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
