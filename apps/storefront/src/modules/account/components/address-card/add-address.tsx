"use client"

import { Plus } from "@medusajs/icons"
import { Button, Heading } from "@modules/common/components/ui"
import { useActionState, useEffect, useState } from "react"

import { addCustomerAddress } from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { HttpTypes } from "@medusajs/types"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import AddressFields from "@modules/common/components/address-fields"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"

// Estado inicial dos campos de endereço (sem prefixo: formulário da conta).
const camposEnderecoVazios: Record<string, string> = {
  address_1: "",
  address_2: "",
  postal_code: "",
  city: "",
  province: "",
  country_code: "",
  "metadata.numero": "",
  "metadata.bairro": "",
  "metadata.municipio_ibge": "",
}

const AddAddress = ({
  region,
  addresses: _addresses,
}: {
  region: HttpTypes.StoreRegion
  addresses: HttpTypes.StoreCustomerAddress[]
}) => {
  const [successState, setSuccessState] = useState(false)
  const [valoresEndereco, setValoresEndereco] = useState<
    Record<string, string>
  >(camposEnderecoVazios)
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction] = useActionState(addCustomerAddress, {
    success: false,
    error: null,
  } as { success: boolean; error: string | null })

  const close = () => {
    setSuccessState(false)
    // Modal permanece montado enquanto fechado: sem isto, os campos fiscais
    // ficariam com o valor digitado na tentativa anterior ao reabrir.
    setValoresEndereco(camposEnderecoVazios)
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

  return (
    <>
      <button
        className="border border-ui-border-base rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between"
        onClick={open}
        data-testid="add-address-button"
      >
        <span className="text-base-semi">Novo endereço</span>
        <Plus />
      </button>

      <Modal isOpen={state} close={close} data-testid="add-address-modal">
        <Modal.Title>
          <Heading className="mb-2">Adicionar endereço</Heading>
        </Modal.Title>
        <form action={formAction}>
          <Modal.Body>
            <div className="flex flex-col gap-y-2">
              <div className="grid grid-cols-2 gap-x-2">
                <Input
                  label="Nome"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  data-testid="first-name-input"
                />
                <Input
                  label="Sobrenome"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label="Empresa"
                name="company"
                autoComplete="organization"
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
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <div
                className="text-rose-500 text-small-regular py-2"
                data-testid="address-error"
              >
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

export default AddAddress
