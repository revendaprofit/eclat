"use client"

import dynamic from "next/dynamic"

// Os envelopes só abrem depois de 8 s e de uma tela rolada: o código baixa fora da fila da foto principal.
const EnvelopesAdiado = dynamic(() => import("./index"), { ssr: false })

export default EnvelopesAdiado
