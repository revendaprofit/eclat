"use client"

import dynamic from "next/dynamic"

// O cartão só aparece 2,5 s depois de carregar: o código dele baixa fora da fila da foto principal.
const AvisoFreteAdiado = dynamic(() => import("./index"), { ssr: false })

export default AvisoFreteAdiado
