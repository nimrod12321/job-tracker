import {
  useEffect,
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

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    window.setTimeout(() => dialogRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
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
        className={`peepss-modal peepss-modal-${size}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="peepss-modal-header">
          <h2>{title}</h2>
          <button
            aria-label="Close"
            className="peepss-close-button"
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
