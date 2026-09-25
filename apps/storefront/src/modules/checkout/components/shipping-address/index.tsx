import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"
import Checkbox from "@modules/common/components/checkbox"
import Input from "@modules/common/components/input"
import AddressFields from "@modules/common/components/address-fields"
import { cpfValido, formatarCpf } from "@lib/util/cpf"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import AddressSelect from "../address-select"

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.address_2": cart?.shipping_address?.address_2 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code": cart?.shipping_address?.country_code || "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    "shipping_address.metadata.numero":
      String((cart?.shipping_address?.metadata as Record<string, unknown>)?.numero ?? ""),
    "shipping_address.metadata.bairro":
      String((cart?.shipping_address?.metadata as Record<string, unknown>)?.bairro ?? ""),
    "shipping_address.metadata.municipio_ibge":
      String((cart?.shipping_address?.metadata as Record<string, unknown>)?.municipio_ibge ?? ""),
    email: cart?.email || "",
    cpf: formatarCpf(String((customer?.metadata as Record<string, unknown>)?.cpf ?? "")),
  })

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    if (address) {
      setFormData((prevState: Record<string, string>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.address_2": address?.address_2 || "",
        "shipping_address.company": address?.company || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": address?.country_code || "",
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
        "shipping_address.metadata.numero":
          String((address?.metadata as Record<string, unknown>)?.numero ?? ""),
        "shipping_address.metadata.bairro":
          String((address?.metadata as Record<string, unknown>)?.bairro ?? ""),
        "shipping_address.metadata.municipio_ibge":
          String((address?.metadata as Record<string, unknown>)?.municipio_ibge ?? ""),
      }))
    }

    if (email) {
      setFormData((prevState: Record<string, string>) => ({
        ...prevState,
        email: email,
      }))
    }
  }

  useEffect(() => {
    // Ensure cart is not null and has a shipping_address before setting form data
    if (cart && cart.shipping_address) {
      setFormAddress(cart?.shipping_address, cart?.email)
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
    }
  }, [cart]) // Add cart as a dependency

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
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-5">
          <p className="text-small-regular">
            {`Oi, ${customer.first_name}! Quer usar um dos seus endereços salvos?`}
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", "")
              ) as unknown as HttpTypes.StoreCartAddress
            }
            onSelect={setFormAddress}
          />
        </Container>
      )}
      <div>
        <AddressFields
          prefixo="shipping_address"
          valores={formData}
          onChange={(campo, valor) =>
            setFormData((p) => ({ ...p, [campo]: valor }))
          }
          region={cart?.region}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Input
          label="Nome"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label="Sobrenome"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
        />
      </div>
      <div className="mt-4">
        <Input
          label="CPF"
          name="cpf"
          value={formData["cpf"] || ""}
          onChange={(e) => setFormData((p) => ({ ...p, cpf: e.target.value }))}
          required
          data-testid="input-cpf"
        />
        <p className="mt-1 text-sm text-ui-fg-subtle">
          Precisamos do CPF para emitir a nota fiscal do seu pedido.
        </p>
        {formData["cpf"] && !cpfValido(formData["cpf"]) && (
          <p className="mt-1 text-sm text-red-600">CPF inválido. Confira os números.</p>
        )}
      </div>
      <div className="my-8">
        <Checkbox
          label="Endereço de cobrança igual ao de entrega"
          name="same_as_billing"
          checked={checked}
          onChange={onChange}
          data-testid="billing-address-checkbox"
        />
      </div>
    </>
  )
}

export default ShippingAddress
