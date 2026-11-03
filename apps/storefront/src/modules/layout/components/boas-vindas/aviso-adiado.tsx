"use client"

import dynamic from "next/dynamic"

// O aviso só abre depois de 8 s e de uma tela rolada: o código dele baixa fora da fila da foto principal.
const AvisoBoasVindasAdiado = dynamic(() => import("./aviso"), { ssr: false })

export default AvisoBoasVindasAdiado
