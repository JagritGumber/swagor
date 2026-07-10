import type { Handle } from 'remix/ui'
import { on } from 'remix/ui'
import { overlay, modalBox, modalTitle, modalMessage, buttonRow, cancelBtn, confirmBtn } from './styles.ts'
import type { ConfirmModalProps } from './types.ts'

export function ConfirmModal(handle: Handle<ConfirmModalProps>) {
  return () => {
    const { open, title: t, message: m, confirmLabel, onClose, onConfirm } = handle.props
    if (!open) return null

    return (
      <div mix={overlay}>
        <div mix={modalBox}>
          <div mix={modalTitle}>{t}</div>
          <div mix={modalMessage}>{m}</div>
          <div mix={buttonRow}>
            <button
              mix={[cancelBtn, on<HTMLButtonElement>('click', onClose)]}
              type="button"
            >
              Cancel
            </button>
            <button
              mix={[confirmBtn, on<HTMLButtonElement>('click', onConfirm)]}
              type="button"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
