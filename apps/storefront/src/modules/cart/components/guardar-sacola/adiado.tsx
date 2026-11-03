"use client"

import dynamic from "next/dynamic"

// O cartão só aparece depois de pôr peça na sacola: o código dele baixa fora da fila da foto principal.
const GuardarSacolaAdiado = dynamic(() => import("./index"), { ssr: false })

export default GuardarSacolaAdiado
