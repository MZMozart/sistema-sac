function toDate(value: any) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function calculateCompanyPerformance({ company, chats = [], calls = [], ratings = [] }: { company?: any; chats?: any[]; calls?: any[]; ratings?: any[] }) {
  const resolvedChats = chats.filter((item) => item.status === 'closed').length
  const abandonedChats = chats.filter((item) => item.status === 'abandoned').length
  const totalChats = chats.length || 1

  const responseTimes = chats
    .map((item) => {
      const createdAt = toDate(item.createdAt)
      const firstHumanAt = toDate(item.firstHumanResponseAt || item.answeredAt || item.lastMessageAt)
      if (!createdAt || !firstHumanAt) return null
      return Math.max(0, Math.round((firstHumanAt.getTime() - createdAt.getTime()) / 1000))
    })
    .filter((value): value is number => value !== null)

  const ratingsAverage = average(ratings.map((item) => Number(item.rating || 0)).filter(Boolean))
  const resolutionRate = resolvedChats / totalChats
  const abandonmentRate = abandonedChats / totalChats
  const avgResponseSeconds = average(responseTimes)
  const slaMetRate = avgResponseSeconds <= 120 ? 1 : avgResponseSeconds <= 300 ? 0.8 : avgResponseSeconds <= 600 ? 0.5 : 0.2
  const verificationReasons: string[] = []

  const qualifiesAutomaticVerification = Boolean(
    avgResponseSeconds > 0 &&
      avgResponseSeconds <= 180 &&
      resolutionRate >= 0.82 &&
      ratingsAverage >= 4.4 &&
      abandonmentRate <= 0.08 &&
      slaMetRate >= 0.8
  )

  if (avgResponseSeconds <= 180) verificationReasons.push('tempo médio de resposta')
  if (resolutionRate >= 0.82) verificationReasons.push('alta taxa de resolução')
  if (ratingsAverage >= 4.4) verificationReasons.push('avaliação média alta')
  if (abandonmentRate <= 0.08) verificationReasons.push('baixa taxa de abandono')
  if (slaMetRate >= 0.8) verificationReasons.push('SLA cumprido')

  const rankingScore =
    ratingsAverage * 40 +
    resolutionRate * 30 +
    Math.max(0, 20 - Math.min(avgResponseSeconds / 30, 20)) +
    Math.min((chats.length + calls.length) / 10, 10)

  const verificationStatus = company?.premiumVerificationActive
    ? {
        verified: true,
        source: 'premium',
        tooltip: 'Empresa verificada via plano premium',
      }
    : qualifiesAutomaticVerification
      ? {
          verified: true,
          source: 'automatic',
          tooltip: 'Empresa verificada com base em desempenho',
        }
      : {
          verified: false,
          source: null,
          tooltip: '',
        }

  return {
    avgResponseSeconds,
    resolutionRate,
    abandonmentRate,
    ratingsAverage,
    slaMetRate,
    totalChats: chats.length,
    totalCalls: calls.length,
    totalRatings: ratings.length,
    rankingScore,
    verificationReasons,
    verificationStatus,
  }
}

export function buildSectorRanking(companies: any[]) {
  const sorted = [...companies].sort((a, b) => b.performance.rankingScore - a.performance.rankingScore)
  return sorted.map((company, index) => ({
    ...company,
    rankingPosition: index + 1,
    medal: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
  }))
}