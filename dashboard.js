/* ============================================================
   SALIQ AI — User Progress & Dashboard
   Progress is stored per-user in Supabase (user metadata), so it
   follows the user across devices and sessions.
   ============================================================ */

(function () {

  // All 114 surahs: [transliterated name, ayah count] — indexed by surah number - 1
  const SURAHS = [
    ['Al-Fatihah',7],['Al-Baqarah',286],["Ali 'Imran",200],['An-Nisa',176],["Al-Ma'idah",120],
    ["Al-An'am",165],["Al-A'raf",206],['Al-Anfal',75],['At-Tawbah',129],['Yunus',109],
    ['Hud',123],['Yusuf',111],["Ar-Ra'd",43],['Ibrahim',52],['Al-Hijr',99],
    ['An-Nahl',128],['Al-Isra',111],['Al-Kahf',110],['Maryam',98],['Ta-Ha',135],
    ['Al-Anbiya',112],['Al-Hajj',78],["Al-Mu'minun",118],['An-Nur',64],['Al-Furqan',77],
    ["Ash-Shu'ara",227],['An-Naml',93],['Al-Qasas',88],["Al-'Ankabut",69],['Ar-Rum',60],
    ['Luqman',34],['As-Sajdah',30],['Al-Ahzab',73],['Saba',54],['Fatir',45],
    ['Ya-Sin',83],['As-Saffat',182],['Sad',88],['Az-Zumar',75],['Ghafir',85],
    ['Fussilat',54],['Ash-Shura',53],['Az-Zukhruf',89],['Ad-Dukhan',59],['Al-Jathiyah',37],
    ['Al-Ahqaf',35],['Muhammad',38],['Al-Fath',29],['Al-Hujurat',18],['Qaf',45],
    ['Adh-Dhariyat',60],['At-Tur',49],['An-Najm',62],['Al-Qamar',55],['Ar-Rahman',78],
    ["Al-Waqi'ah",96],['Al-Hadid',29],['Al-Mujadila',22],['Al-Hashr',24],['Al-Mumtahanah',13],
    ['As-Saff',14],["Al-Jumu'ah",11],['Al-Munafiqun',11],['At-Taghabun',18],['At-Talaq',12],
    ['At-Tahrim',12],['Al-Mulk',30],['Al-Qalam',52],['Al-Haqqah',52],["Al-Ma'arij",44],
    ['Nuh',28],['Al-Jinn',28],['Al-Muzzammil',20],['Al-Muddaththir',56],['Al-Qiyamah',40],
    ['Al-Insan',31],['Al-Mursalat',50],['An-Naba',40],["An-Nazi'at",46],["'Abasa",42],
    ['At-Takwir',29],['Al-Infitar',19],['Al-Mutaffifin',36],['Al-Inshiqaq',25],['Al-Buruj',22],
    ['At-Tariq',17],["Al-A'la",19],['Al-Ghashiyah',26],['Al-Fajr',30],['Al-Balad',20],
    ['Ash-Shams',15],['Al-Layl',21],['Ad-Duha',11],['Ash-Sharh',8],['At-Tin',8],
    ["Al-'Alaq",19],['Al-Qadr',5],['Al-Bayyinah',8],['Az-Zalzalah',8],["Al-'Adiyat",11],
    ["Al-Qari'ah",11],['At-Takathur',8],["Al-'Asr",3],['Al-Humazah',9],['Al-Fil',5],
    ['Quraysh',4],["Al-Ma'un",7],['Al-Kawthar',3],['Al-Kafirun',6],['An-Nasr',3],
    ['Al-Masad',5],['Al-Ikhlas',4],['Al-Falaq',5],['An-Nas',6]
  ];

  const TOTAL_AYAHS = 6236;
  const TOTAL_SURAHS = 114;

  function emptyProgress() {
    return {
      surahs: {},        // surah number -> ayahs read in that surah
      best: {},          // surah number -> best score
      sessions: [],      // latest first: { s, n, a, sc, d }
      total_sessions: 0,
      score_sum: 0,
      streak: 0,
      last_read_date: null
    };
  }

  function getProgressFrom(user) {
    const saved = user?.user_metadata?.quran_progress;
    return Object.assign(emptyProgress(), saved || {});
  }

  function localDateStr(d) {
    const dt = d || new Date();
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  // Streak counts only if the user read today or yesterday
  function effectiveStreak(p) {
    if (!p.last_read_date) return 0;
    const today = localDateStr();
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    return (p.last_read_date === today || p.last_read_date === yesterday) ? p.streak : 0;
  }

  function computeStats(p) {
    let ayahsRead = 0;
    let surahsCompleted = 0;
    for (const num in p.surahs) {
      const total = (SURAHS[num - 1] || [null, 0])[1];
      const read = Math.min(p.surahs[num], total);
      ayahsRead += read;
      if (total > 0 && read >= total) surahsCompleted++;
    }
    return {
      ayahsRead,
      surahsCompleted,
      percent: ayahsRead / TOTAL_AYAHS * 100,
      avgScore: p.total_sessions > 0 ? Math.round(p.score_sum / p.total_sessions) : null,
      streak: effectiveStreak(p)
    };
  }

  /* ---- Recording a completed recitation ---- */

  // segments: [{ surah, toAyah, count }] — a passage may span several surahs (juz)
  async function record({ title, segments, score }) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const p = getProgressFrom(session.user);
    let totalCount = 0;

    for (const seg of segments) {
      const info = SURAHS[seg.surah - 1] || ['Surah ' + seg.surah, seg.toAyah];
      p.surahs[seg.surah] = Math.min(Math.max(p.surahs[seg.surah] || 0, seg.toAyah), info[1]);
      p.best[seg.surah] = Math.max(p.best[seg.surah] || 0, score);
      totalCount += seg.count || 0;
    }

    p.sessions.unshift({ s: segments[0].surah, n: title, a: totalCount, sc: score, d: new Date().toISOString() });
    p.sessions = p.sessions.slice(0, 10);

    p.total_sessions += 1;
    p.score_sum += score;

    const today = localDateStr();
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    if (p.last_read_date !== today) {
      p.streak = (p.last_read_date === yesterday) ? (p.streak + 1) : 1;
      p.last_read_date = today;
    }

    const { error } = await supabaseClient.auth.updateUser({ data: { quran_progress: p } });
    if (error) console.error('Failed to save progress:', error);
  }

  /* ---- Rendering ---- */

  function relativeDate(iso) {
    const d = new Date(iso);
    const today = localDateStr();
    if (localDateStr(d) === today) {
      return 'Today, ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    if (localDateStr(d) === localDateStr(new Date(Date.now() - 86400000))) return 'Yesterday';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days < 30 ? days + ' days ago' : d.toLocaleDateString();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderSessions(p) {
    const list = document.getElementById('dash-sessions');
    if (!p.sessions.length) {
      list.innerHTML = '<div class="session-empty"><i class="fa-solid fa-microphone-lines"></i><br>No recitations yet.<br>Press <strong>Start Reading Quran</strong> to begin your journey.</div>';
      return;
    }
    list.innerHTML = p.sessions.slice(0, 5).map(s => `
      <div class="session-item">
        <div class="session-num">${esc(s.s)}</div>
        <div class="session-info">
          <div class="session-name">${esc(s.n)}</div>
          <div class="session-meta">${esc(relativeDate(s.d))} • ${esc(s.a)} ayah${s.a === 1 ? '' : 's'}</div>
        </div>
        <div class="session-score"${s.sc >= 100 ? ' style="color: var(--clr-gold-400);"' : ''}>${esc(s.sc)}%</div>
      </div>`).join('');
  }

  function renderAchievements(p, stats) {
    const defs = [
      { icon: '🌟', name: 'First Step',        desc: 'Complete your first recitation.',    done: p.total_sessions >= 1 },
      { icon: '📖', name: 'Surah Complete',    desc: 'Read a full surah start to finish.', done: stats.surahsCompleted >= 1 },
      { icon: '🔥', name: '3-Day Streak',      desc: 'Read 3 days in a row.',              done: stats.streak >= 3 },
      { icon: '👑', name: 'Master of Fatihah', desc: 'Score 95%+ on Surah Al-Fatihah.',    done: (p.best[1] || 0) >= 95 },
      { icon: '🎯', name: 'Sharp Reciter',     desc: 'Average score above 90%.',           done: stats.avgScore !== null && stats.avgScore >= 90 && p.total_sessions >= 3 },
      { icon: '🏆', name: 'Devoted Reader',    desc: 'Complete 10 reading sessions.',      done: p.total_sessions >= 10 }
    ];
    document.getElementById('dash-achievements').innerHTML = defs.map(a => `
      <div class="achievement-card${a.done ? '' : ' locked'}">
        <span class="achievement-icon">${a.icon}</span>
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.desc}</div>
      </div>`).join('');
  }

  function render(user) {
    const p = getProgressFrom(user);
    const stats = computeStats(p);

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Reciter';
    document.getElementById('dash-name').innerText = fullName.split(' ')[0];

    document.getElementById('dash-subtitle').innerText = p.total_sessions
      ? 'Here is your Quran reading journey so far.'
      : "You haven't started yet — today is a beautiful day to begin.";

    // Completion card
    document.getElementById('qp-ayahs').innerText = stats.ayahsRead.toLocaleString();
    document.getElementById('qp-surahs').innerText = stats.surahsCompleted;
    const pctText = stats.percent === 0 ? '0%'
      : stats.percent < 1 ? stats.percent.toFixed(2) + '%'
      : stats.percent < 10 ? stats.percent.toFixed(1) + '%'
      : Math.round(stats.percent) + '%';
    document.getElementById('qp-percent').innerText = pctText;
    document.getElementById('qp-fill').style.width = Math.max(stats.percent, stats.ayahsRead > 0 ? 0.8 : 0) + '%';
    document.getElementById('qp-hint').innerText = stats.ayahsRead === 0
      ? 'Every ayah counts — start with a short surah today.'
      : stats.surahsCompleted >= TOTAL_SURAHS
      ? 'Masha\'Allah — you have completed the entire Quran!'
      : 'Keep going — ' + (TOTAL_AYAHS - stats.ayahsRead).toLocaleString() + ' ayahs to go.';

    // Stat cards
    document.getElementById('stat-ayahs').innerText = stats.ayahsRead.toLocaleString();
    document.getElementById('stat-surahs').innerText = stats.surahsCompleted;
    document.getElementById('stat-streak').innerText = stats.streak;
    document.getElementById('stat-streak-trend').innerText =
      stats.streak >= 3 ? 'Keep it up! 🔥' : stats.streak > 0 ? 'Come back tomorrow!' : 'Start today!';
    document.getElementById('stat-score').innerText = stats.avgScore !== null ? stats.avgScore + '%' : '—';
    document.getElementById('stat-score-trend').innerText = stats.avgScore !== null
      ? 'across ' + p.total_sessions + ' session' + (p.total_sessions === 1 ? '' : 's')
      : 'No recitations yet';

    renderSessions(p);
    renderAchievements(p, stats);
  }

  window.SaliqProgress = { SURAHS, TOTAL_AYAHS, record, render };
})();
