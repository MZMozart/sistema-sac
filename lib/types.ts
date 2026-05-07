// Tipos do Sistema de Atendimento

export type AccountType = 'pf' | 'pj'
export type UserType = 'PF' | 'PJ' // used on UI for registration/login selection
export type UserRole = 'owner' | 'manager' | 'employee' | 'client'
export type ChatStatus = 'waiting' | 'bot' | 'active' | 'closed' | 'pending_resolution'
export type CallStatus = 'bot' | 'waiting' | 'ringing' | 'active' | 'post_service' | 'ended' | 'completed'
export type ClosedBy = 'client' | 'employee' | 'bot' | 'inactivity_client' | 'inactivity_employee' | 'system'
export type MessageSender = 'bot' | 'client' | 'employee'
export type CallLifecycleState = 'IDLE' | 'STARTED' | 'BOT_FLOW' | 'WAITING_INPUT' | 'TRANSFER_QUEUE' | 'IN_SERVICE' | 'POST_SERVICE' | 'FINISHED'

export interface Sector {
  id: string
  nome: string
  empresa_id: string
  ativo: boolean
  created_at: Date
  updated_at?: Date
}

export interface User {
  uid: string
  name: string
  email: string
  phone: string
  accountType: AccountType
  createdAt: Date
  role?: UserRole
  // Campos adicionais opcionais
  companyId?: string
  fullName?: string
  cpf?: string
  cnpj?: string
  botPolicies?: string
  ownerFullName?: string
  razaoSocial?: string
  nomeFantasia?: string
  segmento?: string
  gender?: 'masculino' | 'feminino' | 'nao-binario' | 'prefiro-nao-informar' | 'outro'
  horarioInicio?: string
  horarioFim?: string
  horarioAlmocoInicio?: string
  horarioAlmocoFim?: string
  website?: string
  address?: string
  neighborhood?: string
  cep?: string
  documents?: string[]
  photoURL?: string
  emailVerified?: boolean
  phoneVerified?: boolean
  // Perfil Público
  dateOfBirth?: string
  city?: string
  state?: string
  preferredContactChannel?: 'chat' | 'email' | 'phone'
  profession?: string
  description?: string
  // Preferências de Notificação
  notificationPreferences?: {
    responses: ('email' | 'push' | 'sms')[]
    newMessages: ('email' | 'push' | 'sms')[]
    ticketUpdates: ('email' | 'push' | 'sms')[]
  }
  // Configurações de Privacidade
  privacySettings?: {
    showPhone: boolean
    showFullName: boolean
    allowServiceHistory: boolean
  }
  // Preferências do Aplicativo
  appPreferences?: {
    language: string
    theme: 'light' | 'dark' | 'system'
    preferredServiceTime?: string
  }
  // Contas Conectadas
  connectedAccounts?: ('email' | 'google' | 'apple' | 'phone')[]
  twoFactorEnabled?: boolean
  twoFactorSecret?: string | null
  pendingTwoFactorSecret?: string | null
  settings?: Record<string, any>
  // Campos extras usados no sistema
  type?: 'PF' | 'PJ'
  phoneCountryCode?: string
}

export interface Company {
  id: string
  ownerId: string
  name: string
  cnpj: string
  email: string
  phone: string
  razaoSocial: string
  nomeFantasia: string
  logoURL?: string
  bannerURL?: string
  // Horários
  horarioInicio: string
  horarioFim: string
  horarioAlmocoInicio?: string
  horarioAlmocoFim?: string
  diasFuncionamento: number[] // 0-6 (domingo-sábado)
  // Configurações do BOT
  botPolicies: string
  botGreeting: string
  botQuestions: BotQuestion[]
  // URA (menu de voz)
  uraOptions: URAOption[]
  documents?: string[]
  descricao?: string
  ownerFullName?: string
  segmento?: string
  website?: string
  cep?: string
  endereco?: string
  address?: string
  corPrimaria?: string
  corDestaque?: string
  instagram?: string
  facebook?: string
  whatsapp?: string
  linkedin?: string
  botName?: string
  botOutOfHours?: string
  botActive?: boolean
  twoFactorAuth?: boolean
  rating?: number
  totalReviews?: number
  verified?: boolean
  premiumVerificationActive?: boolean
  premiumVerificationStatus?: string
  premiumVerificationPlan?: string
  premiumVerificationAmount?: number
  premiumVerificationCustomerId?: string | null
  premiumVerificationSubscriptionId?: string | null
  premiumVerificationUpdatedAt?: string
  settings?: Record<string, any>
  // Meta
  createdAt: Date
  isActive: boolean
  // Métricas públicas
  totalAtendimentos: number
  avaliacaoMedia: number
  totalAvaliacoes: number
}

export interface BotQuestion {
  id: string
  question: string
  options?: string[]
  nextQuestionId?: string
  shouldTransferToHuman?: boolean
}

export interface URAOption {
  digit: string
  label: string
  departmentId?: string
  routeTo?: string
}

export interface Employee {
  id: string
  companyId: string
  userId: string
  name?: string
  email?: string
  phone?: string
  role: UserRole
  permissions: Permissions
  isActive: boolean
  setor_id?: string | null
  setor_nome?: string | null
  createdAt: Date
  // Métricas
  totalChats: number
  totalCalls: number
  averageRating: number
  totalRatings: number
  inactivityCount: number
  workSchedule?: {
    enabled: boolean
    days: number[]
    start: string
    end: string
  }
  tempAccessApprovedUntil?: string | null
}

export interface Permissions {
  canViewDashboard: boolean
  canManageEmployees: boolean
  canEditCompanySettings: boolean
  canViewAllChats: boolean
  canViewAllCalls: boolean
  canExportData: boolean
  canDeleteCompany: boolean
  canEditBotPolicies: boolean
  canManagePermissions: boolean
  canViewRatings?: boolean
  canManageIntegrations?: boolean
}

export interface Chat {
  id: string
  protocolo: string
  companyId: string
  clientId: string
  employeeId?: string
  status: ChatStatus
  closedBy?: ClosedBy
  rating?: number
  comment?: string
  createdAt: Date
  endedAt?: Date
  lastActivity: Date
  botResolved: boolean
  // Campos extras
  companyName?: string
  lastMessage?: string
  unreadCount?: number
  clientName?: string
  clientEmail?: string
  priority?: string
  lastMessageAt?: Date
  queuePosition?: number | null
  employeeName?: string | null
  setor_id?: string | null
  setor_nome?: string | null
  botAttempts?: number
  botCurrentMessageId?: string | null
  botAwaitingResolvedConfirmation?: boolean
  botAwaitingAnythingElse?: boolean
  lastInactivityPromptAt?: Date
  inactiveActor?: 'client' | 'employee' | null
  inactiveDurationSeconds?: number
}

export interface Message {
  id: string
  chatId: string
  senderType: MessageSender
  senderId: string
  message: string
  timestamp: Date
  isRead: boolean
  // Campos extras
  content?: string
  createdAt?: Date
  read?: boolean
  senderName?: string
  senderPhotoURL?: string
}

export interface Call {
  id: string
  protocolo: string
  companyId: string
  clientId: string
  employeeId?: string
  gravacaoURL?: string
  tempoTotal: number // em segundos
  tempoEspera: number // em segundos
  closedBy?: ClosedBy
  rating?: number
  comment?: string
  createdAt: Date
  endedAt?: Date
  // Flags de comportamento
  clientHungUp: boolean
  employeeHungUp: boolean
  callState?: CallLifecycleState
  setor_id?: string | null
  setor_nome?: string | null
  clientMuted: boolean
  employeeMuted: boolean
  queuePosition?: number | null
}

export interface Rating {
  id: string
  protocolo: string
  companyId: string
  clientId: string
  employeeId?: string
  type: 'chat' | 'call'
  rating: number
  comment?: string
  createdAt: Date
  clientName?: string
  clientPhotoURL?: string
}

export type Review = Rating

export interface ActivityLog {
  id: string
  companyId: string
  employeeId?: string
  action: string
  details: string
  timestamp: Date
  ipAddress?: string
}

// Dados da API ReceitaWS (CNPJ)
export interface CNPJData {
  cnpj: string
  nome: string
  fantasia: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  telefone: string
  email: string
  situacao: string
  data_situacao: string
  atividade_principal: { code: string; text: string }[]
}

// Dashboard Filters
export interface DashboardFilters {
  employeeId?: string
  dateStart?: Date
  dateEnd?: Date
  type?: 'chat' | 'call' | 'all'
}

export interface DashboardMetrics {
  totalAtendimentos: number
  tempoMedioResposta: number
  tempoMedioAtendimento: number
  taxaBotResolve: number
  taxaAbandono: number
  ligacoesPerdidas: number
  avaliacaoMedia: number
  chatsInatividade: number
}
