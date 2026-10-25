const teams = [
  { name: 'TEAM 01', title: '아직 팀이 구성되지 않았어요', score: '—', color: 'coral', symbol: '✳' },
  { name: 'TEAM 02', title: '첫 번째 아이디어를 기다리는 중', score: '—', color: 'blue', symbol: '◈' },
  { name: 'TEAM 03', title: '함께할 팀원을 곧 만나요', score: '—', color: 'green', symbol: '✦' },
]

export default function ScorePage() {
  return (
    <section className="page subpage">
      <div className="page-kicker"><span className="kicker-line" /> LIVE BOARD · PARTICIPANT VIEW</div>
      <div className="subpage-heading"><div><h1>오늘의 <span>점수판</span></h1><p>팀들의 현재 점수를 확인해보세요.</p></div><div className="live-tag"><i /> LIVE SCORE</div></div>
      <div className="score-summary"><div><span className="summary-label">현재 진행 상황</span><strong>집계 대기 중</strong></div><div className="summary-divider" /><div><span className="summary-label">참가 팀</span><strong>— <small>팀</small></strong></div><div className="summary-divider" /><div><span className="summary-label">마지막 업데이트</span><strong>아직 없음</strong></div></div>
      <div className="section-heading"><h2>TEAM RANKING</h2><span>점수가 등록되면 순위가 표시됩니다</span></div>
      <div className="team-list">{teams.map((team) => <article className="team-row" key={team.name}><div className={`team-symbol ${team.color}`}>{team.symbol}</div><div className="team-info"><span>{team.name}</span><strong>{team.title}</strong></div><div className="team-score">{team.score}<small>PTS</small></div><div className="rank-arrow">↗</div></article>)}</div>
      <div className="empty-hint"><span>✦</span> 관리자가 점수를 입력하면 실시간으로 반영됩니다.</div>
    </section>
  )
}
