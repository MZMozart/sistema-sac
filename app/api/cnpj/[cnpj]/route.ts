import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  const { cnpj } = await params
  
  // Remove caracteres especiais do CNPJ
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '')

  if (cleanCNPJ.length !== 14) {
    return NextResponse.json(
      { error: 'CNPJ inválido' },
      { status: 400 }
    )
  }

  try {
    // Usando API pública ReceitaWS
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCNPJ}`, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Erro ao consultar CNPJ')
    }

    const data = await response.json()

    if (data.status === 'ERROR') {
      return NextResponse.json(
        { error: data.message || 'CNPJ não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      cnpj: data.cnpj,
      nome: data.nome,
      fantasia: data.fantasia,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      municipio: data.municipio,
      uf: data.uf,
      cep: data.cep,
      telefone: data.telefone,
      email: data.email,
      situacao: data.situacao,
      data_situacao: data.data_situacao,
      atividade_principal: data.atividade_principal,
    })
  } catch (error) {
    console.error('Error fetching CNPJ:', error)
    return NextResponse.json(
      { error: 'Erro ao consultar CNPJ. Tente novamente.' },
      { status: 500 }
    )
  }
}
