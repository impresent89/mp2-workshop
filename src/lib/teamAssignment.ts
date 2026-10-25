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

const PRIORITY_NAMES = ['박보라', '이진영', '손민혁', '이정인', '박지은']
const SEPARATE_NAME = '김수정'

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
    && Array.isArray(team.members)
    && team.members.length === TEAM_SIZES[index],
  )) return false

  const members = teams.flatMap((team) => team.members)
  const names = members.map((member) => member.name)

  if (
    names.length !== PARTICIPANTS.length
    || new Set(names).size !== PARTICIPANTS.length
    || !PARTICIPANTS.every((participant) => names.includes(participant.name))
  ) return false

  const priorityCounts = teams.map((team) =>
    team.members.filter((member) => PRIORITY_NAMES.includes(member.name)).length,
  ).sort((a, b) => a - b)

  const separateTeam = teams.find((team) =>
    team.members.some((member) => member.name === SEPARATE_NAME),
  )

  return priorityCounts.join(',') === '0,2,3'
    && separateTeam !== undefined
    && separateTeam.members.filter((member) =>
      PRIORITY_NAMES.includes(member.name),
    ).length === 0
}

/** 모든 우선배정 조합과 나머지 참가자 배정을 비교해 최적 균형 팀을 생성합니다. */
export function generateTeamAssignment(): Team[] {
  const priority = PRIORITY_NAMES.map((name) =>
    PARTICIPANTS.find((person) => person.name === name)!,
  )
  const separate = PARTICIPANTS.find((person) => person.name === SEPARATE_NAME)!
  const remaining = PARTICIPANTS.filter((person) =>
    !PRIORITY_NAMES.includes(person.name) && person.name !== SEPARATE_NAME,
  )

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

  // 김수정이 배정될 팀을 먼저 선택합니다.
  for (let separateTeamIndex = 0; separateTeamIndex < TEAM_NAMES.length; separateTeamIndex += 1) {
    const otherTeamIndexes = TEAM_NAMES
      .map((_, index) => index)
      .filter((index) => index !== separateTeamIndex)

    // 나머지 두 팀 중 한 팀에 우선배정자 2명, 다른 팀에 3명을 배정합니다.
    for (const twoPersonTeamIndex of otherTeamIndexes) {

      // 우선배정자 5명 중 2명을 선택하는 모든 조합을 탐색합니다.
      for (let first = 0; first < priority.length; first += 1) {
        for (let second = first + 1; second < priority.length; second += 1) {
          const twoPeople = [priority[first], priority[second]]
          const threePeople = priority.filter(
            (_, index) => index !== first && index !== second,
          )

          const teams: Team[] = TEAM_NAMES.map((name, index) => ({
            name,
            members: index === separateTeamIndex
              ? [separate]
              : index === twoPersonTeamIndex
                ? [...twoPeople]
                : [...threePeople],
          }))

          assignRemaining(teams, 0)
        }
      }
    }
  }

  if (bestCandidates.length === 0) {
    throw new Error('유효한 팀 배정을 만들 수 없습니다.')
  }

  return shuffle(bestCandidates)[0]
}

export function isTeamAssignmentValid(value: unknown): value is Team[] {
  return isValidAssignment(value)
}
