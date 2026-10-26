export type Participant = {
  name: string
  part: 'mobile' | 'pc'
  gender: 'female' | 'male'
}

export type ThemeName = '해리포터' | '검은집' | '기억상실'

export type Team = {
  name: string
  theme: ThemeName
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

const THEMES: ThemeName[] = ['해리포터', '검은집', '기억상실']
const PRIORITY_NAMES = ['박보라', '이진영', '손민혁', '이정인', '박지은']
const MEMORY_NAME = '김수정'

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

  if (!teams.every((team, index) =>
    team?.name === TEAM_NAMES[index]
    && THEMES.includes(team.theme)
    && Array.isArray(team.members)
    && team.members.length === TEAM_SIZES[index],
  )) return false

  if (new Set(teams.map((team) => team.theme)).size !== THEMES.length) {
    return false
  }

  const members = teams.flatMap((team) => team.members)
  const names = members.map((member) => member.name)

  if (
    names.length !== PARTICIPANTS.length
    || new Set(names).size !== PARTICIPANTS.length
    || !PARTICIPANTS.every((participant) => names.includes(participant.name))
  ) return false

  const memoryTeam = teams.find((team) => team.theme === '기억상실')
  const harryTeam = teams.find((team) => team.theme === '해리포터')
  const blackTeam = teams.find((team) => team.theme === '검은집')

  if (!memoryTeam || !harryTeam || !blackTeam) return false

  if (!memoryTeam.members.some((member) => member.name === MEMORY_NAME)) {
    return false
  }

  const priorityCount = (team: Team) =>
    team.members.filter((member) => PRIORITY_NAMES.includes(member.name)).length

  const counts = [priorityCount(harryTeam), priorityCount(memoryTeam)].sort(
    (a, b) => a - b,
  )

  return counts[0] === 2
    && counts[1] === 3
    && priorityCount(blackTeam) === 0
}

export function generateTeamAssignment(): Team[] {
  const priority = PRIORITY_NAMES.map((name) =>
    PARTICIPANTS.find((person) => person.name === name)!,
  )

  const memory = PARTICIPANTS.find((person) => person.name === MEMORY_NAME)!

  const remaining = PARTICIPANTS.filter((person) =>
    !PRIORITY_NAMES.includes(person.name) && person.name !== MEMORY_NAME,
  )

  // 매번 세 테마를 기존 팀에 무작위 연결합니다.
  const themesByTeam = shuffle(THEMES)

  const memoryTeamIndex = themesByTeam.indexOf('기억상실')
  const harryTeamIndex = themesByTeam.indexOf('해리포터')

  let bestScore = Infinity
  let bestCandidates: Team[][] = []

  function evaluate(teams: Team[]) {
    if (!isValidAssignment(teams)) return

    const score = balanceScore(
      teams,
      TEAM_SIZES,
      PARTICIPANTS.length,
      7,
      7,
    )

    if (score < bestScore - 1e-9) {
      bestScore = score
      bestCandidates = [teams]
    } else if (Math.abs(score - bestScore) < 1e-9) {
      bestCandidates.push(teams)
    }
  }

  function assignRemaining(teams: Team[], index: number) {
    if (index === remaining.length) {
      evaluate(teams)
      return
    }

    const person = remaining[index]

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
      if (teams[teamIndex].members.length >= TEAM_SIZES[teamIndex]) continue

      const nextTeams = teams.map((team, currentIndex) =>
        currentIndex === teamIndex
          ? { ...team, members: [...team.members, person] }
          : team,
      )

      assignRemaining(nextTeams, index + 1)
    }
  }

  // 우선 배정자 5명 중 2명을 선택하는 모든 조합을 탐색합니다.
  for (let first = 0; first < priority.length; first += 1) {
    for (let second = first + 1; second < priority.length; second += 1) {
      const twoPeople = [priority[first], priority[second]]
      const threePeople = priority.filter(
        (_, index) => index !== first && index !== second,
      )

      // 해리포터에 2명, 기억상실에 3명
      // 또는 해리포터에 3명, 기억상실에 2명
      for (const twoPersonTeamIndex of [harryTeamIndex, memoryTeamIndex]) {
        const threePersonTeamIndex =
          twoPersonTeamIndex === harryTeamIndex
            ? memoryTeamIndex
            : harryTeamIndex

        const twoPersonMembers =
          twoPersonTeamIndex === memoryTeamIndex
            ? [memory, ...twoPeople]
            : twoPeople

        const threePersonMembers =
          threePersonTeamIndex === memoryTeamIndex
            ? [memory, ...threePeople]
            : threePeople

        const teams: Team[] = TEAM_NAMES.map((name, index) => ({
          name,
          theme: themesByTeam[index],
          members: index === twoPersonTeamIndex
            ? [...twoPersonMembers]
            : index === threePersonTeamIndex
              ? [...threePersonMembers]
              : [],
        }))

        assignRemaining(teams, 0)
      }
    }
  }

  if (bestCandidates.length === 0) {
    throw new Error('유효한 테마별 팀 배정을 만들 수 없습니다.')
  }

  return shuffle(bestCandidates)[0]
}

export function isTeamAssignmentValid(value: unknown): value is Team[] {
  return isValidAssignment(value)
}
