import { NextRequest, NextResponse } from 'next/server'

function normalizeCnpj(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

export async function GET(request: NextRequest) {
  const cnpj = normalizeCnpj(request.nextUrl.searchParams.get('cnpj'))

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'invalid-cnpj' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data?.message || 'cnpj-lookup-failed' }, { status: response.status })
    }

    return NextResponse.json({
      cnpj: data.cnpj || cnpj,
      razaoSocial: data.razao_social || '',
      nomeFantasia: data.nome_fantasia || '',
      email: data.email || '',
      phone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
      cep: data.cep || '',
      address: [data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(', '),
      segmento: data.cnae_fiscal_descricao || '',
    })
  } catch {
    return NextResponse.json({ error: 'cnpj-lookup-failed' }, { status: 500 })
  }
}