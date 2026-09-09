import { ReactNode, RefObject, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableChildren(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

export interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  ariaDescribedBy?: string;
  backdropClassName?: string;
}

/**
 * A dependency-free dialog primitive used by Nexara overlays. It supplies semantic dialog attributes,
 * Escape handling, tab cycling, scroll locking, backdrop dismissal, and focus restoration.
 */
export function AccessibleDialog({ open, onClose, title, children, className = '', initialFocusRef, ariaDescribedBy, backdropClassName = '' }: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closeHandlerRef = useRef(onClose);
  const titleId = useId();

  // Keep callbacks current without re-running the focus lifecycle on every parent render.
  useEffect(() => { closeHandlerRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current || focusableChildren(dialogRef.current || document.body)[0] || dialogRef.current;
      target?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = focusableChildren(dialogRef.current);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
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
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;
  // Render at document level so CSS containment from sticky/backdrop-filter parents
  // cannot shrink a fixed overlay to the navigation bar's own box.
  const overlay = (
    <div
      className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto ${backdropClassName}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      data-dialog-backdrop
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={className}
      >
        <span id={titleId} className="sr-only">{title}</span>
        {children}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? overlay : createPortal(overlay, document.body);
}
