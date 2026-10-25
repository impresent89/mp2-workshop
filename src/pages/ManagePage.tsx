export default function ManagePage() {
  return (
    <section className="page subpage manage-page">
      <div className="page-kicker"><span className="kicker-line" /> WORKSHOP · ADMIN</div>
      <div className="subpage-heading"><div><h1>점수 <span>관리</span></h1><p>팀별 점수를 입력하고 워크숍 현황을 관리하세요.</p></div><div className="admin-tag"><span>⌘</span> ADMIN</div></div>
      <div className="admin-banner"><div className="banner-icon">✳</div><div><strong>관리자 페이지에 오신 것을 환영해요</strong><p>팀이 생성되면 아래 목록에서 점수를 관리할 수 있습니다.</p></div><span className="banner-arrow">↗</span></div>
      <div className="section-heading"><h2>TEAM SCORE MANAGEMENT</h2><span>총 0개 팀</span></div>
      <div className="manage-empty"><div className="empty-graphic"><span className="empty-ring ring-large" /><span className="empty-ring ring-small" /><span className="empty-star">✳</span></div><strong>아직 등록된 팀이 없어요</strong><p>팀 추첨이 완료되면 이곳에서 팀별 점수를 입력할 수 있습니다.</p><button className="button button-secondary" type="button" disabled>팀 추첨 대기 중</button></div>
      <div className="manage-foot"><span>ⓘ</span> 입력한 점수는 참가자 점수판에 표시됩니다.</div>
    </section>
  )
}
