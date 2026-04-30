import type { CNPJData } from '@/lib/types'

export class CNPJService {
  /**
   * Busca dados do CNPJ usando a API ReceitaWS
   */
  static async fetchCNPJ(cnpj: string): Promise<CNPJData> {
    // Remove caracteres especiais
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '')

    if (cleanCNPJ.length !== 14) {
      throw new Error('CNPJ deve ter 14 dígitos')
    }

    try {
      // Usar nossa própria API route para evitar problemas de CORS
      const response = await fetch(`/api/cnpj/${cleanCNPJ}`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao consultar CNPJ')
      }

      const data = await response.json()

      return {
        cnpj: data.cnpj,
        nome: data.nome,
        fantasia: data.fantasia,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || '',
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep,
        telefone: data.telefone || '',
        email: data.email || '',
        situacao: data.situacao,
        data_situacao: data.data_situacao,
        atividade_principal: data.atividade_principal || [],
      }
    } catch (error) {
      console.error('Error fetching CNPJ:', error)
      throw error
    }
  }

  /**
   * Valida formato do CNPJ
   */
  static isValidFormat(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '')
    return cleanCNPJ.length === 14
  }

  /**
   * Formata CNPJ para exibição
   */
  static formatCNPJ(cnpj: string): string {
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '')
    return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
}