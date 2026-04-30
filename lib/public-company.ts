export function isPublicCompany(company: any) {
  const hasIdentity = Boolean(company?.ownerId) && Boolean(company?.nomeFantasia || company?.razaoSocial)
  const isActive = company?.isActive !== false
  const isVisible = company?.status !== 'inactive'
  return hasIdentity && isActive && isVisible
}