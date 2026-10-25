export type Participant = {
  name: string
  part: 'mobile' | 'pc'
  gender: 'female' | 'male'
}

export type Team = {
  name: string
  members: Participant[]
}

export const PARTICIPANTS: Participant[] = [
  { name: '박보라', part: 'mobile', gender: 'female' },
  { name: '박지은', part: 'pc', gender: 'female' },
  { name: '이정인', part: 'pc', gender: 'male' },
  { name: '손민혁', part: 'pc', gender: 'male' },
  { name: '이진영', part: 'pc', gender: 'male' },
  { name: '김수정', part: 'pc', gender: 'female' },
  { name: '이종태', part: 'pc', gender: 'male' },
  { name: '최현재', part: 'mobile', gender: 'male' },
  { name: '구일모', part: 'mobile', gender: 'male' },
  { name: '윤희진', part: 'mobile', gender: 'female' },
  { name: '유하빈', part: 'mobile', gender: 'female' },
  { name: '김경주', part: 'mobile', gender: 'female' },
  { name: '강명숙', part: 'mobile', gender: 'female' },
]

export const TEAM_NAMES = ['RYAN TEAM', 'MUZI TEAM', 'APEACH TEAM']
export const TEAM_SIZES = [4, 4, 5]
const FIRST_STAGE_NAMES = ['박보라', '이진영', '손민혁', '이정인', '박지은', '김수정']

function balanceScore(
  teams: Team[],
  targetSizes: number[],
  totalParticipants: number,
  totalMobile: number,
  totalFemale: number,
): number {
  return teams.reduce((score, team, index) => {
    const mobile = team.members.filter((person) => person.part === 'mobile').length
    const female = team.members.filter((person) => person.gender === 'female').length
    const targetSize = targetSizes[index]
    return score
      + 4 * (mobile - (totalMobile * targetSize) / totalParticipants) ** 2
      + 4 * (female - (totalFemale * targetSize) / totalParticipants) ** 2
  }, 0)
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function isValidAssignment(value: unknown): value is Team[] {
  if (!Array.isArray(value) || value.length !== TEAM_NAMES.length) return false
  const teams = value as Team[]
  if (!teams.every((team, index) => team?.name === TEAM_NAMES[index]
    && Array.isArray(team.members) && team.members.length === TEAM_SIZES[index])) return false

  const members = teams.flatMap((team) => team.members)
  const names = members.map((member) => member.name)
  const firstStageCounts = teams.map((team) =>
    team.members.filter((member) => FIRST_STAGE_NAMES.includes(member.name)).length,
  )
  return names.length === PARTICIPANTS.length
    && new Set(names).size === PARTICIPANTS.length
    && PARTICIPANTS.every((participant) => names.includes(participant.name))
    && firstStageCounts.filter((count) => count === 3).length === 2
    && firstStageCounts.filter((count) => count === 0).length === 1
    && firstStageCounts.every((count) => count === 0 || count === 3)
}

/** Balances the priority group first, then balances all 13 participants. */
export function generateTeamAssignment(): Team[] {
  const priority = FIRST_STAGE_NAMES.map((name) => PARTICIPANTS.find((person) => person.name === name)!)
  const remaining = PARTICIPANTS.filter((person) => !FIRST_STAGE_NAMES.includes(person.name))
  const firstStageCandidates: { teams: Team[]; score: number; teamPair: string }[] = []

  function assignPriority(
    index: number,
    firstTeamIndex: number,
    secondTeamIndex: number,
    firstMembers: Participant[],
    secondMembers: Participant[],
  ) {
    if (index === priority.length) {
      if (firstMembers.length !== 3 || secondMembers.length !== 3) return
      const teams: Team[] = TEAM_NAMES.map((name, teamIndex) => ({
        name,
        members: teamIndex === firstTeamIndex
          ? [...firstMembers]
          : teamIndex === secondTeamIndex ? [...secondMembers] : [],
      }))
      firstStageCandidates.push({
        teams,
        score: balanceScore([teams[firstTeamIndex], teams[secondTeamIndex]], [3, 3], 6, 1, 3),
        teamPair: `${firstTeamIndex}/${secondTeamIndex}`,
      })
      return
    }

    const person = priority[index]
    if (firstMembers.length < 3) {
      assignPriority(index + 1, firstTeamIndex, secondTeamIndex, [...firstMembers, person], secondMembers)
    }
    if (secondMembers.length < 3) {
      assignPriority(index + 1, firstTeamIndex, secondTeamIndex, firstMembers, [...secondMembers, person])
    }
  }

  for (let firstTeamIndex = 0; firstTeamIndex < TEAM_NAMES.length; firstTeamIndex += 1) {
    for (let secondTeamIndex = firstTeamIndex + 1; secondTeamIndex < TEAM_NAMES.length; secondTeamIndex += 1) {
      assignPriority(0, firstTeamIndex, secondTeamIndex, [], [])
    }
  }

  // First compare team pairs by their best internal split, then randomly choose
  // among equally balanced pairs before assigning the remaining participants.
  const pairScores = new Map<string, number>()
  firstStageCandidates.forEach(({ score, teamPair }) => {
    const previousScore = pairScores.get(teamPair)
    if (previousScore === undefined || score < previousScore) pairScores.set(teamPair, score)
  })
  const bestFirstStageScore = Math.min(...pairScores.values())
  const bestTeamPairs = [...pairScores.entries()]
    .filter(([, score]) => score === bestFirstStageScore)
    .map(([teamPair]) => teamPair)
  const selectedTeamPair = shuffle(bestTeamPairs)[0]
  const selectedFirstStageScore = pairScores.get(selectedTeamPair)!
  const selectedFirstStageCandidates = firstStageCandidates.filter(({ score, teamPair }) =>
    teamPair === selectedTeamPair && score === selectedFirstStageScore,
  )
  const completedCandidates: { teams: Team[]; score: number }[] = []

  function assignRemaining(teams: Team[], index: number) {
    if (index === remaining.length) {
      if (!isValidAssignment(teams)) return
      completedCandidates.push({
        teams,
        score: balanceScore(teams, TEAM_SIZES, PARTICIPANTS.length, 7, 7),
      })
      return
    }

    const person = remaining[index]
    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
      if (teams[teamIndex].members.length >= TEAM_SIZES[teamIndex]) continue
      const nextTeams = teams.map((team, currentIndex) => currentIndex === teamIndex
        ? { ...team, members: [...team.members, person] }
        : team)
      assignRemaining(nextTeams, index + 1)
    }
  }

  // Keep the selected pair and best stage-one score fixed, then use the final
  // score to choose among equally balanced internal splits and their completions.
  selectedFirstStageCandidates.forEach(({ teams }) => assignRemaining(teams, 0))
  if (completedCandidates.length === 0) throw new Error('유효한 팀 배정을 만들 수 없습니다.')

  const bestScore = Math.min(...completedCandidates.map(({ score }) => score))
  const bestCandidates = completedCandidates.filter(({ score }) => score === bestScore)
  return shuffle(bestCandidates)[0].teams
}

export function isTeamAssignmentValid(value: unknown): value is Team[] {
  return isValidAssignment(value)
}
