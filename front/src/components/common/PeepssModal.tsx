import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from 'react'

type PeepssModalProps = {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  size?: 'small' | 'large'
  title: string
}

function PeepssModal({
  children,
  isOpen,
  onClose,
  size = 'large',
  title,
}: PeepssModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    window.setTimeout(() => dialogRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="peepss-modal-backdrop" onMouseDown={handleBackdropClick}>
      <div
        aria-modal="true"
        aria-labelledby={titleId}
        className={`peepss-modal peepss-modal-${size}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="peepss-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="Close"
            className="peepss-close-button ui-icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="peepss-modal-content">{children}</div>
      </div>
    </div>
  )
}

export default PeepssModal
