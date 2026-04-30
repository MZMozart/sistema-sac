import { describe, expect, it } from 'vitest'
import { createAttendanceProtocol } from '@/lib/attendance-protocol'

describe('createAttendanceProtocol', () => {
  it('gera protocolo com prefixo, ano e sufixo padronizados', () => {
    const protocol = createAttendanceProtocol('CHT', new Date('2026-04-30T12:00:00Z'), 'abc-12345-xyz')

    expect(protocol).toBe('CHT-2026-ABC12345')
  })

  it('recusa prefixos fora das regras do sistema', () => {
    expect(() => createAttendanceProtocol('BAD' as any, new Date(), 'abc123456')).toThrow('invalid-protocol-prefix')
  })

  it('recusa ids curtos demais para formar protocolo rastreavel', () => {
    expect(() => createAttendanceProtocol('CAL', new Date(), '123')).toThrow('invalid-protocol-id')
  })
})
