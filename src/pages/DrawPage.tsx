import { useEffect, useState } from 'react'
import {
  loadOrCreateTeamAssignment,
  PARTICIPANTS,
  regenerateTeamAssignment,
  type Team,
} from '../lib/teamAssignment'

const DRAWN_STORAGE_KEY = 'mp2-workshop-drawn-participants-v1'
const teamStyles = ['ryan', 'muzi', 'apeach']

function loadDrawnParticipants(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DRAWN_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : []
  } catch {
    return []
  }
}

export default function DrawPage() {
  const [teams, setTeams] = useState<Team[]>(loadOrCreateTeamAssignment)
  const [drawn, setDrawn] = useState<string[]>(loadDrawnParticipants)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [stage, setStage] = useState<'choose' | 'drawing' | 'result'>('choose')

  useEffect(() => {
    if (stage !== 'drawing') return
    const timer = window.setTimeout(() => {
      setStage('result')
      setDrawn((current) => {
        const next = current.includes(selectedName ?? '') ? current : [...current, selectedName ?? '']
        try { localStorage.setItem(DRAWN_STORAGE_KEY, JSON.stringify(next)) } catch { /* memory state still works */ }
        return next
      })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [stage, selectedName])

  function selectParticipant(name: string) {
    setSelectedName(name)
    setStage(drawn.includes(name) ? 'result' : 'drawing')
  }

  function createNewAssignment() {
    setTeams(regenerateTeamAssignment())
  }

  const participantTeam = teams.find((team) => team.members.some((person) => person.name === selectedName))
  const teamIndex = teams.findIndex((team) => team.name === participantTeam?.name)

  return (
    <section className="page draw-page participant-page">
      <div className="participant-hero">
        <div className="page-kicker"><span className="kicker-line" /> MP2 · WORKSHOP</div>
        <h1>MP2 TEAM DRAW</h1>
        <p>이름을 선택하고 오늘 함께할 팀을 확인해보세요.</p>
      </div>

      {stage === 'choose' && <section className="participant-picker" aria-label="참가자 선택">
        <div className="participant-list">
          {PARTICIPANTS.map((person) => <button
            className={`participant-tile${selectedName === person.name ? ' selected' : ''}${drawn.includes(person.name) ? ' has-drawn' : ''}`}
            key={person.name}
            type="button"
            onClick={() => selectParticipant(person.name)}
          >
            <span>{person.name}</span><small>{drawn.includes(person.name) ? '결과 확인' : '선택하기'}</small>
          </button>)}
        </div>
      </section>}

      {stage === 'drawing' && <section className="magic-stage" aria-live="polite">
        <div className="magic-sparkles" aria-hidden="true"><i>✦</i><i>✧</i><i>·</i><i>✳</i><i>✦</i><i>·</i></div>
        <div className="magic-hat" aria-hidden="true"><span className="hat-star">✦</span><i /></div>
        <p className="drawing-name">{selectedName}님의 팀을 찾고 있어요</p>
        <h2 className="thinking-copy">흠...</h2>
        <p className="magic-caption">모자가 열심히 생각하는 중이에요</p>
      </section>}

      {stage === 'result' && participantTeam && <section className={`participant-result team-tone-${teamStyles[teamIndex] ?? 'ryan'}`} aria-live="polite">
        <button className="back-to-participants" type="button" onClick={() => { setStage('choose'); setSelectedName(null) }}>← 참가자 목록</button>
        <div className="result-emblem" aria-hidden="true">{teamIndex === 0 ? '🧸' : teamIndex === 1 ? '🌿' : '🍑'}</div>
        <p className="result-overline">{selectedName}님의 오늘의 팀</p>
        <h2>{participantTeam.name}</h2>
        <p className="result-message">좋은 아이디어를 함께 만들어봐요!</p>
        <div className="result-members-wrap">
          <h3>함께할 팀원 <span>{participantTeam.members.length}명</span></h3>
          <ul className="result-members">{participantTeam.members.map((member) => <li className={member.name === selectedName ? 'you' : ''} key={member.name}>{member.name}{member.name === selectedName && <span>YOU</span>}</li>)}</ul>
        </div>
      </section>}

      <TeamAssignmentPreview teams={teams} onRegenerate={createNewAssignment} />
    </section>
  )
}

function TeamAssignmentPreview({ teams, onRegenerate }: { teams: Team[]; onRegenerate: () => void }) {
  return (
    <section className="assignment-preview" aria-labelledby="assignment-title">
      <div className="assignment-heading">
        <div><span className="eyebrow">DEVELOPMENT PREVIEW</span><h2 id="assignment-title">개발용 팀 배정</h2></div>
        <button className="button button-regenerate" type="button" onClick={onRegenerate}>새 팀 배정 생성</button>
      </div>
      <p className="assignment-description">개발 확인용 영역입니다. 새 배정을 만들면 이 브라우저의 저장 결과가 변경됩니다.</p>
      <div className="assignment-grid">
        {teams.map((team, index) => {
          const mobile = team.members.filter((person) => person.part === 'mobile').length
          const pc = team.members.length - mobile
          const female = team.members.filter((person) => person.gender === 'female').length
          const male = team.members.length - female
          return <article className="assignment-team" key={team.name}>
            <div className="assignment-team-heading"><span className={`assignment-team-icon team-color-${index + 1}`}>{['R', 'M', 'A'][index]}</span><div><h3>{team.name}</h3><span>{team.members.length}명</span></div></div>
            <div className="assignment-stats"><span>모바일 <strong>{mobile}</strong></span><span>PC <strong>{pc}</strong></span><span>여성 <strong>{female}</strong></span><span>남성 <strong>{male}</strong></span></div>
            <ul className="assignment-members">{team.members.map((person) => <li key={person.name}>{person.name}<span>{person.part === 'mobile' ? 'Mobile' : 'PC'} · {person.gender === 'female' ? '여성' : '남성'}</span></li>)}</ul>
          </article>
        })}
      </div>
    </section>
  )
}
