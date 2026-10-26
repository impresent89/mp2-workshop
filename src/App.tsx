import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { generateTeamAssignment, TEAM_NAMES, TEAM_SIZES, type Team } from './lib/teamAssignment'
import { deleteGameRecord, loadGameRecords, rankTeamTotals, saveGameRecord, subscribeToGameRecords, type GameRecord } from './lib/teamScores'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Page = 'assignment' | 'scoreboard' | 'manage'

const teamEmojis = ['🧸', '🌿', '🍑']
const teamColors = ['ryan', 'muzi', 'apeach']
const pageLabels: Record<Page, string> = {
  assignment: '팀 배정',
  scoreboard: '팀별 점수판',
  manage: '점수 관리',
}

function emptyTeamScores(): Record<string, string> {
  return Object.fromEntries(TEAM_NAMES.map((teamName) => [teamName, '']))
}

export default function App() {
  const [teams, setTeams] = useState<Team[]>(generateTeamAssignment)
  const [page, setPage] = useState<Page>('assignment')
  const [gameRecords, setGameRecords] = useState<GameRecord[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const [gameName, setGameName] = useState('')
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>(emptyTeamScores)
  const [message, setMessage] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const rankedTeams = useMemo(() => rankTeamTotals(gameRecords), [gameRecords])
  const isAdmin = session?.user.app_metadata?.workshop_role === 'admin'

  useEffect(() => {
    let active = true
    const refreshRecords = async () => {
      if (!isSupabaseConfigured) {
        if (active) {
          setDataError('Supabase 환경변수를 설정해야 점수 데이터를 불러올 수 있습니다.')
          setRecordsLoading(false)
        }
        return
      }
      try {
        const records = await loadGameRecords()
        if (active) {
          setGameRecords(records)
          setDataError('')
        }
      } catch {
        if (active) setDataError('점수 데이터를 불러오지 못했습니다. Supabase 설정과 RLS를 확인해주세요.')
      } finally {
        if (active) setRecordsLoading(false)
      }
    }

    void refreshRecords()
    const unsubscribe = subscribeToGameRecords(() => { void refreshRecords() })
    const authSubscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    }).data.subscription

    return () => {
      active = false
      unsubscribe()
      authSubscription?.unsubscribe()
    }
  }, [])

  function redrawTeams() {
    setTeams(generateTeamAssignment())
  }

  function selectPage(nextPage: Page) {
    setPage(nextPage)
    setMessage('')
  }

  function startNewGame() {
    setEditingGameId(null)
    setGameName('')
    setScoreInputs(emptyTeamScores())
    setEditorOpen(true)
    setMessage('')
  }

  function editGame(record: GameRecord) {
    setEditingGameId(record.id)
    setGameName(record.name)
    setScoreInputs(Object.fromEntries(TEAM_NAMES.map((teamName) => [teamName, String(record.scores[teamName] ?? 0)])))
    setEditorOpen(true)
    setMessage('')
  }

  async function submitGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gameName.trim()) {
      setMessage('게임 이름을 입력해주세요.')
      return
    }
    const scores = Object.fromEntries(TEAM_NAMES.map((teamName) => {
      const input = scoreInputs[teamName]?.trim() ?? ''
      return [teamName, input === '' ? 0 : Number(input)]
    })) as Record<string, number>
    if (TEAM_NAMES.some((teamName) => !Number.isSafeInteger(scores[teamName]) || scores[teamName] < 0)) {
      setMessage('각 팀에 0 이상의 정수 점수를 입력해주세요.')
      return
    }
    try {
      const updatedRecords = await saveGameRecord({
        id: editingGameId ?? undefined,
        name: gameName,
        scores,
      })
      setGameRecords(updatedRecords)
      setEditorOpen(false)
      setEditingGameId(null)
      setMessage('게임 점수를 저장했습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '게임 기록을 저장하지 못했습니다.')
    }
  }

  async function removeGame(id: string) {
    try {
      setGameRecords(await deleteGameRecord(id))
      if (editingGameId === id) {
        setEditorOpen(false)
        setEditingGameId(null)
      }
      setMessage('게임 기록을 삭제했습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '게임 기록을 삭제하지 못했습니다.')
    }
  }

  async function signInAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setAuthMessage('Supabase 환경변수를 먼저 설정해주세요.')
      return
    }
    setAuthMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    if (error) {
      console.error('[Admin Login Error]', error)
      setAuthMessage(`로그인 실패: ${error.message}`)
      return
    }
    setAdminPassword('')
    setAuthMessage(data.user.app_metadata?.workshop_role === 'admin'
      ? '관리자 인증을 완료했습니다.'
      : '로그인 계정에 workshop_role=admin 권한이 없습니다.')
  }

  async function signOutAdmin() {
    await supabase?.auth.signOut()
    setAuthMessage('로그아웃했습니다.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MP2 워크숍 팀 배정" onClick={(event) => { event.preventDefault(); selectPage('assignment') }}>
          <span className="brand-name">MP2 WORKSHOP</span>
        </a>
        <nav className="main-nav" aria-label="주요 메뉴">
          {(Object.keys(pageLabels) as Page[]).map((item) => (
            <button className={`nav-link${page === item ? ' active' : ''}`} type="button" aria-current={page === item ? 'page' : undefined} key={item} onClick={() => selectPage(item)}>
              {pageLabels[item]}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {dataError && <p className="data-status-message" role="status">{dataError}</p>}
        {page === 'assignment' && <AssignmentPage teams={teams} onRedraw={redrawTeams} isAdmin={isAdmin} />}
        {page === 'scoreboard' && <ScoreboardPage rankedTeams={rankedTeams} gameRecords={gameRecords} loading={recordsLoading} />}
        {page === 'manage' && (isAdmin
          ? <ManagePage
            gameRecords={gameRecords}
            editorOpen={editorOpen}
            editingGameId={editingGameId}
            gameName={gameName}
            scoreInputs={scoreInputs}
            message={message}
            loading={recordsLoading}
            onStartNew={startNewGame}
            onEdit={editGame}
            onDelete={removeGame}
            onNameChange={setGameName}
            onScoreChange={(teamName, value) => setScoreInputs((current) => ({ ...current, [teamName]: value }))}
            onSubmit={submitGame}
            onCancel={() => { setEditorOpen(false); setEditingGameId(null); setMessage('') }}
            onSignOut={signOutAdmin}
          />
          : <AdminLoginPage signedIn={Boolean(session)} email={adminEmail} password={adminPassword} message={authMessage} onEmailChange={setAdminEmail} onPasswordChange={setAdminPassword} onSubmit={signInAdmin} onSignOut={signOutAdmin} />)}
      </main>

      <footer className="footer"><span>MP2 WORKSHOP</span></footer>
    </div>
  )
}

function AssignmentPage({ teams, onRedraw, isAdmin }: { teams: Team[]; onRedraw: () => void; isAdmin: boolean }) {
  return (
    <section className="page assignment-page">
      <div className="participant-hero">
        <div className="page-kicker"><span className="kicker-line" /> MP2 · WORKSHOP</div>
        <h1>오늘의 팀을 확인해요</h1>
        <p>13명의 참가자가 세 팀으로 나뉘었어요.</p>
      </div>
      <div className="assignment-toolbar">
        <p>우선 배정과 파트·성별 균형을 반영한 팀 구성입니다.</p>
        {isAdmin && <button className="button button-regenerate" type="button" onClick={onRedraw}>다시 배정</button>}
      </div>
      <section className="assignment-grid" aria-label="팀 배정 결과" aria-live="polite">
        {teams.map((team, index) => {
          const mobile = team.members.filter((person) => person.part === 'mobile').length
          const female = team.members.filter((person) => person.gender === 'female').length
          return (
            <article className={`assignment-team team-card-${teamColors[index]}`} key={team.name}>
              <div className="assignment-team-heading">
                <span className={`assignment-team-icon team-color-${index + 1}`}>{teamEmojis[index]}</span>
                <div>
                  <h2>{team.name}</h2>
                  <small className="assignment-team-theme">{team.theme}</small>
                  <span>{team.members.length} / {TEAM_SIZES[index]}명</span>
                </div>
              </div>
              <div className="assignment-stats">
                <span>모바일 <strong>{mobile}</strong></span>
                <span>PC <strong>{team.members.length - mobile}</strong></span>
                <span>여성 <strong>{female}</strong></span>
                <span>남성 <strong>{team.members.length - female}</strong></span>
              </div>
              <ul className="assignment-members">{team.members.map((person) => <li key={person.name}><span className="member-name">{person.name}</span><span className="member-meta">{person.part === 'mobile' ? 'Mobile' : 'PC'} · {person.gender === 'female' ? '여성' : '남성'}</span></li>)}</ul>
            </article>
          )
        })}
      </section>
    </section>
  )
}

function ScoreboardPage({ rankedTeams, gameRecords, loading }: { rankedTeams: ReturnType<typeof rankTeamTotals>; gameRecords: GameRecord[]; loading: boolean }) {
  return (
    <section className="page score-page">
      <PageHeading eyebrow="TEAM SCOREBOARD" title="팀별 점수판" description="게임별 점수와 전체 누적 점수를 확인해요." />
      <div className="scoreboard-list" aria-label="팀 누적 점수 순위">
        {rankedTeams.map((team) => (
          <article className={`scoreboard-card team-card-${teamColors[team.teamIndex]}`} key={team.teamName}>
            <div className="rank-badge">{team.rank}<small>위</small></div>
            <span className={`assignment-team-icon team-color-${team.teamIndex + 1}`} aria-hidden="true">{teamEmojis[team.teamIndex]}</span>
            <div className="scoreboard-team-name"><h2>{team.teamName}</h2><span>누적 점수</span></div>
            <div className="scoreboard-points">{team.total}<small>점</small></div>
          </article>
        ))}
      </div>

      <section className="game-score-breakdown" aria-labelledby="game-breakdown-title">
        <div className="section-heading"><h2 id="game-breakdown-title">게임별 점수</h2><span>{gameRecords.length}개 게임</span></div>
        {loading
          ? <p className="empty-scores">점수를 불러오는 중입니다.</p>
          : gameRecords.length === 0
          ? <p className="empty-scores">아직 게임 기록이 없습니다. 점수 관리에서 첫 게임을 추가해주세요.</p>
          : <div className="score-table-scroll"><table className="score-table">
            <thead><tr><th scope="col">팀</th>{gameRecords.map((record) => <th scope="col" key={record.id}>{record.name}</th>)}<th scope="col">누적</th></tr></thead>
            <tbody>{rankedTeams.map((team) => <tr key={team.teamName}>
              <th scope="row"><span className="table-team-name">{team.teamName}</span><span className="table-rank">{team.rank}위</span></th>
              {gameRecords.map((record) => <td key={record.id}>{record.scores[team.teamName] ?? 0}</td>)}
              <td className="table-total">{team.total}</td>
            </tr>)}</tbody>
          </table></div>}
      </section>
      <p className="local-storage-note">점수는 Supabase에서 여러 기기와 실시간 공유됩니다.</p>
    </section>
  )
}

function ManagePage({ gameRecords, editorOpen, editingGameId, gameName, scoreInputs, message, loading, onStartNew, onEdit, onDelete, onNameChange, onScoreChange, onSubmit, onCancel, onSignOut }: {
  gameRecords: GameRecord[]
  editorOpen: boolean
  editingGameId: string | null
  gameName: string
  scoreInputs: Record<string, string>
  message: string
  loading: boolean
  onStartNew: () => void
  onEdit: (record: GameRecord) => void
  onDelete: (id: string) => void
  onNameChange: (value: string) => void
  onScoreChange: (teamName: string, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onSignOut: () => void
}) {
  return (
    <section className="page manage-page">
      <div className="page-heading page-heading-row"><div><PageHeading eyebrow="SCORE MANAGEMENT" title="점수 관리" description="게임별 기록을 추가하고 점수를 관리하세요." /></div>
        <div className="admin-actions"><button className="button button-edit" type="button" onClick={onSignOut}>로그아웃</button><button className="button button-regenerate add-game-button" type="button" onClick={onStartNew}>＋ 새 게임 추가</button></div>
      </div>

      {editorOpen && <form className="game-form" onSubmit={onSubmit}>
        <div className="game-form-heading"><div><span className="eyebrow">{editingGameId ? 'EDIT GAME' : 'NEW GAME'}</span><h2>{editingGameId ? '게임 기록 수정' : '새 게임 기록'}</h2></div><button className="text-button" type="button" onClick={onCancel}>닫기</button></div>
        <label htmlFor="game-name">게임 이름</label>
        <input id="game-name" type="text" maxLength={80} value={gameName} onChange={(event) => onNameChange(event.target.value)} placeholder="예: 아이디어 스피드 게임" required />
        <fieldset className="game-team-scores"><legend>팀별 점수 <small>입력하지 않은 팀은 0점으로 저장됩니다</small></legend>
          {TEAM_NAMES.map((teamName, index) => <label className="game-team-score-input" key={teamName} htmlFor={`score-${index}`}>
            <span className={`assignment-team-icon team-color-${index + 1}`} aria-hidden="true">{teamEmojis[index]}</span>
            <span className="game-team-label">{teamName}</span>
            <input id={`score-${index}`} type="number" min="0" step="1" inputMode="numeric" value={scoreInputs[teamName] ?? ''} onChange={(event) => onScoreChange(teamName, event.target.value)} placeholder="0" />
            <small>점</small>
          </label>)}
        </fieldset>
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="game-form-actions"><button className="button button-regenerate" type="submit">{editingGameId ? '변경 내용 저장' : '게임 점수 저장'}</button><button className="button button-edit" type="button" onClick={onCancel}>취소</button></div>
      </form>}

      {message && !editorOpen && <p className="form-message manage-message" role="status">{message}</p>}
      <section className="saved-scores" aria-labelledby="saved-games-title">
        <div className="section-heading"><h2 id="saved-games-title">게임 기록</h2><span>{gameRecords.length}개 게임</span></div>
        {loading
          ? <p className="empty-scores">게임 기록을 불러오는 중입니다.</p>
          : gameRecords.length === 0
          ? <p className="empty-scores">아직 게임 기록이 없습니다. 새 게임을 추가해 점수를 입력해주세요.</p>
          : <div className="game-record-list">{gameRecords.map((record) => <article className="game-record-card" key={record.id}>
            <div className="game-record-heading"><div><h3>{record.name}</h3><time dateTime={record.updatedAt}>수정 {new Date(record.updatedAt).toLocaleString('ko-KR')}</time></div>
              <div className="game-record-actions"><button className="button button-edit" type="button" onClick={() => onEdit(record)}>수정</button><button className="button button-delete" type="button" onClick={() => onDelete(record.id)}>삭제</button></div>
            </div>
            <div className="game-record-scores">{TEAM_NAMES.map((teamName, index) => <span key={teamName}><i className={`team-dot team-dot-${index + 1}`} />{teamName}<strong>{record.scores[teamName] ?? 0}점</strong></span>)}</div>
          </article>)}</div>}
      </section>
      <p className="local-storage-note">관리자 권한은 Supabase Auth와 데이터베이스 RLS에서 확인합니다.</p>
    </section>
  )
}

function AdminLoginPage({ signedIn, email, password, message, onEmailChange, onPasswordChange, onSubmit, onSignOut }: {
  signedIn: boolean
  email: string
  password: string
  message: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSignOut: () => void
}) {
  return (
    <section className="page manage-page">
      <PageHeading eyebrow="ADMIN SIGN IN" title="점수 관리 로그인" description="점수 변경은 인증된 운영자만 할 수 있습니다." />
      <form className="admin-login-form" onSubmit={onSubmit}>
        <label htmlFor="admin-email">운영자 이메일</label>
        <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => onEmailChange(event.target.value)} required />
        <label htmlFor="admin-password">비밀번호</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required />
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="button button-regenerate" type="submit">로그인</button>
        {signedIn && <button className="button button-edit" type="button" onClick={onSignOut}>다른 계정으로 로그아웃</button>}
      </form>
    </section>
  )
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
}
