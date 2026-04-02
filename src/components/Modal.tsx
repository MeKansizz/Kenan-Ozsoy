import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, color = 'copper' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; color?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-[--color-midnight] border border-[--color-graphite] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b border-[--color-graphite]`}>
          <h3 className={`text-base font-semibold ${color === 'info' ? 'text-info' : 'text-copper'}`}>{title}</h3>
          <button onClick={onClose} className="text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
