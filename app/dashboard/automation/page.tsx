'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Zap,
  Plus,
  Settings,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: 'message' | 'time' | 'event'
  action: 'reply' | 'transfer' | 'notify' | 'tag'
  isActive: boolean
  conditions: string[]
  lastExecuted?: Date
  executions: number
}

const mockRules: AutomationRule[] = [
  {
    id: '1',
    name: 'Boas-vindas automática',
    description: 'Envia mensagem de boas-vindas quando um novo chat é iniciado',
    trigger: 'message',
    action: 'reply',
    isActive: true,
    conditions: ['Novo chat iniciado'],
    lastExecuted: new Date(Date.now() - 2 * 60 * 60 * 1000),
    executions: 145,
  },
  {
    id: '2',
    name: 'Transferência para especialista',
    description: 'Transfere chats com palavras-chave técnicas para atendentes especializados',
    trigger: 'message',
    action: 'transfer',
    isActive: true,
    conditions: ['Contém: técnico, sistema, erro, bug'],
    lastExecuted: new Date(Date.now() - 4 * 60 * 60 * 1000),
    executions: 23,
  },
  {
    id: '3',
    name: 'Notificação de horário comercial',
    description: 'Notifica quando mensagens chegam fora do horário comercial',
    trigger: 'time',
    action: 'notify',
    isActive: false,
    conditions: ['Fora do expediente'],
    executions: 67,
  },
]

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>(mockRules)
  const [selectedTab, setSelectedTab] = useState('rules')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const toggleRule = (ruleId: string) => {
    setRules(rules.map(rule =>
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ))
  }

  const deleteRule = (ruleId: string) => {
    setRules(rules.filter(rule => rule.id !== ruleId))
  }

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'message': return MessageSquare
      case 'time': return Clock
      case 'event': return Zap
      default: return Zap
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'reply': return Bot
      case 'transfer': return Settings
      case 'notify': return Mail
      case 'tag': return CheckCircle2
      default: return Settings
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 md:ml-20 lg:ml-64 pt-14 lg:pt-16 p-3 lg:p-6 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold truncate">Automação</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">
              Configure regras automáticas para otimizar o atendimento
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova Regra</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Nova Regra de Automação</DialogTitle>
                <DialogDescription>
                  Configure uma nova regra para automatizar ações no sistema de atendimento.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rule-name">Nome da Regra</Label>
                    <Input id="rule-name" placeholder="Ex: Boas-vindas automática" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-trigger">Gatilho</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o gatilho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="message">Nova mensagem</SelectItem>
                        <SelectItem value="time">Horário específico</SelectItem>
                        <SelectItem value="event">Evento do sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-description">Descrição</Label>
                  <Textarea
                    id="rule-description"
                    placeholder="Descreva o que esta regra faz..."
                    className="min-h-[80px]"
                  />
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rule-action">Ação</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a ação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reply">Responder automaticamente</SelectItem>
                        <SelectItem value="transfer">Transferir atendimento</SelectItem>
                        <SelectItem value="notify">Enviar notificação</SelectItem>
                        <SelectItem value="tag">Adicionar tag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-conditions">Condições</Label>
                    <Input
                      id="rule-conditions"
                      placeholder="Ex: Contém: obrigado, ajuda"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto">
                  Criar Regra
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4 lg:space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rules" className="text-xs sm:text-sm">Regras</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-4 lg:space-y-6">
            <div className="grid gap-4 lg:gap-6">
              {rules.map((rule) => {
                const TriggerIcon = getTriggerIcon(rule.trigger)
                const ActionIcon = getActionIcon(rule.action)

                return (
                  <Card key={rule.id} className="border-border">
                    <CardHeader className="pb-3 lg:pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-base lg:text-lg truncate">{rule.name}</CardTitle>
                            <Badge variant={rule.isActive ? 'default' : 'secondary'} className="text-xs">
                              {rule.isActive ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <CardDescription className="text-sm">{rule.description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => toggleRule(rule.id)}
                          />
                          <Button variant="ghost" size="icon" className="w-8 h-8">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-destructive hover:text-destructive"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-2">
                          <TriggerIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Gatilho:</span>
                          <span className="text-sm font-medium capitalize">{rule.trigger}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ActionIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Ação:</span>
                          <span className="text-sm font-medium capitalize">{rule.action}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Execuções:</span>
                          <span className="text-sm font-medium">{rule.executions}</span>
                        </div>
                        {rule.lastExecuted && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Última:</span>
                            <span className="text-sm font-medium">
                              {rule.lastExecuted.toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">Condições:</p>
                        <div className="flex flex-wrap gap-2">
                          {rule.conditions.map((condition, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 lg:space-y-6">
            <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base lg:text-lg">Execuções por Regra</CardTitle>
                  <CardDescription>Quantidade de vezes que cada regra foi executada</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {rules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">{rule.executions} execuções</p>
                        </div>
                        <div className="w-24 bg-secondary rounded-full h-2 ml-4">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(rule.executions / Math.max(...rules.map(r => r.executions))) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base lg:text-lg">Status das Regras</CardTitle>
                  <CardDescription>Regras ativas vs inativas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Regras Ativas</span>
                      </div>
                      <span className="text-sm font-medium">{rules.filter(r => r.isActive).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Pause className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Regras Inativas</span>
                      </div>
                      <span className="text-sm font-medium">{rules.filter(r => !r.isActive).length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 lg:space-y-6">
            <div className="grid gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Boas-vindas
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Template para mensagem de boas-vindas automática
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Usar Template
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Horário Comercial
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Resposta automática fora do expediente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Usar Template
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Suporte Técnico
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Transferência automática para suporte técnico
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Usar Template
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
