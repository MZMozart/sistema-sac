export const DEFAULT_SECTOR_ID = 'general'
export const DEFAULT_SECTOR_NAME = 'Geral'

export type SectorRecord = {
  id: string
  nome: string
  empresa_id?: string
  companyId?: string
  ativo?: boolean
  created_at?: any
  updated_at?: any
}

export function normalizeSectorId(value?: string | null) {
  const clean = String(value || '').trim()
  return clean || DEFAULT_SECTOR_ID
}

export function normalizeSectorName(value?: string | null) {
  const clean = String(value || '').trim()
  return clean || DEFAULT_SECTOR_NAME
}

export function normalizeSectorKey(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function inferSectorFromText(...values: Array<string | null | undefined>) {
  const key = normalizeSectorKey(values.filter(Boolean).join(' '))
  if (!key) return null

  if (/(financeiro|boleto|pagamento|cobranca|parcela|segundavia)/.test(key)) {
    return { sectorId: 'financeiro', sectorName: 'Financeiro' }
  }

  if (/(imoveis|imovel|locacao|aluguel|venda|visita|proposta|documentacao)/.test(key)) {
    return { sectorId: 'imoveis', sectorName: 'Imoveis' }
  }

  if (/(geral|padrao|atendimentogeral|suporte)/.test(key)) {
    return { sectorId: DEFAULT_SECTOR_ID, sectorName: DEFAULT_SECTOR_NAME }
  }

  return null
}

export function sectorMatches(
  session: { id?: string | null; name?: string | null },
  employee: { id?: string | null; name?: string | null }
) {
  const sessionId = normalizeSectorId(session.id)
  const employeeId = normalizeSectorId(employee.id)
  const sessionNameKey = normalizeSectorKey(session.name)
  const employeeNameKey = normalizeSectorKey(employee.name)
  const defaultNameKey = normalizeSectorKey(DEFAULT_SECTOR_NAME)
  const sessionHasSpecificName = Boolean(sessionNameKey && sessionNameKey !== defaultNameKey)

  if (sessionHasSpecificName) {
    return sessionNameKey === employeeNameKey || (sessionId !== DEFAULT_SECTOR_ID && sessionId === employeeId)
  }

  return sessionId === employeeId
}

export function getSectorOptionLabel(sectorId?: string | null, sectorName?: string | null) {
  const id = normalizeSectorId(sectorId)
  if (id === DEFAULT_SECTOR_ID) return DEFAULT_SECTOR_NAME
  return normalizeSectorName(sectorName)
}

export function buildSectorOptions(rawSectors: SectorRecord[] = []) {
  const activeSectors = rawSectors
    .filter((sector) => sector.ativo !== false)
    .map((sector) => ({
      id: sector.id,
      nome: normalizeSectorName(sector.nome),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return [{ id: DEFAULT_SECTOR_ID, nome: DEFAULT_SECTOR_NAME }, ...activeSectors]
}
