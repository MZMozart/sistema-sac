import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/server-auth'
import { adminDb } from '@/lib/firebase-admin'

type Period = '24h' | '7d' | '30d' | '90d'

function getStartDate(period: Period) {
  const now = new Date()
  if (period === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (period === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (period === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
}

function labelForDate(date: Date, period: Period) {
  if (period === '24h') return `${String(date.getHours()).padStart(2, '0')}h`
  if (period === '7d') return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  if (period === '30d') return `S${Math.ceil(date.getDate() / 7)}`
  return date.toLocaleDateString('pt-BR', { month: 'short' })
}

export async function GET(request: NextRequest) {
  try {
    const { userData } = await getServerUser(request)
    const companyId = userData?.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'company-not-found' }, { status: 400 })
    }

    const period = (request.nextUrl.searchParams.get('period') as Period) || '7d'
    const startDate = getStartDate(period)

    const [companySnap, chatsSnap, callsSnap, employeesSnap, ratingsSnap] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('chats').where('companyId', '==', companyId).get(),
      adminDb.collection('calls').where('companyId', '==', companyId).get(),
      adminDb.collection('employees').where('companyId', '==', companyId).get(),
      adminDb.collection('ratings').where('companyId', '==', companyId).get(),
    ])

    const chats = chatsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any))
    const calls = callsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any))
    const employees = employeesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any))
    const ratings = ratingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any))

    const chatsInPeriod = chats.filter((chat: any) => new Date(chat.createdAt || chat.lastMessageAt || Date.now()) >= startDate)
    const callsInPeriod = calls.filter((call: any) => new Date(call.createdAt || call.startTime || Date.now()) >= startDate)

    const chartMap = new Map<string, { name: string; chats: number; calls: number }>()
    for (const chat of chatsInPeriod) {
      const key = labelForDate(new Date(chat.createdAt || chat.lastMessageAt || Date.now()), period)
      chartMap.set(key, { name: key, chats: (chartMap.get(key)?.chats || 0) + 1, calls: chartMap.get(key)?.calls || 0 })
    }
    for (const call of callsInPeriod) {
      const key = labelForDate(new Date(call.createdAt || call.startTime || Date.now()), period)
      chartMap.set(key, { name: key, chats: chartMap.get(key)?.chats || 0, calls: (chartMap.get(key)?.calls || 0) + 1 })
    }

    const chartData = Array.from(chartMap.values())
    const ratingsValues = ratings.map((rating: any) => Number(rating.nota || rating.rating || 0)).filter(Boolean)
    const averageRating = ratingsValues.length ? ratingsValues.reduce((sum, value) => sum + value, 0) / ratingsValues.length : 0

    const employeeRanking = employees
      .map((employee: any) => ({
        id: employee.id,
        name: employee.name,
        totalChats: employee.totalChats || 0,
        totalCalls: employee.totalCalls || 0,
        averageRating: employee.averageRating || 0,
        isActive: employee.isActive,
      }))
      .sort((a, b) => b.totalChats + b.totalCalls - (a.totalChats + a.totalCalls))

    const botResolved = chats.filter((chat: any) => chat.botResolved).length
    const inactiveChats = chats.filter((chat: any) => chat.closedBy === 'employee_inactivity' || chat.closedBy === 'client_inactivity').length
    const abandoned = chats.filter((chat: any) => chat.closedBy === 'client').length
    const lostCalls = calls.filter((call: any) => call.status === 'missed').length

    return NextResponse.json({
      company: companySnap.exists ? companySnap.data() : null,
      summary: {
        totalChats: chats.length,
        totalCalls: calls.length,
        totalEmployees: employees.length,
        averageRating,
        botResolved,
        inactiveChats,
        abandoned,
        lostCalls,
      },
      chartData,
      employeeRanking,
      recentChats: chatsInPeriod
        .sort((a: any, b: any) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime())
        .slice(0, 8),
      recentCalls: callsInPeriod
        .sort((a: any, b: any) => new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime())
        .slice(0, 8),
    })
  } catch (error: any) {
    const status = error?.message === 'missing-auth-token' ? 401 : 500
    return NextResponse.json({ error: error?.message || 'analytics-failed' }, { status })
  }
}