"use client"

import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { PencilSquare as Edit, Trash } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import AddressFields from "@modules/common/components/address-fields"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import { Button, Heading, Text, clx } from "@modules/common/components/ui"
import Spinner from "@modules/common/icons/spinner"
import React, { useActionState, useEffect, useState } from "react"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
  isActive?: boolean
}

// Valores dos campos de endereço a partir do endereço salvo (sem prefixo).
function valoresEnderecoIniciais(
  address: HttpTypes.StoreCustomerAddress
): Record<string, string> {
  const metadata = (address.metadata as Record<string, unknown>) || {}
  return {
    address_1: address.address_1 || "",
    address_2: address.address_2 || "",
    postal_code: address.postal_code || "",
    city: address.city || "",
    province: address.province || "",
    country_code: address.country_code || "",
    "metadata.numero": String(metadata.numero ?? ""),
    "metadata.bairro": String(metadata.bairro ?? ""),
    "metadata.municipio_ibge": String(metadata.municipio_ibge ?? ""),
  }
}

const EditAddress: React.FC<EditAddressProps> = ({
  region,
  address,
  isActive = false,
}) => {
  const [removing, setRemoving] = useState(false)
  const [successState, setSuccessState] = useState(false)
  const [valoresEndereco, setValoresEndereco] = useState<
    Record<string, string>
  >(() => valoresEnderecoIniciais(address))
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction] = useActionState(updateCustomerAddress, {
    success: false,
    error: null,
  } as { success: boolean; error: string | null })

  const close = () => {
    setSuccessState(false)
    // Modal permanece montado enquanto fechado: sem isto, cancelar uma edição
    // deixaria os campos fiscais com o valor digitado, e não o salvo.
    setValoresEndereco(valoresEnderecoIniciais(address))
    closeModal()
  }

  useEffect(() => {
    if (successState) {
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successState])

  useEffect(() => {
    if (formState.success) {
      setSuccessState(true)
    }
  }, [formState])

  const removeAddress = async () => {
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
  }

  return (
    <>
      <div
        className={clx(
          "border rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between transition-colors",
          {
            "border-gray-900": isActive,
          }
        )}
        data-testid="address-container"
      >
        <div className="flex flex-col">
          <Heading
            className="text-left text-base-semi"
            data-testid="address-name"
          >
            {address.first_name} {address.last_name}
          </Heading>
          {address.company && (
            <Text
              className="txt-compact-small text-ui-fg-base"
              data-testid="address-company"
            >
              {address.company}
            </Text>
          )}
          <Text className="flex flex-col text-left text-base-regular mt-2">
            <span data-testid="address-address">
              {address.address_1}
              {address.address_2 && <span>, {address.address_2}</span>}
            </span>
            <span data-testid="address-postal-city">
              {address.postal_code}, {address.city}
            </span>
            <span data-testid="address-province-country">
              {address.province && `${address.province}, `}
              {address.country_code?.toUpperCase()}
            </span>
          </Text>
        </div>
        <div className="flex items-center gap-x-4">
          <button
            className="text-small-regular text-ui-fg-base flex items-center gap-x-2"
            onClick={open}
            data-testid="address-edit-button"
          >
            <Edit />
            Edit
          </button>
          <button
            className="text-small-regular text-ui-fg-base flex items-center gap-x-2"
            onClick={removeAddress}
            data-testid="address-delete-button"
          >
            {removing ? <Spinner /> : <Trash />}
            Remove
          </button>
        </div>
      </div>

      <Modal isOpen={state} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <Heading className="mb-2">Editar endereço</Heading>
        </Modal.Title>
        <form action={formAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <Modal.Body>
            <div className="grid grid-cols-1 gap-y-2">
              <div className="grid grid-cols-2 gap-x-2">
                <Input
                  label="Nome"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  defaultValue={address.first_name || undefined}
                  data-testid="first-name-input"
                />
                <Input
                  label="Sobrenome"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={address.last_name || undefined}
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label="Empresa"
                name="company"
                autoComplete="organization"
                defaultValue={address.company || undefined}
                data-testid="company-input"
              />
              <AddressFields
                prefixo=""
                valores={valoresEndereco}
                onChange={(campo, valor) =>
                  setValoresEndereco((p) => ({ ...p, [campo]: valor }))
                }
                region={region}
              />
              <Input
                label="Telefone"
                name="phone"
                autoComplete="phone"
                defaultValue={address.phone || undefined}
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <div className="text-rose-500 text-small-regular py-2">
                {formState.error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-3 mt-6">
              <Button
                type="reset"
                variant="secondary"
                onClick={close}
                className="h-10"
                data-testid="cancel-button"
              >
                Cancel
              </Button>
              <SubmitButton data-testid="save-button">Salvar</SubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default EditAddress
