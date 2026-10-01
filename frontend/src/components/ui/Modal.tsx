import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ title, eyebrow, children, onClose }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-body">
        <header className="modal-header">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id={titleId}>{title}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
