'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isPublicCompany } from '@/lib/public-company'
import { Input } from '@/components/ui/input'
import { Building2, Loader2, MapPin, Search, Star } from 'lucide-react'

export default function NewTicketPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'companies'))
        const rows = snapshot.docs
          .map((item: any) => ({ id: item.id, ...item.data() }))
          .filter((item: any) => isPublicCompany(item))
          .sort((a: any, b: any) => String(a.nomeFantasia || a.razaoSocial || '').localeCompare(String(b.nomeFantasia || b.razaoSocial || '')))
        setCompanies(rows)
      } finally {
        setLoadingCompanies(false)
      }
    }

    loadCompanies()
  }, [])

  const filteredCompanies = useMemo(() => {
    const text = companySearch.trim().toLowerCase()
    if (!text) return companies
    return companies.filter((company) =>
      `${company.nomeFantasia || ''} ${company.razaoSocial || ''} ${company.segmento || ''} ${company.city || ''} ${company.state || ''}`.toLowerCase().includes(text)
    )
  }, [companies, companySearch])

  if (loadingCompanies) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="client-new-ticket-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empresas disponíveis</h1>
          <p className="mt-2 text-sm text-muted-foreground">Escolha uma empresa para ver a página pública e iniciar contato por chat ou ligação.</p>
        </div>
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={companySearch}
            onChange={(event) => setCompanySearch(event.target.value)}
            placeholder="Pesquisar empresa por nome, setor ou cidade"
            className="h-12 pl-11"
            data-testid="client-new-ticket-company-search-input"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCompanies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhuma empresa pública encontrada.
          </div>
        ) : filteredCompanies.map((company) => (
          <Link
            key={company.id}
            href={`/empresa/${company.id}`}
            className="rounded-3xl border border-border bg-card/70 p-5 text-left transition hover:border-primary/70 hover:shadow-[0_20px_60px_-35px_rgba(37,99,235,0.9)]"
            data-testid={`client-company-showcase-card-${company.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{company.nomeFantasia || company.razaoSocial || 'Empresa'}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{company.segmento || 'Atendimento geral'}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{[company.city, company.state].filter(Boolean).join(' - ') || company.address || 'Atendimento online'}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-primary" />
              <span>{Number(company.avaliacaoMedia || company.rating || 0).toFixed(1)} de avaliação</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
