"use client"

import dynamic from "next/dynamic"

// O wizard só abre depois de hidratar e com atraso: o código dele não precisa disputar a conexão com a foto principal.
const WizardAdiado = dynamic(() => import("./wizard"), { ssr: false })

export default WizardAdiado
