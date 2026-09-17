import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import AddressFields from "@modules/common/components/address-fields"
import React, { useState } from "react"

const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.address_2": cart?.billing_address?.address_2 || "",
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
    "billing_address.metadata.numero":
      String((cart?.billing_address?.metadata as Record<string, unknown>)?.numero ?? ""),
    "billing_address.metadata.bairro":
      String((cart?.billing_address?.metadata as Record<string, unknown>)?.bairro ?? ""),
    "billing_address.metadata.municipio_ibge":
      String((cart?.billing_address?.metadata as Record<string, unknown>)?.municipio_ibge ?? ""),
  })

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nome"
          name="billing_address.first_name"
          autoComplete="given-name"
          value={formData["billing_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="billing-first-name-input"
        />
        <Input
          label="Sobrenome"
          name="billing_address.last_name"
          autoComplete="family-name"
          value={formData["billing_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="billing-last-name-input"
        />
        <Input
          label="Empresa"
          name="billing_address.company"
          value={formData["billing_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="billing-company-input"
        />
        <Input
          label="Telefone"
          name="billing_address.phone"
          autoComplete="tel"
          value={formData["billing_address.phone"]}
          onChange={handleChange}
          data-testid="billing-phone-input"
        />
      </div>
      <div className="mt-4">
        <AddressFields
          prefixo="billing_address"
          valores={formData}
          onChange={(campo, valor) =>
            setFormData((p) => ({ ...p, [campo]: valor }))
          }
          region={cart?.region}
        />
      </div>
    </>
  )
}

export default BillingAddress
