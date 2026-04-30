export type AttendanceProtocolPrefix = 'CHT' | 'CAL' | 'BOT'

const allowedPrefixes = new Set<AttendanceProtocolPrefix>(['CHT', 'CAL', 'BOT'])

export function createAttendanceProtocol(
  prefix: AttendanceProtocolPrefix,
  date = new Date(),
  id = crypto.randomUUID()
) {
  if (!allowedPrefixes.has(prefix)) {
    throw new Error('invalid-protocol-prefix')
  }

  const year = date.getFullYear()
  const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()

  if (suffix.length < 8) {
    throw new Error('invalid-protocol-id')
  }

  return `${prefix}-${year}-${suffix}`
}

