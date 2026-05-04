'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { doc, updateDoc } from 'firebase/firestore'
import { AlertTriangle, Bot, CheckCircle2, Hash, Link2, MessageSquare, MousePointer2, PhoneCall, Plus, Save, Trash2, Type, Workflow, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createDefaultCallDigits, createEmptyChatButton, createEmptyChatMessage, parseCallDigits, parseChatFlow, type CallDigitAction, type CallDigitConfig, type ChatFlowButton, type ChatFlowButtonAction, type ChatFlowMessage } from '@/lib/bot-flow'
import { toast } from 'sonner'

type BotSection = 'chat' | 'call'
type VisualKind = 'chatGreeting' | 'chatButtons' | 'chatText' | 'chatLink' | 'chatAction' | 'callGreeting' | 'callDigit' | 'callMenu' | 'callText' | 'callAction'

type VisualButton = ChatFlowButton & {
  description?: string
}

type VisualCallOption = CallDigitConfig

type VisualNodeData = {
  kind: VisualKind
  title: string
  text?: string
  action?: ChatFlowButtonAction | CallDigitAction | 'repeat'
  actionLabel?: string | null
  digit?: string
  buttons?: VisualButton[]
  options?: VisualCallOption[]
  onUpdate?: (nodeId: string, patch: Partial<VisualNodeData>) => void
  onRemove?: (nodeId: string) => void
}

const nodeTypes = { visual: VisualBotNode }

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nodeTitle(kind: VisualKind) {
  const labels: Record<VisualKind, string> = {
    chatGreeting: 'Saudação',
    chatButtons: 'Botões',
    chatText: 'Texto',
    chatLink: 'Link',
    chatAction: 'Ação',
    callGreeting: 'Saudação',
    callDigit: 'Número',
    callMenu: 'Menu numérico',
    callText: 'Texto falado',
    callAction: 'Ação',
  }
  return labels[kind]
}

function nodeColor(kind: VisualKind) {
  if (kind.includes('Greeting')) return 'border-emerald-400/70 bg-emerald-500/10'
  if (kind.includes('Buttons') || kind.includes('Menu') || kind.includes('Digit')) return 'border-blue-400/70 bg-blue-500/10'
  if (kind.includes('Link')) return 'border-cyan-400/70 bg-cyan-500/10'
  if (kind.includes('Text')) return 'border-amber-400/70 bg-amber-500/10'
  return 'border-rose-400/70 bg-rose-500/10'
}

function createVisualNode(kind: VisualKind, position = { x: 120, y: 120 }): Node<VisualNodeData> {
  const id = createId(kind)
  const base = {
    id,
    type: 'visual',
    position,
    data: {
      kind,
      title: nodeTitle(kind),
    } as VisualNodeData,
  }

  if (kind === 'chatGreeting') {
    base.data.text = 'Olá, seja bem-vindo! Como posso ajudar?'
  }
  if (kind === 'chatButtons') {
    base.data.text = 'Escolha uma das opções abaixo.'
    base.data.buttons = [
      { ...createEmptyChatButton(), label: 'Financeiro' },
      { ...createEmptyChatButton(), label: 'Suporte' },
    ]
  }
  if (kind === 'chatText') {
    base.data.text = 'Mensagem informativa do BOT.'
  }
  if (kind === 'chatLink') {
    base.data.text = 'Acesse o link abaixo para continuar.'
    base.data.actionLabel = 'https://'
  }
  if (kind === 'chatAction') {
    base.data.action = 'queue'
    base.data.actionLabel = 'Falar com atendente'
  }
  if (kind === 'callGreeting') {
    base.data.text = 'Olá, bem-vindo. Digite uma das opções para continuar.'
  }
  if (kind === 'callDigit') {
    base.data.digit = '1'
    base.data.title = 'Tecla 1'
    base.data.text = 'Você escolheu a opção 1.'
    base.data.action = 'info'
    base.data.actionLabel = 'Opção 1'
  }
  if (kind === 'callMenu') {
    base.data.options = createDefaultCallDigits().map((item) => ({
      ...item,
      label: item.digit === '0' ? 'Atendente' : item.label,
      action: item.digit === '0' ? 'transfer' : 'info',
    }))
  }
  if (kind === 'callText') {
    base.data.text = 'Informação falada pelo BOT durante a ligação.'
  }
  if (kind === 'callAction') {
    base.data.action = 'transfer'
    base.data.actionLabel = 'Falar com atendente'
  }

  return base
}

function VisualBotNode({ id, data, selected }: NodeProps<Node<VisualNodeData>>) {
  const update = (patch: Partial<VisualNodeData>) => data.onUpdate?.(id, patch)
  const updateButton = (buttonId: string, patch: Partial<VisualButton>) => {
    update({ buttons: (data.buttons || []).map((button) => button.id === buttonId ? { ...button, ...patch } : button) })
  }
  const updateOption = (digit: string, patch: Partial<VisualCallOption>) => {
    update({ options: (data.options || []).map((option) => option.digit === digit ? { ...option, ...patch } : option) })
  }

  const canReceive = !data.kind.includes('Greeting')
  const hasDefaultOutput = ['chatGreeting', 'chatText', 'chatLink', 'chatAction', 'callGreeting', 'callDigit', 'callText', 'callAction'].includes(data.kind)
  const isChatAction = data.kind === 'chatAction'
  const isCallAction = data.kind === 'callAction'

  return (
    <div className={`w-[330px] rounded-xl border-2 bg-background shadow-xl ${nodeColor(data.kind)} ${selected ? 'ring-2 ring-primary' : ''}`}>
      {canReceive ? <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-background !bg-primary" /> : null}

      <div className="flex items-start justify-between gap-3 border-b border-border/70 p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{data.kind.startsWith('call') ? 'Ligação' : 'Chat'}</p>
          <Input
            value={data.title}
            onChange={(event) => update({ title: event.target.value })}
            className="nodrag mt-1 h-8 border-0 bg-transparent px-0 text-base font-bold shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="button" variant="ghost" size="icon" className="nodrag h-8 w-8" onClick={() => data.onRemove?.(id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 p-3">
        {['chatGreeting', 'chatButtons', 'chatText', 'chatLink', 'callGreeting', 'callText', 'callDigit'].includes(data.kind) ? (
          <div className="space-y-2">
            <Label>{data.kind.startsWith('call') ? 'Texto falado pelo BOT' : data.kind === 'chatLink' ? 'Mensagem antes do link' : 'Texto da mensagem'}</Label>
            <Textarea
              value={data.text || ''}
              onChange={(event) => update({ text: event.target.value })}
              maxLength={2500}
              className="nodrag min-h-[96px] resize-none text-sm"
            />
          </div>
        ) : null}

        {data.kind === 'chatLink' ? (
          <div className="space-y-2">
            <Label>URL do link</Label>
            <Input
              value={data.actionLabel || ''}
              onChange={(event) => update({ actionLabel: event.target.value })}
              className="nodrag"
              placeholder="https://site.com.br"
            />
          </div>
        ) : null}

        {data.kind === 'callDigit' ? (
          <div className="space-y-3 rounded-lg border border-border bg-card/70 p-3">
            <div className="grid grid-cols-[86px_1fr] gap-2">
              <div className="space-y-2">
                <Label>Número</Label>
                <select
                  value={data.digit || '1'}
                  onChange={(event) => update({ digit: event.target.value, title: `Tecla ${event.target.value}` })}
                  className="nodrag h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {['1','2','3','4','5','6','7','8','9','0'].map((digit) => (
                    <option key={digit} value={digit}>{digit}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>O que essa tecla representa</Label>
                <Input
                  value={data.actionLabel || ''}
                  onChange={(event) => update({ actionLabel: event.target.value })}
                  className="nodrag"
                  placeholder="Ex: Financeiro"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>O que deve acontecer</Label>
              <select
                value={String(data.action || 'info')}
                onChange={(event) => update({ action: event.target.value as any })}
                className="nodrag h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="info">Falar texto e continuar</option>
                <option value="transfer">Falar com atendente</option>
                <option value="end">Encerrar ligação</option>
                <option value="repeat">Repetir opções disponíveis</option>
                <option value="goto">Ir para outro fluxo conectado</option>
                <option value="action">Executar ação interna</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Você pode repetir o mesmo número em outros pontos do fluxo. O sistema considera o contexto atual da ligação.</p>
          </div>
        ) : null}

        {data.kind === 'chatButtons' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Botões</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="nodrag h-8"
                onClick={() => update({ buttons: [...(data.buttons || []), createEmptyChatButton()] })}
              >
                <Plus className="mr-1 h-3 w-3" />
                Botão
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="nodrag h-8"
                onClick={() => update({ buttons: [...(data.buttons || []), { ...createEmptyChatButton(), label: 'Falar com atendente', action: 'queue', actionLabel: 'Falar com atendente' }] })}
              >
                Atendente
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="nodrag h-8"
                onClick={() => update({ buttons: [...(data.buttons || []), { ...createEmptyChatButton(), label: 'Encerrar conversa', action: 'close', actionLabel: 'Encerrar conversa' }] })}
              >
                Encerrar
              </Button>
            </div>
            <div className="space-y-2">
              {(data.buttons || []).map((button) => (
                <div key={button.id} className="relative rounded-lg border border-border bg-card/70 p-2 pr-5">
                  <Input
                    value={button.label}
                    onChange={(event) => updateButton(button.id, { label: event.target.value })}
                    className="nodrag h-8 text-sm"
                    placeholder="Texto do botão"
                  />
                  <select
                    value={button.action}
                    onChange={(event) => updateButton(button.id, { action: event.target.value as ChatFlowButtonAction })}
                    className="nodrag mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="goto">Ir para outro fluxo</option>
                    <option value="queue">Falar com atendente</option>
                    <option value="close">Encerrar conversa</option>
                    <option value="action">Executar ação</option>
                  </select>
                  <button
                    type="button"
                    className="nodrag absolute right-1 top-1 rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => update({ buttons: (data.buttons || []).filter((item) => item.id !== button.id) })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <Handle id={`button:${button.id}`} type="source" position={Position.Right} className="!right-[-7px] !h-3 !w-3 !border-2 !border-background !bg-blue-500" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.kind === 'callMenu' ? (
          <div className="space-y-2">
            <Label>Opções DTMF 0-9</Label>
            <div className="grid grid-cols-2 gap-2">
              {(data.options || []).map((option) => (
                <div key={option.digit} className="relative rounded-lg border border-border bg-card/70 p-2 pr-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{option.digit}</span>
                    <Input value={option.label} onChange={(event) => updateOption(option.digit, { label: event.target.value })} className="nodrag h-8 text-xs" />
                  </div>
                  <Textarea value={option.speech} onChange={(event) => updateOption(option.digit, { speech: event.target.value })} className="nodrag min-h-[70px] resize-none text-xs" />
                  <select
                    value={option.action}
                    onChange={(event) => updateOption(option.digit, { action: event.target.value as CallDigitAction })}
                    className="nodrag mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="info">Ler informação</option>
                    <option value="transfer">Falar com atendente</option>
                    <option value="end">Encerrar ligação</option>
                    <option value="goto">Ir para outro fluxo</option>
                    <option value="action">Executar ação</option>
                  </select>
                  <Handle id={`digit:${option.digit}`} type="source" position={Position.Right} className="!right-[-7px] !h-3 !w-3 !border-2 !border-background !bg-blue-500" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isChatAction || isCallAction ? (
          <div className="space-y-2">
            <Label>Tipo de ação</Label>
            <select
              value={String(data.action || (isChatAction ? 'queue' : 'transfer'))}
              onChange={(event) => update({ action: event.target.value as any })}
              className="nodrag h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {isChatAction ? (
                <>
                  <option value="queue">Falar com atendente</option>
                  <option value="close">Encerrar conversa</option>
                  <option value="goto">Ir para outro fluxo</option>
                  <option value="action">Abrir link / ação</option>
                </>
              ) : (
                <>
                  <option value="transfer">Falar com atendente</option>
                  <option value="end">Encerrar ligação</option>
                  <option value="repeat">Repetir menu</option>
                  <option value="goto">Ir para outro fluxo</option>
                  <option value="action">Abrir link / ação</option>
                </>
              )}
            </select>
            <Input
              value={data.actionLabel || ''}
              onChange={(event) => update({ actionLabel: event.target.value })}
              className="nodrag"
              placeholder="Descrição interna da ação"
            />
          </div>
        ) : null}
      </div>

      {hasDefaultOutput ? <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-background !bg-primary" /> : null}
    </div>
  )
}

function applyNodeHandlers(nodes: Node<VisualNodeData>[], onUpdate: VisualNodeData['onUpdate'], onRemove: VisualNodeData['onRemove']) {
  return nodes.map((node) => ({ ...node, data: { ...node.data, onUpdate, onRemove } }))
}

function createDefaultChatVisualFlow(messages: ChatFlowMessage[]) {
  const baseMessages = messages.length ? messages : [createEmptyChatMessage(1)]
  const nodes: Node<VisualNodeData>[] = baseMessages.map((message, index) => ({
    id: message.id,
    type: 'visual',
    position: { x: 120 + index * 420, y: index % 2 ? 380 : 120 },
    data: {
      kind: index === 0 ? 'chatGreeting' : message.buttons.length ? 'chatButtons' : 'chatText',
      title: index === 0 ? 'Saudação' : message.title,
      text: message.text,
      buttons: index === 0 ? undefined : message.buttons,
    },
  }))
  const edges: Edge[] = []
  baseMessages.forEach((message) => {
    message.buttons.forEach((button) => {
      if (button.action === 'goto' && button.targetMessageId) {
        edges.push(createVisualEdge(message.id, button.targetMessageId, `button:${button.id}`))
      }
    })
  })
  if (nodes.length > 1 && edges.length === 0) {
    for (let index = 0; index < nodes.length - 1; index += 1) {
      edges.push(createVisualEdge(nodes[index].id, nodes[index + 1].id))
    }
  }
  return { nodes, edges }
}

function createDefaultCallVisualFlow(greeting: string, digits: CallDigitConfig[]) {
  const greetingNode: Node<VisualNodeData> = {
    id: createId('call-greeting'),
    type: 'visual',
    position: { x: 80, y: 220 },
    data: { kind: 'callGreeting', title: 'Saudação', text: greeting || 'Olá, bem-vindo. Digite uma das opções para continuar.' },
  }
  const digitNodes: Node<VisualNodeData>[] = (digits.length ? digits : createDefaultCallDigits()).map((digit, index) => ({
    id: createId(`call-digit-${digit.digit}`),
    type: 'visual',
    position: { x: 520 + (index % 2) * 380, y: 40 + Math.floor(index / 2) * 260 },
    data: {
      kind: 'callDigit',
      title: `Tecla ${digit.digit}`,
      digit: digit.digit,
      text: digit.speech,
      action: digit.action,
      actionLabel: digit.label,
    },
  }))
  return {
    nodes: [greetingNode, ...digitNodes],
    edges: digitNodes.map((node) => createVisualEdge(greetingNode.id, node.id)),
  }
}

function normalizeCallVisualFlow(flow: { nodes?: Node<VisualNodeData>[]; edges?: Edge[] }, fallbackGreeting: string, fallbackDigits: CallDigitConfig[]) {
  const rawNodes = flow.nodes || []
  const rawEdges = flow.edges || []
  const menuNode = rawNodes.find((node) => node.data.kind === 'callMenu')
  if (!menuNode) return { nodes: rawNodes, edges: rawEdges }

  const digitNodes: Node<VisualNodeData>[] = (menuNode.data.options?.length ? menuNode.data.options : fallbackDigits).map((digit, index) => ({
    id: createId(`call-digit-${digit.digit}`),
    type: 'visual',
    position: { x: menuNode.position.x + (index % 2) * 380, y: menuNode.position.y + Math.floor(index / 2) * 250 },
    data: {
      kind: 'callDigit',
      title: `Tecla ${digit.digit}`,
      digit: digit.digit,
      text: digit.speech,
      action: digit.action,
      actionLabel: digit.label,
    },
  }))
  const incomingEdges = rawEdges.filter((edge) => edge.target === menuNode.id)
  const convertedIncoming = incomingEdges.flatMap((edge) => digitNodes.map((digitNode) => createVisualEdge(edge.source, digitNode.id, edge.sourceHandle)))
  const keptNodes = rawNodes.filter((node) => node.id !== menuNode.id)
  const keptEdges = rawEdges.filter((edge) => edge.source !== menuNode.id && edge.target !== menuNode.id)
  if (!keptNodes.some((node) => node.data.kind === 'callGreeting')) {
    const defaultFlow = createDefaultCallVisualFlow(fallbackGreeting, fallbackDigits)
    return defaultFlow
  }
  return { nodes: [...keptNodes, ...digitNodes], edges: [...keptEdges, ...convertedIncoming] }
}

function createVisualEdge(source: string, target: string, sourceHandle?: string | null): Edge {
  return {
    id: createId('edge'),
    source,
    target,
    sourceHandle: sourceHandle || null,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

function stripHandlers(nodes: Node<VisualNodeData>[]) {
  const stripped = nodes.map((node) => {
    const { onUpdate, onRemove, ...data } = node.data
    return { ...node, data }
  })
  return removeUndefinedDeep(stripped) as Node<VisualNodeData>[]
}

function removeUndefinedDeep(value: any): any {
  if (Array.isArray(value)) return value.map(removeUndefinedDeep)
  if (!value || typeof value !== 'object') return value

  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (entry === undefined) return acc
    acc[key] = removeUndefinedDeep(entry)
    return acc
  }, {} as Record<string, any>)
}

function findTarget(edges: Edge[], source: string, sourceHandle?: string | null) {
  return edges.find((edge) => edge.source === source && (sourceHandle ? edge.sourceHandle === sourceHandle : !edge.sourceHandle))?.target || null
}

function normalizeLabel(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function inferChatTerminalAction(button: VisualButton): ChatFlowButtonAction {
  const label = normalizeLabel(`${button.label} ${button.actionLabel || ''}`)
  if (label.includes('atendente') || label.includes('especialista') || label.includes('humano') || label.includes('fila')) {
    return 'queue'
  }
  if (label.includes('encerrar') || label.includes('finalizar') || label.includes('sair') || label.includes('nao') || label.includes('não')) {
    return 'close'
  }
  return button.action === 'goto' ? 'close' : button.action
}

function targetActionForChat(nodes: Node<VisualNodeData>[], targetId: string | null, fallback: VisualButton) {
  const target = nodes.find((node) => node.id === targetId)
  if (!target) {
    const action = inferChatTerminalAction(fallback)
    return {
      action,
      targetMessageId: null,
      actionLabel: fallback.actionLabel || (action === 'queue' ? 'Falar com atendente' : action === 'close' ? 'Encerrar conversa' : null),
    }
  }
  if (target.data.kind === 'chatAction') {
    return { action: (target.data.action || 'queue') as ChatFlowButtonAction, targetMessageId: null, actionLabel: target.data.actionLabel || target.data.title || null }
  }
  return { action: 'goto' as ChatFlowButtonAction, targetMessageId: target.id, actionLabel: null }
}

function buildChatMessages(nodes: Node<VisualNodeData>[], edges: Edge[]): ChatFlowMessage[] {
  const messageNodes = nodes.filter((node) => ['chatGreeting', 'chatButtons', 'chatText', 'chatLink'].includes(node.data.kind))
  return messageNodes.map((node, index) => {
    const linkUrl = node.data.kind === 'chatLink' ? (node.data.actionLabel || '').trim() : ''
    const visualButtons = node.data.kind === 'chatButtons'
      ? (node.data.buttons || [])
      : (findTarget(edges, node.id) ? [{ ...createEmptyChatButton(), id: `${node.id}-next`, label: 'Continuar', action: 'goto' as ChatFlowButtonAction }] : [])
    const buttons = visualButtons.map((button) => {
      const targetId = findTarget(edges, node.id, button.id.startsWith(`${node.id}-next`) ? null : `button:${button.id}`)
      const action = targetActionForChat(nodes, targetId, button)
      return {
        id: button.id,
        label: button.label || 'Continuar',
        ...action,
      }
    })
    return {
      id: node.id,
      title: node.data.title || (index === 0 ? 'Saudação' : `Mensagem ${index + 1}`),
      text: node.data.kind === 'chatLink'
        ? [node.data.text || 'Acesse o link abaixo.', linkUrl].filter(Boolean).join('\n')
        : node.data.text || '',
      buttons,
    }
  }).filter((message) => message.text.trim())
}

function buildCallDigits(nodes: Node<VisualNodeData>[], edges: Edge[]): CallDigitConfig[] {
  const digitNodes = nodes.filter((node) => node.data.kind === 'callDigit')
  if (digitNodes.length) {
    return digitNodes.map((node) => ({
      digit: node.data.digit || '1',
      label: node.data.actionLabel || node.data.title || `Opção ${node.data.digit || '1'}`,
      speech: node.data.text || `Você selecionou a opção ${node.data.digit || '1'}.`,
      action: node.data.action === 'repeat' ? 'goto' : ((node.data.action || 'info') as CallDigitAction),
      targetDigit: null,
      actionLabel: node.data.actionLabel || node.data.title || null,
    }))
  }
  const menu = nodes.find((node) => node.data.kind === 'callMenu')
  const options = menu?.data.options?.length ? menu.data.options : createDefaultCallDigits()
  return options.map((option) => {
    const targetId = menu ? findTarget(edges, menu.id, `digit:${option.digit}`) : null
    const target = nodes.find((node) => node.id === targetId)
    if (target?.data.kind === 'callAction') {
      return {
        ...option,
        action: target.data.action === 'repeat' ? 'goto' : ((target.data.action || option.action) as CallDigitAction),
        actionLabel: target.data.actionLabel || target.data.title || option.actionLabel || null,
      }
    }
    if (target?.data.kind === 'callText') {
      return { ...option, action: 'info', speech: target.data.text || option.speech, actionLabel: target.data.title || option.actionLabel || null }
    }
    if (target?.data.kind === 'callMenu') {
      return { ...option, action: 'goto', targetDigit: option.targetDigit || null }
    }
    return option
  })
}

function getGreetingText(nodes: Node<VisualNodeData>[], kind: VisualKind, fallback: string) {
  return nodes.find((node) => node.data.kind === kind)?.data.text || fallback
}

function hasCycle(nodes: Node<VisualNodeData>[], edges: Edge[]) {
  const graph = new Map<string, string[]>()
  nodes.forEach((node) => graph.set(node.id, []))
  edges.forEach((edge) => graph.get(edge.source)?.push(edge.target))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)
    for (const target of graph.get(nodeId) || []) {
      if (visit(target)) return true
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  return nodes.some((node) => visit(node.id))
}

function validateFlow(section: BotSection, nodes: Node<VisualNodeData>[], edges: Edge[]) {
  const greetingKind = section === 'chat' ? 'chatGreeting' : 'callGreeting'
  const greetings = nodes.filter((node) => node.data.kind === greetingKind)
  if (greetings.length !== 1) return `O fluxo de ${section === 'chat' ? 'chat' : 'ligação'} precisa ter exatamente 1 saudação.`
  if (nodes.length > 1) {
    const disconnected = nodes.filter((node) => node.id !== greetings[0].id && !edges.some((edge) => edge.target === node.id))
    if (disconnected.length) return `Existem cards desconectados: ${disconnected.map((node) => node.data.title).join(', ')}.`
  }
  const missingButtonTarget = nodes.some((node) => node.data.kind === 'chatButtons' && (node.data.buttons || []).some((button) => {
    if (button.action !== 'goto') return false
    if (findTarget(edges, node.id, `button:${button.id}`)) return false
    return !['queue', 'close'].includes(inferChatTerminalAction(button))
  }))
  if (missingButtonTarget) return 'Conecte os botões que realmente precisam continuar o fluxo. Botões de encerrar ou falar com atendente podem ficar sem conexão.'
  const missingDigitTarget = nodes.some((node) => (
    (node.data.kind === 'callMenu' && (node.data.options || []).some((option) => option.action === 'goto' && !findTarget(edges, node.id, `digit:${option.digit}`))) ||
    (node.data.kind === 'callDigit' && node.data.action === 'goto' && !findTarget(edges, node.id))
  ))
  if (missingDigitTarget) return 'Toda opção numérica configurada como "Ir para outro fluxo" precisa estar conectada.'
  if (hasCycle(nodes, edges)) return 'O fluxo possui loop. Remova a conexão circular antes de salvar.'
  return null
}

function PaletteCard({ kind, title, description, icon: Icon }: { kind: VisualKind; title: string; description: string; icon: any }) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/atendepro-bot-node', kind)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition hover:border-primary hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

export default function BotPage() {
  const { company } = useAuth()
  const [activeSection, setActiveSection] = useState<BotSection>('chat')
  const [saving, setSaving] = useState(false)
  const [botName, setBotName] = useState('AtendePro BOT')
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [flowInstance, setFlowInstance] = useState<any>(null)
  const [chatNodes, setChatNodes, onChatNodesChange] = useNodesState<Node<VisualNodeData>>([])
  const [chatEdges, setChatEdges, onChatEdgesChange] = useEdgesState<Edge>([])
  const [callNodes, setCallNodes, onCallNodesChange] = useNodesState<Node<VisualNodeData>>([])
  const [callEdges, setCallEdges, onCallEdgesChange] = useEdgesState<Edge>([])

  const nodes = activeSection === 'chat' ? chatNodes : callNodes
  const edges = activeSection === 'chat' ? chatEdges : callEdges
  const setNodes = activeSection === 'chat' ? setChatNodes : setCallNodes
  const setEdges = activeSection === 'chat' ? setChatEdges : setCallEdges
  const onNodesChange = activeSection === 'chat' ? onChatNodesChange : onCallNodesChange
  const onEdgesChange = activeSection === 'chat' ? onChatEdgesChange : onCallEdgesChange

  const updateNode = useCallback((nodeId: string, patch: Partial<VisualNodeData>) => {
    setChatNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
    setCallNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
  }, [setCallNodes, setChatNodes])

  const removeNode = useCallback((nodeId: string) => {
    setChatNodes((current) => current.filter((node) => node.id !== nodeId))
    setChatEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setCallNodes((current) => current.filter((node) => node.id !== nodeId))
    setCallEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
  }, [setCallEdges, setCallNodes, setChatEdges, setChatNodes])

  useEffect(() => {
    if (!company) return
    setBotName(company.botName || 'AtendePro BOT')
    const chatFlow = company.settings?.visualBotFlows?.chat || createDefaultChatVisualFlow(parseChatFlow(company.settings?.chatBotFlowMessages))
    const callGreeting = company.settings?.callBotGreeting || 'Bem-vindo. Escolha uma das opções do menu para continuar o atendimento.'
    const callDigits = parseCallDigits(company.settings?.callBotOptions)
    const callFlow = normalizeCallVisualFlow(company.settings?.visualBotFlows?.call || createDefaultCallVisualFlow(callGreeting, callDigits), callGreeting, callDigits)
    setChatNodes(applyNodeHandlers(chatFlow.nodes || [], updateNode, removeNode))
    setChatEdges(chatFlow.edges || [])
    setCallNodes(applyNodeHandlers(callFlow.nodes || [], updateNode, removeNode))
    setCallEdges(callFlow.edges || [])
  }, [company, removeNode, setCallEdges, setCallNodes, setChatEdges, setChatNodes, updateNode])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({
      ...connection,
      id: createId('edge'),
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
    }, current))
  }, [setEdges])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/atendepro-bot-node') as VisualKind
    if (!kind) return
    if ((activeSection === 'chat' && !kind.startsWith('chat')) || (activeSection === 'call' && !kind.startsWith('call'))) {
      toast.error('Esse card pertence à outra configuração.')
      return
    }
    if (kind.includes('Greeting') && nodes.some((node) => node.data.kind === kind)) {
      toast.error('Este fluxo já possui uma saudação.')
      return
    }
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const position = flowInstance?.screenToFlowPosition
      ? flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      : { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
    setNodes((current) => applyNodeHandlers([...current, createVisualNode(kind, position)], updateNode, removeNode))
  }, [activeSection, flowInstance, nodes, removeNode, setNodes, updateNode])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const palette = activeSection === 'chat'
    ? [
        { kind: 'chatGreeting' as VisualKind, title: 'Saudação', description: 'Mensagem inicial única do chat.', icon: Bot },
        { kind: 'chatButtons' as VisualKind, title: 'Botões', description: 'Opções clicáveis com saídas próprias.', icon: MousePointer2 },
        { kind: 'chatText' as VisualKind, title: 'Texto', description: 'Resposta automática informativa.', icon: Type },
        { kind: 'chatLink' as VisualKind, title: 'Link', description: 'Mensagem com URL para o cliente.', icon: Link2 },
        { kind: 'chatAction' as VisualKind, title: 'Ações', description: 'Fila, encerrar, link ou ação.', icon: Zap },
      ]
    : [
        { kind: 'callGreeting' as VisualKind, title: 'Saudação', description: 'Áudio inicial falado por TTS.', icon: Bot },
        { kind: 'callDigit' as VisualKind, title: 'Número DTMF', description: 'Tecla isolada, repetível e conectável.', icon: Hash },
        { kind: 'callText' as VisualKind, title: 'Texto falado', description: 'Informação convertida em voz.', icon: Type },
        { kind: 'callAction' as VisualKind, title: 'Ações', description: 'Atendente, encerrar ou repetir.', icon: Zap },
      ]

  const handleSave = async () => {
    if (!company?.id) return
    const cleanChatNodes = stripHandlers(chatNodes)
    const cleanCallNodes = stripHandlers(callNodes)
    const chatError = validateFlow('chat', cleanChatNodes, chatEdges)
    const callError = validateFlow('call', cleanCallNodes, callEdges)
    if (chatError || callError) {
      const message = chatError || callError || 'Revise o fluxo antes de salvar.'
      setValidationMessage(message)
      toast.error(message)
      return
    }

    setSaving(true)
    setValidationMessage(null)
    try {
      const chatMessages = buildChatMessages(cleanChatNodes, chatEdges)
      const callDigits = buildCallDigits(cleanCallNodes, callEdges)
      const callGreeting = getGreetingText(cleanCallNodes, 'callGreeting', 'Bem-vindo. Escolha uma das opções do menu para continuar o atendimento.')
      const chatGreeting = chatMessages[0]?.text || getGreetingText(cleanChatNodes, 'chatGreeting', 'Olá! Como posso ajudar?')

      const payload = removeUndefinedDeep({
        botName,
        botGreeting: chatGreeting,
        settings: {
          ...(company.settings || {}),
          chatBotFlowMessages: chatMessages,
          callBotGreeting: callGreeting,
          callBotOptions: callDigits,
          visualBotFlows: {
            version: 1,
            chat: { nodes: cleanChatNodes, edges: chatEdges },
            call: { nodes: cleanCallNodes, edges: callEdges },
          },
        },
      })
      await updateDoc(doc(db, 'companies', company.id), payload)

      toast.success('Configuração do BOT salva com sucesso.')
    } catch (error) {
      console.error('Erro ao salvar configuração do BOT:', error)
      toast.error('Não foi possível salvar a configuração do BOT.')
    } finally {
      setSaving(false)
    }
  }

  const currentError = useMemo(() => validateFlow(activeSection, stripHandlers(nodes), edges), [activeSection, edges, nodes])

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[680px] flex-col gap-3 overflow-hidden" data-testid="dashboard-bot-page">
      <div className="shrink-0 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Configuração do BOT</h1>
          <p className="mt-1 text-sm text-muted-foreground">A empresa controla o fluxo do chat e da ligação com mensagens, botões, números e ações.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary" data-testid="bot-save-button">
          {saving ? <Save className="mr-2 h-4 w-4 animate-pulse" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Configuração
        </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-card/80 px-3 py-2 shadow-sm">
        <Button variant={activeSection === 'chat' ? 'default' : 'outline'} onClick={() => setActiveSection('chat')} data-testid="bot-open-chat-config-button">
          <MessageSquare className="mr-2 h-4 w-4" />
          Fluxo de Chat
        </Button>
        <Button variant={activeSection === 'call' ? 'default' : 'outline'} onClick={() => setActiveSection('call')} data-testid="bot-open-call-config-button">
          <PhoneCall className="mr-2 h-4 w-4" />
          Fluxo de Ligação
        </Button>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${currentError ? 'border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
          {currentError ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {currentError || 'Fluxo atual válido'}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative min-h-0 bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setFlowInstance}
            fitView
            snapToGrid
            snapGrid={[24, 24]}
            className="bot-flow-canvas"
          >
            <Background gap={24} size={1.4} />
            <MiniMap pannable zoomable nodeStrokeWidth={3} className="!bg-background/95" />
            <Controls showInteractive={false} />
            <Panel position="top-left">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
                <Workflow className="h-4 w-4 text-primary" />
                Arraste cards, conecte pontos e use zoom/pan livremente.
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <aside className="min-h-0 overflow-hidden border-t border-border bg-muted/30 p-3 lg:border-l lg:border-t-0">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div>
              <h2 className="font-semibold">Componentes</h2>
              <p className="mt-1 text-xs text-muted-foreground">Clique, segure e arraste para o canvas.</p>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {palette.map((item) => (
                <PaletteCard key={item.kind} {...item} />
              ))}
            </div>

            <div className="shrink-0 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <Link2 className="h-4 w-4" />
                Conexões
              </div>
              Cards possuem entrada à esquerda e saídas à direita. Na ligação, cada número é um card separado e pode aparecer mais de uma vez em contextos diferentes.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
