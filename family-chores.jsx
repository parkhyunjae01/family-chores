import { useState, useEffect, useCallback } from "react";

const CHORES = [
  { id: "dishes", name: "설거지", emoji: "🍽️", reward: 2000 },
  { id: "laundry", name: "빨래", emoji: "👕", reward: 1000 },
  { id: "vacuum", name: "청소기", emoji: "🧹", reward: 1500 },
  { id: "trash", name: "쓰레기", emoji: "🗑️", reward: 500 },
  { id: "cooking", name: "요리", emoji: "🍳", reward: 3000 },
  { id: "bathroom", name: "화장실 청소", emoji: "🚿", reward: 2000 },
  { id: "organize", name: "정리정돈", emoji: "📦", reward: 1000 },
  { id: "groceries", name: "장보기", emoji: "🛒", reward: 2000 },
];

const DEFAULT_MEMBERS = ["아빠", "엄마", "첫째", "둘째"];
const STORAGE_KEY = "family-chores-data-v3";
const COLORS = ["#FF6B6B", "#4ECDC4", "#FFD93D", "#6C5CE7", "#A8E6CF", "#FF8A5C", "#EA8685", "#3DC1D3"];

function formatMoney(n) {
  return n.toLocaleString("ko-KR") + "원";
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(ds) {
  const d = new Date(ds + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}/${day} (${weekdays[d.getDay()]})`;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function FamilyChores() {
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [logs, setLogs] = useState([]);
  const [chores, setChores] = useState(CHORES);
  const [view, setView] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMember, setNewMember] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newChore, setNewChore] = useState({ name: "", reward: "", emoji: "✨" });
  const [showAddChore, setShowAddChore] = useState(false);
  const [toast, setToast] = useState(null);
  const [settleHistory, setSettleHistory] = useState([]);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          if (data.members) setMembers(data.members);
          if (data.logs) setLogs(data.logs);
          if (data.chores) setChores(data.chores);
          if (data.settleHistory) setSettleHistory(data.settleHistory);
        }
      } catch (e) { console.log("Starting fresh"); }
      setLoading(false);
    })();
  }, []);

  const saveData = useCallback(async (m, l, c, sh) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify({ members: m, logs: l, chores: c, settleHistory: sh }), true);
    } catch (e) { console.error("Save error:", e); }
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const addLog = async (member, choreId) => {
    const chore = chores.find(c => c.id === choreId);
    const newLog = { id: Date.now().toString(), member, choreId, choreName: chore.name, reward: chore.reward, emoji: chore.emoji, date: getToday() };
    const updated = [newLog, ...logs];
    setLogs(updated);
    await saveData(members, updated, chores, settleHistory);
    showToast(`${chore.emoji} ${member}님이 ${chore.name} 완료! +${formatMoney(chore.reward)}`);
  };

  const deleteLog = async (logId) => {
    const updated = logs.filter(l => l.id !== logId);
    setLogs(updated);
    await saveData(members, updated, chores, settleHistory);
    showToast("기록이 삭제되었습니다");
  };

  const addMember = async () => {
    if (!newMember.trim() || members.includes(newMember.trim())) return;
    const updated = [...members, newMember.trim()];
    setMembers(updated);
    setNewMember("");
    setShowAddMember(false);
    await saveData(updated, logs, chores, settleHistory);
    showToast(`${newMember.trim()}님이 추가되었습니다!`);
  };

  const removeMember = async (m) => {
    if (members.length <= 1) return;
    const updated = members.filter(x => x !== m);
    setMembers(updated);
    await saveData(updated, logs, chores, settleHistory);
    showToast(`${m}님이 삭제되었습니다`);
  };

  const addChore = async () => {
    if (!newChore.name.trim() || !newChore.reward) return;
    const c = { id: "custom_" + Date.now(), name: newChore.name.trim(), emoji: newChore.emoji, reward: Number(newChore.reward) };
    const updated = [...chores, c];
    setChores(updated);
    setNewChore({ name: "", reward: "", emoji: "✨" });
    setShowAddChore(false);
    await saveData(members, logs, updated, settleHistory);
    showToast(`${c.emoji} ${c.name} 추가됨!`);
  };

  const removeChore = async (choreId) => {
    const updated = chores.filter(c => c.id !== choreId);
    setChores(updated);
    await saveData(members, logs, updated, settleHistory);
  };

  const settleAll = async () => {
    const summary = getMemberStats();
    const record = { date: getToday(), timestamp: Date.now(), summary };
    const updatedHistory = [record, ...settleHistory];
    setSettleHistory(updatedHistory);
    setLogs([]);
    await saveData(members, [], chores, updatedHistory);
    showToast("정산 완료! 모든 기록이 초기화되었습니다.");
    setView("home");
  };

  const getMemberStats = () => {
    const stats = {};
    members.forEach(m => { stats[m] = { total: 0, count: 0, byChore: {} }; });
    logs.forEach(l => {
      if (!stats[l.member]) stats[l.member] = { total: 0, count: 0, byChore: {} };
      stats[l.member].total += l.reward;
      stats[l.member].count += 1;
      if (!stats[l.member].byChore[l.choreName]) stats[l.member].byChore[l.choreName] = { count: 0, total: 0, emoji: l.emoji };
      stats[l.member].byChore[l.choreName].count += 1;
      stats[l.member].byChore[l.choreName].total += l.reward;
    });
    return stats;
  };

  const getLogsByDate = () => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  };

  const getDayTotal = (dayLogs) => dayLogs.reduce((s, l) => s + l.reward, 0);

  const getDayMemberSummary = (dayLogs) => {
    const summary = {};
    dayLogs.forEach(l => {
      if (!summary[l.member]) summary[l.member] = { total: 0, items: [] };
      summary[l.member].total += l.reward;
      summary[l.member].items.push(l);
    });
    return summary;
  };

  const stats = getMemberStats();
  const totalAll = Object.values(stats).reduce((s, v) => s + v.total, 0);
  const logsByDate = getLogsByDate();
  const calDays = getCalendarDays(calYear, calMonth);
  const todayStr = getToday();

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const btnBase = { border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0F0F12", color: "#fff", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite" }}>🏠</div>
          <div style={{ fontSize: 16, opacity: 0.6 }}>불러오는 중...</div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const selectedDateKey = selectedDay ? dateKey(calYear, calMonth, selectedDay) : null;
  const selectedDayLogs = selectedDateKey ? (logsByDate[selectedDateKey] || []) : [];
  const selectedDaySummary = selectedDay ? getDayMemberSummary(selectedDayLogs) : {};

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F12", color: "#E8E6E3", fontFamily: "'Noto Sans KR', -apple-system, sans-serif", position: "relative", maxWidth: 480, margin: "0 auto", paddingBottom: 100 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#2D2D35", color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 14, zIndex: 1000, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "slideDown 0.3s ease", maxWidth: "90vw", textAlign: "center" }}>{toast}</div>
      )}

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "24px 20px 16px", background: "linear-gradient(135deg, #1a1a24 0%, #0F0F12 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -1 }}>🏠 우리집 집안일</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.4 }}>가족 모두 함께하는 집안일 트래커</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowShare(true)} style={{ ...btnBase, background: "transparent", color: "#E8E6E3", fontSize: 22, padding: 8, borderRadius: 10 }}>🔗</button>
            <button onClick={() => setView(view === "settings" ? "home" : "settings")} style={{ ...btnBase, background: view === "settings" ? "#2D2D35" : "transparent", color: "#E8E6E3", fontSize: 22, padding: 8, borderRadius: 10 }}>⚙️</button>
          </div>
        </div>
      </div>

      {/* ========== HOME ========== */}
      {view === "home" && (
        <>
          <div style={{ padding: "0 20px", marginTop: 16 }}>
            <div style={{ background: "linear-gradient(135deg, #1E1E28, #25252F)", borderRadius: 20, padding: 20, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 13, opacity: 0.5, fontWeight: 500 }}>현재 누적 총액</span>
                <button onClick={() => setView("settle")} style={{ ...btnBase, background: "#FF6B6B", color: "#fff", fontSize: 12, padding: "6px 14px", borderRadius: 8, fontWeight: 600 }}>정산하기</button>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: "#fff" }}>{formatMoney(totalAll)}</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(members.length, 4)}, 1fr)`, gap: 8, marginTop: 16 }}>
                {members.map((m, i) => (
                  <button key={m} onClick={() => { setSelectedMember(m); setView("detail"); }} style={{ ...btnBase, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 6px", textAlign: "center", color: "#E8E6E3" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 16, fontWeight: 700, color: "#fff" }}>{m[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: COLORS[i % COLORS.length], marginTop: 4 }}>{formatMoney(stats[m]?.total || 0)}</div>
                    <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>{stats[m]?.count || 0}회</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: "0 20px", marginTop: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", letterSpacing: -0.5 }}>집안일 기록하기</h2>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
              {members.map((m, i) => (
                <button key={m} onClick={() => setSelectedMember(selectedMember === m ? null : m)} style={{ ...btnBase, background: selectedMember === m ? COLORS[i % COLORS.length] : "rgba(255,255,255,0.06)", color: selectedMember === m ? "#fff" : "#aaa", padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>{m}</button>
              ))}
            </div>
            {selectedMember ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, animation: "fadeIn 0.3s ease" }}>
                {chores.map(c => (
                  <button key={c.id} onClick={() => addLog(selectedMember, c.id)} style={{ ...btnBase, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "16px 12px", textAlign: "left", display: "flex", alignItems: "center", gap: 10, color: "#E8E6E3" }}>
                    <span style={{ fontSize: 26 }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: "#4ECDC4", fontWeight: 700, marginTop: 2 }}>+{formatMoney(c.reward)}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.3, fontSize: 14 }}>☝️ 먼저 가족 구성원을 선택하세요</div>
            )}
          </div>

          <div style={{ padding: "0 20px", marginTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", letterSpacing: -0.5 }}>최근 기록</h2>
            {logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.3, fontSize: 14 }}>아직 기록이 없습니다</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {logs.slice(0, 20).map((l, idx) => {
                  const mi = members.indexOf(l.member);
                  return (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS[mi >= 0 ? mi % COLORS.length : 0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{l.member[0]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}><span style={{ fontWeight: 700 }}>{l.member}</span><span style={{ opacity: 0.5 }}> · </span>{l.emoji} {l.choreName}</div>
                        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>{formatDate(l.date)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#4ECDC4", flexShrink: 0 }}>+{formatMoney(l.reward)}</div>
                      <button onClick={() => deleteLog(l.id)} style={{ ...btnBase, background: "none", color: "#555", fontSize: 16, padding: 4 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== CALENDAR ========== */}
      {view === "calendar" && (
        <div style={{ padding: "20px", animation: "fadeIn 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={prevMonth} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "#E8E6E3", width: 40, height: 40, borderRadius: 12, fontSize: 18 }}>‹</button>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{calYear}년 {calMonth + 1}월</h2>
            <button onClick={nextMonth} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "#E8E6E3", width: 40, height: 40, borderRadius: 12, fontSize: 18 }}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, padding: "6px 0", color: i === 0 ? "#FF6B6B" : i === 6 ? "#4ECDC4" : "rgba(255,255,255,0.4)" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {calDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const dk = dateKey(calYear, calMonth, day);
              const dayLogs = logsByDate[dk] || [];
              const dayTotal = getDayTotal(dayLogs);
              const isToday = dk === todayStr;
              const hasLogs = dayLogs.length > 0;
              const dayOfWeek = idx % 7;
              const uniqueMembers = [...new Set(dayLogs.map(l => l.member))];

              return (
                <button
                  key={day}
                  onClick={() => { if (hasLogs) setSelectedDay(day); }}
                  style={{
                    ...btnBase,
                    background: isToday ? "rgba(78, 205, 196, 0.12)" : hasLogs ? "rgba(255,255,255,0.04)" : "transparent",
                    borderRadius: 12,
                    padding: "8px 2px 6px",
                    minHeight: 68,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    color: "#E8E6E3",
                    border: isToday ? "1px solid rgba(78,205,196,0.3)" : "1px solid transparent",
                  }}
                >
                  <span style={{
                    fontSize: 14,
                    fontWeight: isToday ? 800 : 500,
                    color: isToday ? "#4ECDC4" : dayOfWeek === 0 ? "#FF6B6B" : dayOfWeek === 6 ? "#4ECDC4" : "#E8E6E3",
                  }}>{day}</span>
                  {hasLogs && (
                    <>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                        {uniqueMembers.slice(0, 4).map(m => {
                          const mi = members.indexOf(m);
                          return <div key={m} style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[mi >= 0 ? mi % COLORS.length : 0] }} />;
                        })}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FFD93D", lineHeight: 1 }}>
                        {dayTotal >= 10000 ? `${(dayTotal / 10000).toFixed(0)}만` : formatMoney(dayTotal).replace("원", "")}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Monthly Summary */}
          <div style={{ background: "linear-gradient(135deg, #1E1E28, #25252F)", borderRadius: 16, padding: 18, marginTop: 20, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 10 }}>{calMonth + 1}월 요약</div>
            {(() => {
              const monthLogs = logs.filter(l => {
                const [y, m] = l.date.split("-").map(Number);
                return y === calYear && m === calMonth + 1;
              });
              const monthTotal = monthLogs.reduce((s, l) => s + l.reward, 0);
              const memberTotals = {};
              monthLogs.forEach(l => { memberTotals[l.member] = (memberTotals[l.member] || 0) + l.reward; });
              return (
                <>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 12 }}>{formatMoney(monthTotal)}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {members.map((m, i) => {
                      const amt = memberTotals[m] || 0;
                      const pct = monthTotal > 0 ? (amt / monthTotal) * 100 : 0;
                      return (
                        <div key={m} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{m[0]}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 3, transition: "width 0.5s ease" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS[i % COLORS.length], minWidth: 70, textAlign: "right" }}>{formatMoney(amt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Day Detail Modal */}
      {selectedDay !== null && (
        <div onClick={() => setSelectedDay(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#1A1A24", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", animation: "modalIn 0.3s ease", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>📅 {calMonth + 1}월 {selectedDay}일</h3>
              <button onClick={() => setSelectedDay(null)} style={{ ...btnBase, background: "rgba(255,255,255,0.06)", color: "#aaa", width: 32, height: 32, borderRadius: 8, fontSize: 16 }}>×</button>
            </div>
            {selectedDayLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", opacity: 0.3, fontSize: 14 }}>이 날은 기록이 없습니다</div>
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#4ECDC4", marginBottom: 20 }}>총 {formatMoney(getDayTotal(selectedDayLogs))}</div>
                {Object.entries(selectedDaySummary).map(([name, data]) => {
                  const mi = members.indexOf(name);
                  return (
                    <div key={name} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS[mi >= 0 ? mi % COLORS.length : 0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{name[0]}</div>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{name}</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 900, color: COLORS[mi >= 0 ? mi % COLORS.length : 0] }}>{formatMoney(data.total)}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 42 }}>
                        {data.items.map(item => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.8 }}>
                            <span>{item.emoji} {item.choreName}</span>
                            <span style={{ color: "#4ECDC4", fontWeight: 600 }}>+{formatMoney(item.reward)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && (
        <div onClick={() => setShowShare(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#1A1A24", borderRadius: 24, padding: 28, animation: "modalIn 0.3s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>가족에게 공유하기</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.5, lineHeight: 1.6 }}>아래 방법으로 가족에게 공유하세요</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "rgba(78,205,196,0.08)", borderRadius: 14, padding: 16, border: "1px solid rgba(78,205,196,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4ECDC4", marginBottom: 6 }}>📱 가장 쉬운 방법</div>
                <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7 }}>
                  앱 화면 우측 상단 <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>⋯</span> 메뉴 → <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Publish</span>을 눌러주세요. 생성된 링크를 가족 카톡방에 보내면 끝!
                </div>
              </div>
              <div style={{ background: "rgba(108,92,231,0.08)", borderRadius: 14, padding: 16, border: "1px solid rgba(108,92,231,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#6C5CE7", marginBottom: 6 }}>✅ 데이터는 자동 공유</div>
                <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7 }}>
                  같은 링크로 접속한 <span style={{ fontWeight: 600, color: "#A8E6CF" }}>모든 가족이 동일한 데이터</span>를 보고 수정할 수 있어요. 누가 기록하든 실시간 반영!
                </div>
              </div>
              <div style={{ background: "rgba(255,217,61,0.08)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,217,61,0.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFD93D", marginBottom: 6 }}>💡 Tip</div>
                <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7 }}>
                  링크를 홈 화면에 추가하면 앱처럼 쓸 수 있어요! (공유 → 홈 화면에 추가)
                </div>
              </div>
            </div>
            <button onClick={() => setShowShare(false)} style={{ ...btnBase, width: "100%", background: "rgba(255,255,255,0.06)", color: "#E8E6E3", fontSize: 15, fontWeight: 600, padding: "14px", borderRadius: 12, marginTop: 16 }}>닫기</button>
          </div>
        </div>
      )}

      {/* ========== DETAIL ========== */}
      {view === "detail" && selectedMember && (
        <div style={{ padding: "20px", animation: "fadeIn 0.3s ease" }}>
          <button onClick={() => setView("home")} style={{ ...btnBase, background: "none", color: "#888", fontSize: 14, padding: "4px 0", marginBottom: 16 }}>← 뒤로</button>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: COLORS[members.indexOf(selectedMember) % COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#fff" }}>{selectedMember[0]}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{selectedMember}</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.5 }}>총 {stats[selectedMember]?.count || 0}회 수행</p>
            </div>
          </div>
          <div style={{ background: "linear-gradient(135deg, #1E1E28, #25252F)", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 4 }}>받을 금액</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#4ECDC4" }}>{formatMoney(stats[selectedMember]?.total || 0)}</div>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>집안일별 통계</h3>
          {stats[selectedMember] && Object.entries(stats[selectedMember].byChore).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(stats[selectedMember].byChore).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => (
                <div key={name} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{d.emoji}</span>
                    <div><div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div><div style={{ fontSize: 12, opacity: 0.4 }}>{d.count}회</div></div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#FFD93D" }}>{formatMoney(d.total)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0", opacity: 0.3, fontSize: 14 }}>아직 기록이 없습니다</div>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px" }}>최근 활동</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {logs.filter(l => l.member === selectedMember).slice(0, 15).map(l => (
              <div key={l.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div><span style={{ fontSize: 16, marginRight: 8 }}>{l.emoji}</span><span style={{ fontSize: 14 }}>{l.choreName}</span><span style={{ fontSize: 11, opacity: 0.4, marginLeft: 8 }}>{formatDate(l.date)}</span></div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#4ECDC4" }}>+{formatMoney(l.reward)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== SETTLE ========== */}
      {view === "settle" && (
        <div style={{ padding: 20, animation: "fadeIn 0.3s ease" }}>
          <button onClick={() => setView("home")} style={{ ...btnBase, background: "none", color: "#888", fontSize: 14, padding: "4px 0", marginBottom: 16 }}>← 뒤로</button>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>💰 정산하기</h2>
          <p style={{ fontSize: 13, opacity: 0.5, margin: "0 0 20px" }}>정산하면 모든 기록이 초기화됩니다</p>
          <div style={{ background: "linear-gradient(135deg, #1E1E28, #25252F)", borderRadius: 20, padding: 20, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }}>
            <div style={{ fontSize: 14, opacity: 0.5, marginBottom: 12 }}>정산 내역</div>
            {members.map((m, i) => (
              <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < members.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{m[0]}</div>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{m}</span>
                  <span style={{ fontSize: 12, opacity: 0.4 }}>{stats[m]?.count || 0}회</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: COLORS[i % COLORS.length] }}>{formatMoney(stats[m]?.total || 0)}</span>
              </div>
            ))}
            <div style={{ borderTop: "2px solid rgba(255,255,255,0.1)", marginTop: 8, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>합계</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{formatMoney(totalAll)}</span>
            </div>
          </div>
          <button onClick={settleAll} style={{ ...btnBase, width: "100%", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", color: "#fff", fontSize: 16, fontWeight: 800, padding: "16px", borderRadius: 14 }}>정산 완료하기</button>
          {settleHistory.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "32px 0 12px" }}>이전 정산 기록</h3>
              {settleHistory.slice(0, 10).map((h) => (
                <div key={h.timestamp} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 8 }}>{formatDate(h.date)} 정산</div>
                  {Object.entries(h.summary).map(([name, d]) => (
                    <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                      <span>{name} ({d.count}회)</span>
                      <span style={{ fontWeight: 700, color: "#4ECDC4" }}>{formatMoney(d.total)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ========== SETTINGS ========== */}
      {view === "settings" && (
        <div style={{ padding: 20, animation: "fadeIn 0.3s ease" }}>
          <button onClick={() => setView("home")} style={{ ...btnBase, background: "none", color: "#888", fontSize: 14, padding: "4px 0", marginBottom: 16 }}>← 뒤로</button>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 20px" }}>⚙️ 설정</h2>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>가족 구성원</h3>
              <button onClick={() => setShowAddMember(!showAddMember)} style={{ ...btnBase, background: "#4ECDC4", color: "#000", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 8 }}>+ 추가</button>
            </div>
            {showAddMember && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} placeholder="이름 입력" style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                <button onClick={addMember} style={{ ...btnBase, background: "#4ECDC4", color: "#000", padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>확인</button>
              </div>
            )}
            {members.map((m, i) => (
              <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < members.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{m[0]}</div>
                  <span style={{ fontSize: 15 }}>{m}</span>
                </div>
                <button onClick={() => removeMember(m)} style={{ ...btnBase, background: "none", color: "#666", fontSize: 18, padding: 4 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>집안일 목록</h3>
              <button onClick={() => setShowAddChore(!showAddChore)} style={{ ...btnBase, background: "#FFD93D", color: "#000", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 8 }}>+ 추가</button>
            </div>
            {showAddChore && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newChore.emoji} onChange={e => setNewChore({ ...newChore, emoji: e.target.value })} style={{ width: 50, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "8px", color: "#fff", fontSize: 20, textAlign: "center", fontFamily: "inherit", outline: "none" }} />
                  <input value={newChore.name} onChange={e => setNewChore({ ...newChore, name: e.target.value })} placeholder="집안일 이름" style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newChore.reward} onChange={e => setNewChore({ ...newChore, reward: e.target.value.replace(/\D/g, "") })} placeholder="보상 금액 (원)" style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                  <button onClick={addChore} style={{ ...btnBase, background: "#FFD93D", color: "#000", padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: 14 }}>추가</button>
                </div>
              </div>
            )}
            {chores.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  <span style={{ fontSize: 14 }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#4ECDC4" }}>{formatMoney(c.reward)}</span>
                  <button onClick={() => removeChore(c.id)} style={{ ...btnBase, background: "none", color: "#666", fontSize: 16, padding: 4 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(15,15,18,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-around", padding: "10px 0 env(safe-area-inset-bottom, 10px)", zIndex: 100 }}>
        {[
          { id: "home", icon: "🏠", label: "홈" },
          { id: "calendar", icon: "📅", label: "달력" },
          { id: "settle", icon: "💰", label: "정산" },
          { id: "settings", icon: "⚙️", label: "설정" },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id); if (tab.id === "home") setSelectedMember(null); }} style={{ ...btnBase, background: "none", color: view === tab.id ? "#4ECDC4" : "#555", textAlign: "center", padding: "4px 16px" }}>
            <div style={{ fontSize: 22 }}>{tab.icon}</div>
            <div style={{ fontSize: 11, marginTop: 2, fontWeight: view === tab.id ? 700 : 400 }}>{tab.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
