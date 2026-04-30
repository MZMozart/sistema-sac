'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

type DeleteAccountCardProps = {
  title: string
  description: string
  testIdPrefix: string
}

async function parseResponse(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: text || 'unexpected-non-json-response' }
  }
}

export function DeleteAccountCard({ title, description, testIdPrefix }: DeleteAccountCardProps) {
  const router = useRouter()
  const { user, userData, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!user) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em instantes.')
      return
    }

    setLoading(true)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation }),
      })
      const data = await parseResponse(response)
      if (!response.ok) {
        throw new Error(data.error === 'invalid-confirmation' ? 'Digite APAGAR para confirmar a exclusão.' : data.error || 'account-delete-failed')
      }

      toast.success(userData?.accountType === 'pj' && userData?.role === 'owner' ? 'Empresa e conta removidas com sucesso.' : 'Conta removida com sucesso.')
      try {
        await signOut()
      } catch {
        // ignore signout errors after server-side deletion
      }
      router.push('/auth/login')
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível apagar sua conta agora.')
    } finally {
      setLoading(false)
      setOpen(false)
      setConfirmation('')
    }
  }

  return (
    <>
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)} data-testid={`${testIdPrefix}-open-button`}>
            Apagar conta da plataforma
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid={`${testIdPrefix}-dialog`}>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão permanente</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Digite <strong>APAGAR</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
              {userData?.accountType === 'pj' && userData?.role === 'owner'
                ? 'Ao confirmar, a empresa, a assinatura e os dados operacionais vinculados serão removidos.'
                : 'Ao confirmar, seu acesso e os dados principais da sua conta serão removidos da plataforma.'}
            </div>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value.toUpperCase().slice(0, 6))}
              placeholder="Digite APAGAR"
              data-testid={`${testIdPrefix}-confirm-input`}
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirmation !== 'APAGAR'}
              data-testid={`${testIdPrefix}-confirm-button`}
            >
              {loading ? 'Apagando...' : 'Confirmar exclusão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}