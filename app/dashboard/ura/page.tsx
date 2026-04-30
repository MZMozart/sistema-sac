'use client'

import { useMemo, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UraItem = {
  digit: string
  label: string
  queue: string
}

export default function URAPage() {
  const { company } = useAuth()
  const [items, setItems] = useState<UraItem[]>(
    company?.uraOptions?.length
      ? company.uraOptions.map((item) => ({ digit: item.digit, label: item.label, queue: item.routeTo || item.departmentId || 'fila-geral' }))
      : [
          { digit: '1', label: 'Financeiro', queue: 'financeiro' },
          { digit: '2', label: 'Suporte', queue: 'suporte' },
          { digit: '3', label: 'Comercial', queue: 'comercial' },
        ]
  )
  const [saving, setSaving] = useState(false)

  const scriptPreview = useMemo(
    () => items.map((item) => `Digite ${item.digit} para ${item.label.toLowerCase()}.`).join(' '),
    [items]
  )

  const updateItem = (index: number, field: keyof UraItem, value: string) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const saveUra = async () => {
    if (!company) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'companies', company.id), {
        uraOptions: items.map((item) => ({ digit: item.digit, label: item.label, routeTo: item.queue })),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="ura-heading">Configuração de URA</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Estruture os atalhos de voz, filas e destinos para encaminhamento inteligente das ligações.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Árvore de opções</CardTitle>
                <CardDescription>Defina os dígitos disponíveis para o cliente.</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setItems((current) => [...current, { digit: String(current.length + 1), label: 'Nova opção', queue: 'nova-fila' }])}
                data-testid="ura-add-option-button"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar opção
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={`${item.digit}-${index}`} className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 md:grid-cols-[90px_1fr_1fr_auto]" data-testid={`ura-option-${index}`}>
                <div className="space-y-2">
                  <Label>Dígito</Label>
                  <Input value={item.digit} onChange={(event) => updateItem(index, 'digit', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rótulo</Label>
                  <Input value={item.label} onChange={(event) => updateItem(index, 'label', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fila / destino</Label>
                  <Input value={item.queue} onChange={(event) => updateItem(index, 'queue', event.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} data-testid={`ura-remove-option-${index}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button onClick={saveUra} disabled={saving} data-testid="ura-save-button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar URA'}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-border/80">
          <CardHeader>
            <CardTitle>Preview da fala</CardTitle>
            <CardDescription>Texto base que pode ser usado no script de voz da empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 text-sm leading-7 text-foreground" data-testid="ura-preview-text">
              Bem-vindo à central de atendimento. {scriptPreview}
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
              Dica: combine esta URA com o roteamento de menor fila e as permissões por equipe para distribuir melhor os atendimentos.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
