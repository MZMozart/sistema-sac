'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Search, Shield, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { db, firebaseConfig } from '@/lib/firebase'

type EmployeeRecord = {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  role: 'owner' | 'manager' | 'employee'
  isActive: boolean
  permissions?: any
  workSchedule?: { enabled: boolean; days: number[]; start: string; end: string }
  totalChats?: number
  totalCalls?: number
  averageRating?: number
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: 'employee' as EmployeeRecord['role'],
  temporaryPassword: '',
  permissions: {
    canManageEmployees: false,
    canEditCompanySettings: false,
    canEditBotPolicies: false,
    canExportData: false,
    canViewRatings: false,
    canManageIntegrations: false,
    canManagePermissions: false,
  },
  workSchedule: {
    enabled: true,
    days: [1, 2, 3, 4, 5],
    start: '08:00',
    end: '18:00',
  },
}

function defaultPermissionsForRole(role: EmployeeRecord['role']) {
  return {
    canManageEmployees: role === 'manager',
    canEditCompanySettings: role === 'manager',
    canEditBotPolicies: role === 'manager',
    canExportData: role === 'manager',
    canViewRatings: role === 'manager',
    canManageIntegrations: role === 'manager',
    canManagePermissions: false,
  }
}

const permissionOptions = [
  { key: 'canManageEmployees', label: 'Equipe' },
  { key: 'canEditCompanySettings', label: 'Visual da empresa' },
  { key: 'canManageIntegrations', label: 'Integrações' },
  { key: 'canEditBotPolicies', label: 'Chatbot' },
  { key: 'canManagePermissions', label: 'Permissões' },
  { key: 'canExportData', label: 'Relatórios' },
  { key: 'canViewRatings', label: 'Avaliações' },
]

const daysOfWeek = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
]

export default function EmployeesPage() {
  const { user, company, loading: authLoading } = useAuth()
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (authLoading) return
    if (!company?.id) {
      setEmployees([])
      setLoading(false)
      return
    }

    setLoading(true)

    const employeesQuery = query(collection(db, 'employees'), where('companyId', '==', company.id))
    const unsubscribe = onSnapshot(
      employeesQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as EmployeeRecord))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

        setEmployees(rows)
        setLoading(false)
      },
      () => {
        toast.error('Não foi possível carregar os funcionários.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [authLoading, company?.id])

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        [employee.name, employee.email, employee.phone].join(' ').toLowerCase().includes(search.toLowerCase())
      ),
    [employees, search]
  )

  const resetDialog = () => {
    setEditingEmployee(null)
    setForm(emptyForm)
    setDialogOpen(false)
  }

  const parseApiResponse = async (response: Response) => {
    const text = await response.text()
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return { error: text || 'unexpected-non-json-response' }
    }
  }

  const saveEmployee = async () => {
    if (!user || !company?.id) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em instantes.')
      return
    }

    setSaving(true)
    try {
      const isEditing = Boolean(editingEmployee)
      const now = new Date().toISOString()

      if (isEditing && editingEmployee) {
        await Promise.all([
          updateDoc(doc(db, 'employees', editingEmployee.id), {
            name: form.name,
            phone: form.phone || '',
            role: form.role,
            permissions: form.permissions,
            workSchedule: form.workSchedule,
          }),
          updateDoc(doc(db, 'users', editingEmployee.userId), {
            name: form.name,
            fullName: form.name,
            phone: form.phone || '',
            role: form.role,
          }),
        ])
      } else {
        const secondaryApp = initializeApp(firebaseConfig, `employee-${Date.now()}`)
        let data: { uid: string; phone: string }

        try {
          const secondaryAuth = getAuth(secondaryApp)
          const created = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.temporaryPassword)
          await updateProfile(created.user, { displayName: form.name })
          data = { uid: created.user.uid, phone: form.phone || '' }
        } catch (error: any) {
          const code = String(error?.code || '')
          if (code.includes('email-already-in-use')) {
            throw new Error('Já existe outra conta usando este e-mail.')
          }
          if (code.includes('weak-password')) {
            throw new Error('A senha temporária precisa ser mais forte.')
          }
          throw new Error('Não foi possível criar a conta do funcionário no Firebase Auth.')
        } finally {
          await deleteApp(secondaryApp)
        }

        const employeeId = `${company.id}_${data.uid}`
        const basePermissions = {
          canViewDashboard: form.role !== 'employee',
          canViewAllChats: true,
          canViewAllCalls: true,
          canDeleteCompany: false,
          ...defaultPermissionsForRole(form.role),
          ...form.permissions,
        }

        await Promise.all([
          setDoc(doc(db, 'users', data.uid), {
            uid: data.uid,
            name: form.name,
            fullName: form.name,
            email: form.email,
            phone: data.phone || form.phone || '',
            accountType: 'pj',
            role: form.role,
            companyId: company.id,
            createdAt: now,
            emailVerified: false,
            phoneVerified: false,
            createdBy: user.uid,
            isEmployeeAccount: true,
          }),
          setDoc(doc(db, 'employees', employeeId), {
            id: employeeId,
            companyId: company.id,
            userId: data.uid,
            ownerId: user.uid,
            name: form.name,
            email: form.email,
            phone: data.phone || form.phone || '',
            role: form.role,
            isActive: true,
            permissions: basePermissions,
            workSchedule: form.workSchedule,
            tempAccessApprovedUntil: null,
            createdAt: now,
            totalChats: 0,
            totalCalls: 0,
            averageRating: 0,
            totalRatings: 0,
            inactivityCount: 0,
          }),
          addDoc(collection(db, 'logs'), {
            companyId: company.id,
            employeeId,
            actorUserId: user.uid,
            action: 'employee_created',
            details: { name: form.name, email: form.email, role: form.role, permissions: form.permissions, workSchedule: form.workSchedule },
            createdAt: now,
          }),
          addDoc(collection(db, 'notifications'), {
            recipientCompanyId: company.id,
            recipientUserId: data.uid,
            title: 'Novo funcionário cadastrado',
            body: `${form.name} foi adicionado à operação com o papel ${form.role}.`,
            type: 'system',
            actionUrl: '/dashboard/employees',
            entityId: employeeId,
            entityType: 'profile',
            actorName: form.name,
            readAt: null,
            createdAt: now,
          }),
        ])
      }

      toast.success(isEditing ? 'Funcionário atualizado.' : 'Funcionário criado com sucesso.')
      if (!isEditing) {
        toast.success(`Senha temporária criada: ${form.temporaryPassword}`)
      }
      resetDialog()
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar funcionário.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (employee: EmployeeRecord) => {
    if (!user || !company?.id) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em instantes.')
      return
    }

    try {
      const token = await user.getIdToken(true)
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !employee.isActive }),
      })
      const data = await parseApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'toggle-failed')
    } catch {
      toast.error('Não foi possível alterar o status do funcionário.')
    }
  }

  const deleteEmployee = async (employeeId: string) => {
    if (!user || !company?.id) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em instantes.')
      return
    }

    try {
      const token = await user.getIdToken(true)
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await parseApiResponse(response)
      if (!response.ok) throw new Error(data.error || 'delete-failed')
      toast.success('Funcionário removido e conta desativada.')
    } catch {
      toast.error('Não foi possível excluir o funcionário.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funcionários</h1>
          <p className="mt-2 text-sm text-muted-foreground">Convide, edite, ative ou remova funcionários reais da sua empresa.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button
            className="bg-gradient-primary"
            data-testid="employees-open-create-dialog"
            onClick={() => {
              setEditingEmployee(null)
              setForm(emptyForm)
              setDialogOpen(true)
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Novo funcionário
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Editar funcionário' : 'Criar funcionário'}</DialogTitle>
                <DialogDescription>
                  Defina cargo, permissões e horário de trabalho da conta operacional.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} data-testid="employees-form-name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} disabled={Boolean(editingEmployee)} data-testid="employees-form-email" />
              </div>
              <div className="space-y-2">
                <Label>Telefone (opcional)</Label>
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} data-testid="employees-form-phone" />
                <p className="text-xs text-muted-foreground">Se o telefone já estiver em uso em outra conta do Firebase, use outro número ou deixe este campo vazio.</p>
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={form.role} onValueChange={(value) => setForm((current) => ({ ...current, role: value as EmployeeRecord['role'], permissions: { ...defaultPermissionsForRole(value as EmployeeRecord['role']), ...current.permissions } }))}>
                  <SelectTrigger data-testid="employees-form-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editingEmployee ? (
                <div className="space-y-2">
                  <Label>Senha temporária</Label>
                  <Input type="text" value={form.temporaryPassword} onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))} data-testid="employees-form-password" />
                </div>
              ) : null}
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Horário de trabalho</p>
                    <p className="text-xs text-muted-foreground">Fora deste horário o acesso pode ser bloqueado.</p>
                  </div>
                  <Switch checked={form.workSchedule.enabled} onCheckedChange={(checked) => setForm((current: any) => ({ ...current, workSchedule: { ...current.workSchedule, enabled: checked } }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="time" value={form.workSchedule.start} onChange={(event) => setForm((current: any) => ({ ...current, workSchedule: { ...current.workSchedule, start: event.target.value } }))} data-testid="employees-work-start" />
                  <Input type="time" value={form.workSchedule.end} onChange={(event) => setForm((current: any) => ({ ...current, workSchedule: { ...current.workSchedule, end: event.target.value } }))} data-testid="employees-work-end" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <Button key={day.value} type="button" variant={form.workSchedule.days.includes(day.value) ? 'default' : 'outline'} onClick={() => setForm((current: any) => ({ ...current, workSchedule: { ...current.workSchedule, days: current.workSchedule.days.includes(day.value) ? current.workSchedule.days.filter((item: number) => item !== day.value) : [...current.workSchedule.days, day.value] } }))}>
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Permissões específicas</p>
                  <p className="text-xs text-muted-foreground">A empresa define o que aparece e o que pode ser alterado.</p>
                </div>
                {permissionOptions.map((permission) => (
                  <div key={permission.key} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                    <span className="text-sm">{permission.label}</span>
                    <Switch checked={Boolean((form.permissions as Record<string, boolean>)[permission.key])} onCheckedChange={(checked) => setForm((current: any) => ({ ...current, permissions: { ...current.permissions, [permission.key]: checked } }))} data-testid={`employees-permission-${permission.key}`} />
                  </div>
                ))}
              </div>
              <Button onClick={saveEmployee} disabled={saving} className="w-full" data-testid="employees-save-button">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingEmployee ? 'Salvar alterações' : 'Criar conta do funcionário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle>Equipe conectada</CardTitle>
          <CardDescription>Todos os registros abaixo vêm do Firebase e das métricas reais acumuladas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder="Buscar por nome, email ou telefone" data-testid="employees-search-input" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum funcionário cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-card/60 p-4 lg:flex-row lg:items-center lg:justify-between" data-testid={`employee-row-${employee.id}`}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-primary text-white">{employee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{employee.name}</p>
                        <Badge variant={employee.role === 'manager' ? 'default' : 'outline'}>{employee.role === 'manager' ? 'Gerente' : employee.role === 'owner' ? 'Dono' : 'Funcionário'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                      <p className="text-xs text-muted-foreground">{employee.phone || 'Sem telefone'}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 lg:w-[380px]">
                    <div className="rounded-2xl bg-secondary/60 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Chats</p>
                      <p className="font-bold">{employee.totalChats || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-secondary/60 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Ligações</p>
                      <p className="font-bold">{employee.totalCalls || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-secondary/60 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Nota</p>
                      <p className="font-bold">{(employee.averageRating || 0).toFixed(1)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm">Ativo</span>
                      <Switch checked={employee.isActive} onCheckedChange={() => toggleActive(employee)} data-testid={`employee-toggle-${employee.id}`} />
                    </div>
                    {employee.role !== 'owner' ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingEmployee(employee)
                            setForm({
                              name: employee.name,
                              email: employee.email,
                              phone: employee.phone,
                              role: employee.role,
                              temporaryPassword: '',
                              permissions: employee.permissions || emptyForm.permissions,
                              workSchedule: employee.workSchedule || emptyForm.workSchedule,
                            })
                            setDialogOpen(true)
                          }}
                          data-testid={`employee-edit-${employee.id}`}
                        >
                          Editar
                        </Button>
                        <Button variant="destructive" onClick={() => deleteEmployee(employee.id)} data-testid={`employee-delete-${employee.id}`}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}