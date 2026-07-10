import type { ConfirmModalProps } from './types'

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70">
      <div className="w-full max-w-[400px] rounded-xl border border-border-default bg-[#1a1a1a] p-gap-6 font-ui">
        <div className="mb-gap-2 text-lg font-semibold text-[#f1f5f9]">{title}</div>
        <div className="mb-gap-6 text-sm font-normal leading-normal text-[#94a3b8]">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="appearance-none cursor-pointer rounded-lg border border-border-default bg-transparent px-gap-4 py-gap-2 font-ui text-sm font-medium text-[#94a3b8] transition-[color,border-color] duration-150 hover:border-white/20 hover:text-[#f1f5f9]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="appearance-none cursor-pointer rounded-lg border-0 bg-[#ff5050] px-gap-4 py-gap-2 font-ui text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-[0.85]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
