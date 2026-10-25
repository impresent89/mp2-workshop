import { TEAM_NAMES } from './teamAssignment'
import { supabase } from './supabase'

export const TEAM_IDS = {
  'RYAN TEAM': '00000000-0000-4000-8000-000000000001',
  'MUZI TEAM': '00000000-0000-4000-8000-000000000002',
  'APEACH TEAM': '00000000-0000-4000-8000-000000000003',
} as const
type TeamName = keyof typeof TEAM_IDS

export type GameRecord = {
  id: string
  name: string
  scores: Record<string, number>
  createdAt: string
  updatedAt: string
}

export type RankedTeamTotal = {
  teamName: string
  teamIndex: number
  total: number
  rank: number
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase 환경변수를 설정해주세요.')
  return supabase
}

/** Loads shared game records. The previous localStorage keys are intentionally not imported. */
export async function loadGameRecords(): Promise<GameRecord[]> {
  const client = requireSupabase()
  const [{ data: games, error: gamesError }, { data: scoreRows, error: scoresError }] = await Promise.all([
    client.from('workshop_games').select('id, name, created_at, updated_at, display_order').order('display_order').order('created_at'),
    client.from('workshop_game_scores').select('game_id, team_id, score'),
  ])
  if (gamesError) throw gamesError
  if (scoresError) throw scoresError

  const scoresByGame = new Map<string, Record<string, number>>()
  for (const row of scoreRows ?? []) {
    const teamName = (Object.keys(TEAM_IDS) as TeamName[]).find((name) => TEAM_IDS[name] === row.team_id)
    if (!teamName) continue
    const scores = scoresByGame.get(row.game_id) ?? Object.fromEntries(TEAM_NAMES.map((name) => [name, 0]))
    scores[teamName] = row.score
    scoresByGame.set(row.game_id, scores)
  }

  return (games ?? []).map((game) => ({
    id: game.id,
    name: game.name,
    scores: scoresByGame.get(game.id) ?? Object.fromEntries(TEAM_NAMES.map((name) => [name, 0])),
    createdAt: game.created_at,
    updatedAt: game.updated_at,
  }))
}

export async function saveGameRecord(input: { id?: string; name: string; scores: Record<string, number> }): Promise<GameRecord[]> {
  const name = input.name.trim()
  if (!name) throw new Error('게임 이름을 입력해주세요.')
  if (!TEAM_NAMES.every((teamName) => Number.isSafeInteger(input.scores[teamName]) && input.scores[teamName] >= 0)) {
    throw new Error('세 팀에 0 이상의 정수 점수를 입력해주세요.')
  }

  const { data: id, error } = await requireSupabase().rpc('mp2_save_workshop_game', {
    p_game_id: input.id ?? null,
    p_name: name,
    p_scores: Object.fromEntries(TEAM_NAMES.map((teamName) => [TEAM_IDS[teamName as TeamName], input.scores[teamName]])),
  })
  if (error) throw error
  if (typeof id !== 'string') throw new Error('게임 기록 저장 결과가 올바르지 않습니다.')
  return loadGameRecords()
}

export async function deleteGameRecord(id: string): Promise<GameRecord[]> {
  const { error } = await requireSupabase().from('workshop_games').delete().eq('id', id)
  if (error) throw error
  return loadGameRecords()
}

/** Subscribe to both game metadata and score rows; either change refreshes the shared view. */
export function subscribeToGameRecords(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase.channel('mp2-workshop-game-scores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_games' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_game_scores' }, onChange)
    .subscribe()
  return () => { void supabase?.removeChannel(channel) }
}

export function rankTeamTotals(records: GameRecord[]): RankedTeamTotal[] {
  const ranked = TEAM_NAMES.map((teamName, teamIndex) => ({
    teamName,
    teamIndex,
    total: records.reduce((sum, record) => sum + (record.scores[teamName] ?? 0), 0),
  })).sort((a, b) => b.total - a.total || a.teamIndex - b.teamIndex)

  let currentRank = 0
  let previousTotal: number | undefined
  return ranked.map((team, index) => {
    if (team.total !== previousTotal) currentRank = index + 1
    previousTotal = team.total
    return { ...team, rank: currentRank }
  })
}
