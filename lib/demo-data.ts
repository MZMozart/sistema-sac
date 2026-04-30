export type DashboardPeriod = '24h' | '7d' | '30d' | '90d'

export interface StatCardData {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  color: string
  icon: 'messageSquare' | 'phone' | 'star' | 'bot'
}

export interface ChartPoint {
  name: string
  chats: number
  calls: number
}

export interface ResolutionPoint {
  name: string
  value: number
  color: string
}

export interface RecentChatCard {
  id: string
  client: string
  message: string
  time: string
  status: 'active' | 'waiting' | 'closed' | 'bot'
  employee?: string
}

export interface EmployeeRankCard {
  name: string
  chats: number
  rating: number
  avatar?: string
}

const baseCharts: Record<DashboardPeriod, ChartPoint[]> = {
  '24h': [
    { name: '08h', chats: 12, calls: 5 },
    { name: '10h', chats: 19, calls: 8 },
    { name: '12h', chats: 24, calls: 10 },
    { name: '14h', chats: 18, calls: 7 },
    { name: '16h', chats: 21, calls: 9 },
    { name: '18h', chats: 15, calls: 6 },
  ],
  '7d': [
    { name: 'Seg', chats: 84, calls: 29 },
    { name: 'Ter', chats: 92, calls: 36 },
    { name: 'Qua', chats: 108, calls: 44 },
    { name: 'Qui', chats: 121, calls: 52 },
    { name: 'Sex', chats: 130, calls: 57 },
    { name: 'Sáb', chats: 89, calls: 31 },
    { name: 'Dom', chats: 54, calls: 18 },
  ],
  '30d': [
    { name: 'S1', chats: 392, calls: 142 },
    { name: 'S2', chats: 440, calls: 158 },
    { name: 'S3', chats: 471, calls: 176 },
    { name: 'S4', chats: 518, calls: 190 },
  ],
  '90d': [
    { name: 'Jan', chats: 1580, calls: 584 },
    { name: 'Fev', chats: 1664, calls: 612 },
    { name: 'Mar', chats: 1788, calls: 640 },
  ],
}

const baseStats: Record<DashboardPeriod, StatCardData[]> = {
  '24h': [
    { title: 'Chats resolvidos', value: '109', change: '+8.2%', trend: 'up', color: 'var(--chart-1)', icon: 'messageSquare' },
    { title: 'Ligações concluídas', value: '45', change: '+6.1%', trend: 'up', color: 'var(--chart-2)', icon: 'phone' },
    { title: 'Satisfação média', value: '4.8', change: '+0.3', trend: 'up', color: 'var(--chart-4)', icon: 'star' },
    { title: 'Resolução do BOT', value: '72%', change: '+4.7%', trend: 'up', color: 'var(--chart-5)', icon: 'bot' },
  ],
  '7d': [
    { title: 'Chats resolvidos', value: '678', change: '+11.4%', trend: 'up', color: 'var(--chart-1)', icon: 'messageSquare' },
    { title: 'Ligações concluídas', value: '267', change: '+9.1%', trend: 'up', color: 'var(--chart-2)', icon: 'phone' },
    { title: 'Satisfação média', value: '4.7', change: '+0.2', trend: 'up', color: 'var(--chart-4)', icon: 'star' },
    { title: 'Resolução do BOT', value: '69%', change: '+5.2%', trend: 'up', color: 'var(--chart-5)', icon: 'bot' },
  ],
  '30d': [
    { title: 'Chats resolvidos', value: '1.821', change: '+17.4%', trend: 'up', color: 'var(--chart-1)', icon: 'messageSquare' },
    { title: 'Ligações concluídas', value: '666', change: '+12.3%', trend: 'up', color: 'var(--chart-2)', icon: 'phone' },
    { title: 'Satisfação média', value: '4.6', change: '+0.1', trend: 'up', color: 'var(--chart-4)', icon: 'star' },
    { title: 'Resolução do BOT', value: '66%', change: '+3.9%', trend: 'up', color: 'var(--chart-5)', icon: 'bot' },
  ],
  '90d': [
    { title: 'Chats resolvidos', value: '5.032', change: '+21.8%', trend: 'up', color: 'var(--chart-1)', icon: 'messageSquare' },
    { title: 'Ligações concluídas', value: '1.836', change: '+15.9%', trend: 'up', color: 'var(--chart-2)', icon: 'phone' },
    { title: 'Satisfação média', value: '4.7', change: '+0.4', trend: 'up', color: 'var(--chart-4)', icon: 'star' },
    { title: 'Resolução do BOT', value: '70%', change: '+6.4%', trend: 'up', color: 'var(--chart-5)', icon: 'bot' },
  ],
}

const resolutionData: ResolutionPoint[] = [
  { name: 'BOT concluiu', value: 39, color: '#38bdf8' },
  { name: 'Humano concluiu', value: 44, color: '#2563eb' },
  { name: 'Inatividade', value: 9, color: '#f59e0b' },
  { name: 'Abandono', value: 8, color: '#ef4444' },
]

const recentChats: RecentChatCard[] = [
  { id: 'chat-1', client: 'Maria Silva', message: 'Preciso validar o status do meu pedido 21444.', time: 'Agora', status: 'active', employee: 'João Santos' },
  { id: 'chat-2', client: 'Pedro Costa', message: 'Meu cartão foi cobrado duas vezes.', time: '4 min', status: 'waiting' },
  { id: 'chat-3', client: 'Ana Oliveira', message: 'Atendimento concluído com sucesso. Obrigada!', time: '12 min', status: 'closed', employee: 'Marina Alves' },
  { id: 'chat-4', client: 'Carlos Ferreira', message: 'Quero falar com um atendente agora.', time: '18 min', status: 'bot' },
]

const topEmployees: EmployeeRankCard[] = [
  { name: 'João Santos', chats: 214, rating: 4.9 },
  { name: 'Marina Alves', chats: 186, rating: 4.8 },
  { name: 'Lucas Costa', chats: 173, rating: 4.7 },
  { name: 'Aline Ribeiro', chats: 154, rating: 4.6 },
]

export const reportSummary = [
  { title: 'Tempo médio de resposta', value: '01m 42s', helper: 'Melhora de 18% em relação ao último período' },
  { title: 'Tempo médio de atendimento', value: '06m 18s', helper: 'Mais eficiência sem perder qualidade' },
  { title: 'Taxa de abandono', value: '4.9%', helper: 'Abaixo da meta máxima de 6%' },
  { title: 'Ligações perdidas', value: '18', helper: 'Concentradas no pico das 18h' },
]

export const reportHeatmap = [
  { hour: '08h', intensity: 0.18 },
  { hour: '10h', intensity: 0.36 },
  { hour: '12h', intensity: 0.44 },
  { hour: '14h', intensity: 0.62 },
  { hour: '16h', intensity: 0.78 },
  { hour: '18h', intensity: 1 },
  { hour: '20h', intensity: 0.41 },
]

export function getDashboardSnapshot(period: DashboardPeriod) {
  return {
    statsCards: baseStats[period],
    chartData: baseCharts[period],
    pieData: resolutionData,
    recentChats,
    topEmployees,
  }
}