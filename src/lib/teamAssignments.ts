import {
  isTeamAssignmentValid,
  PARTICIPANTS,
  TEAM_NAMES,
  type Team,
} from './teamAssignment'
import { supabase } from './supabase'

type CurrentAssignmentRow = {
  assignment_id: string | null
}

type AssignmentRow = {
  id: string
  themes: Record<string, string> | null
}

type MemberRow = {
  team_id: string
  participant_name: string
}

type TeamRow = {
  id: string
  name: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase 환경변수를 설정해주세요.')
  return supabase
}

/**
 * 현재 배정을 불러온다.
 * 테마가 없는 과거 기록은 유효한 배정으로 취급하지 않는다.
 */
export async function loadCurrentTeamAssignment(): Promise<Team[] | null> {
  const client = requireSupabase()

  const { data: current, error: currentError } = await client
    .from('workshop_current_assignment')
    .select('assignment_id')
    .eq('id', true)
    .maybeSingle()

  if (currentError) throw currentError

  const currentRow = current as CurrentAssignmentRow | null

  if (!currentRow?.assignment_id) return null

  const assignmentId = currentRow.assignment_id

  const [
    { data: assignmentData, error: assignmentError },
    { data: memberData, error: memberError },
    { data: teamData, error: teamError },
  ] = await Promise.all([
    client
      .from('workshop_team_assignments')
      .select('id, themes')
      .eq('id', assignmentId)
      .single(),
    client
      .from('workshop_team_members')
      .select('team_id, participant_name')
      .eq('assignment_id', assignmentId),
    client
      .from('workshop_teams')
      .select('id, name'),
  ])

  if (assignmentError) throw assignmentError
  if (memberError) throw memberError
  if (teamError) throw teamError

  const assignment = assignmentData as AssignmentRow
  const members = (memberData ?? []) as MemberRow[]
  const dbTeams = (teamData ?? []) as TeamRow[]

  const themes = assignment.themes

  if (
    !themes ||
    TEAM_NAMES.some((name) => !themes[name])
  ) {
    throw new Error(
      '기존 배정 기록에는 테마 정보가 없습니다. 관리자에게 새 배정을 요청해주세요.',
    )
  }

  const teamNameById = new Map(
    dbTeams.map((team) => [team.id, team.name]),
  )

  const loadedTeams: Team[] = TEAM_NAMES.map((teamName) => {
    const dbTeam = dbTeams.find((team) => team.name === teamName)

    if (!dbTeam) {
      throw new Error(`데이터베이스에서 ${teamName} 정보를 찾을 수 없습니다.`)
    }

    const teamMembers = members
      .filter((member) => member.team_id === dbTeam.id)
      .map((member) => {
        const participant = PARTICIPANTS.find(
          (person) => person.name === member.participant_name,
        )

        if (!participant) {
          throw new Error(
            `참가자 정보를 찾을 수 없습니다: ${member.participant_name}`,
          )
        }

        return participant
      })
      .sort(
        (a, b) =>
          PARTICIPANTS.findIndex((person) => person.name === a.name) -
          PARTICIPANTS.findIndex((person) => person.name === b.name),
      )

    return {
      name: teamName,
      theme: themes[teamName] as Team['theme'],
      members: teamMembers,
    }
  })

  // 모든 DB 팀이 실제로 조회되었는지 확인
  if (teamNameById.size < TEAM_NAMES.length) {
    throw new Error('팀 정보를 모두 불러오지 못했습니다.')
  }

  if (!isTeamAssignmentValid(loadedTeams)) {
    throw new Error('저장된 팀 배정 데이터가 유효하지 않습니다.')
  }

  return loadedTeams
}

/**
 * 관리자 전용 RPC를 통해 새 배정을 저장하고 현재 배정으로 지정한다.
 */
export async function saveTeamAssignment(teams: Team[]): Promise<void> {
  if (!isTeamAssignmentValid(teams)) {
    throw new Error('유효하지 않은 팀 배정입니다. 저장할 수 없습니다.')
  }

  const { error } = await requireSupabase().rpc(
    'mp2_save_workshop_assignment',
    {
      p_teams: teams,
    },
  )

  if (error) throw error
}

/**
 * 다른 사용자의 재배정 결과를 실시간으로 감지한다.
 */
export function subscribeToTeamAssignmentChanges(onChange: () => void) {
  if (!supabase) return () => undefined

  const channel = supabase
    .channel('mp2-workshop-team-assignment')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workshop_current_assignment',
      },
      onChange,
    )
    .subscribe()

  return () => {
    void supabase?.removeChannel(channel)
  }
}