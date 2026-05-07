import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_SECTOR_ID, DEFAULT_SECTOR_NAME, normalizeSectorId, normalizeSectorName } from '@/lib/sectors'

type AssignmentChannel = 'chat' | 'call'

function employeeSectorId(employee: any) {
  return normalizeSectorId(employee?.setor_id || employee?.sectorId)
}

function employeeSectorName(employee: any) {
  return normalizeSectorName(employee?.setor_nome || employee?.sectorName)
}

function isActiveEmployee(employee: any) {
  return employee?.isActive !== false && ['attendant', 'employee', 'manager', 'owner'].includes(employee?.role || 'employee')
}

function loadForChannel(channel: AssignmentChannel, employee: any, chats: any[], calls: any[]) {
  if (channel === 'call') {
    return calls.filter((call) => call.employeeId === employee.userId && ['active', 'ringing', 'waiting'].includes(call.status)).length
  }
  return chats.filter((chat) => chat.employeeId === employee.userId && ['active', 'waiting', 'pending_resolution'].includes(chat.status)).length
}

export async function assignLeastLoadedAttendant(companyId: string, channel: AssignmentChannel = 'chat', sectorId?: string | null) {
  const targetSectorId = normalizeSectorId(sectorId)
  const [employeesSnapshot, chatsSnapshot, callsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'employees'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'chats'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'call_sessions'), where('companyId', '==', companyId))),
  ])

  const allEmployees = employeesSnapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as any) }))
    .filter(isActiveEmployee)

  const sectorEmployees = targetSectorId === DEFAULT_SECTOR_ID
    ? allEmployees
    : allEmployees.filter((employee) => employeeSectorId(employee) === targetSectorId)
  const employees = sectorEmployees.length > 0 ? sectorEmployees : allEmployees
  const chats = chatsSnapshot.docs.map((item) => ({ id: item.id, ...(item.data() as any) }))
  const calls = callsSnapshot.docs.map((item) => ({ id: item.id, ...(item.data() as any) }))

  const scored = employees
    .map((employee) => ({
      employee,
      load: loadForChannel(channel, employee, chats, calls),
      sectorId: employeeSectorId(employee),
      sectorName: employeeSectorName(employee),
      usedFallback: targetSectorId !== DEFAULT_SECTOR_ID && employeeSectorId(employee) !== targetSectorId,
    }))
    .sort((a, b) => a.load - b.load || String(a.employee.name || '').localeCompare(String(b.employee.name || ''), 'pt-BR'))

  return scored[0] || {
    employee: null,
    load: 0,
    sectorId: targetSectorId,
    sectorName: targetSectorId === DEFAULT_SECTOR_ID ? DEFAULT_SECTOR_NAME : DEFAULT_SECTOR_NAME,
    usedFallback: false,
  }
}
