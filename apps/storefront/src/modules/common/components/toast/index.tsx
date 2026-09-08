"use client"

import { useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ToastMsg = { message: string; action?: { label: string; href: string } }
export function showToast(t: ToastMsg) {
  window.dispatchEvent(new CustomEvent<ToastMsg>("eclat:toast", { detail: t }))
}

export default function ToastHost() {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      setToast((e as CustomEvent<ToastMsg>).detail)
      window.setTimeout(() => setToast(null), 3500)
    }
    window.addEventListener("eclat:toast", on)
    return () => window.removeEventListener("eclat:toast", on)
  }, [])
  if (!toast) return null
  return (
    <div role="status" className="fixed bottom-4 inset-x-4 z-[80] small:left-auto small:right-6 small:w-80 bg-eclat-grafite text-eclat-luz rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4 shadow-lg" data-testid="toast">
      <span>{toast.message}</span>
      {toast.action && <LocalizedClientLink href={toast.action.href} className="underline whitespace-nowrap">{toast.action.label}</LocalizedClientLink>}
    </div>
  )
}
