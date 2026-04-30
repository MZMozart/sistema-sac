import { NextResponse } from 'next/server'

// Validação de CPF
function isValidCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/[^\d]/g, '')
  
  if (cleanCPF.length !== 11) return false
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleanCPF)) return false
  
  // Validação do primeiro dígito
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i)
  }
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== parseInt(cleanCPF[9])) return false
  
  // Validação do segundo dígito
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i)
  }
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== parseInt(cleanCPF[10])) return false
  
  return true
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cpf: string }> }
) {
  const { cpf } = await params
  
  // Remove caracteres especiais do CPF
  const cleanCPF = cpf.replace(/[^\d]/g, '')

  if (!isValidCPF(cleanCPF)) {
    return NextResponse.json(
      { error: 'CPF inválido', valid: false },
      { status: 400 }
    )
  }

  // CPF válido - não temos API pública gratuita para consulta de dados
  // Retornamos apenas a validação
  return NextResponse.json({
    cpf: cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
    valid: true,
    message: 'CPF válido',
  })
}
