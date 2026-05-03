export type CepAddress = {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
}

export function normalizeCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function composeAddress(values: {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}) {
  return [
    [values.street, values.number].filter(Boolean).join(', '),
    values.complement,
    values.neighborhood,
    [values.city, values.state].filter(Boolean).join(' - '),
  ].filter(Boolean).join(' - ')
}

export async function lookupCepAddress(cepValue: string): Promise<CepAddress> {
  const cep = normalizeCep(cepValue)
  if (cep.length !== 8) {
    throw new Error('invalid-cep')
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  const data = await response.json()
  if (!response.ok || data?.erro) {
    throw new Error('cep-not-found')
  }

  return {
    cep,
    street: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
  }
}
