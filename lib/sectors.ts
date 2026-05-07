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
