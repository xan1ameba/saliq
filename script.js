/* ============================================================
   SALIQ AI — Quran Recitation Coach
   Frontend Interactivity Script
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileNavClose = document.getElementById('mobile-nav-close');
  const mobileLinks = document.querySelectorAll('.mobile-link');
  
  const landingPage = document.getElementById('landing-page');
  const dashboardPage = document.getElementById('dashboard-page');
  const appPage = document.getElementById('app-page');

  // Dashboard entries: navbar, CTA and mobile nav; the hero button starts reading directly
  const dashboardButtons = [
    document.getElementById('btn-start-demo'),
    document.getElementById('cta-try-demo'),
    mobileNav.querySelector('.btn-primary')
  ];
  const readingButtons = [document.getElementById('hero-try-demo')];

  const btnRecord = document.getElementById('btn-record');
  
  const micPanel = document.getElementById('mic-panel');
  const feedbackPanel = document.getElementById('feedback-panel');
  const quranTextDisplay = document.getElementById('quran-text-display');
  
  const recordingTimer = document.getElementById('recording-timer');
  const audioWaveform = document.getElementById('audio-waveform');
  const micStatusTitle = document.getElementById('mic-status-title');
  const micStatusSubtitle = document.getElementById('mic-status-subtitle');
  
  const analyzingOverlay = document.getElementById('analyzing-overlay');
  const analyzingSteps = document.getElementById('analyzing-steps').children;
  
  const explBlocks = document.querySelectorAll('.explanation-block');
  
  const progressSteps = document.querySelectorAll('.progress-step');
  const progressConnectors = document.querySelectorAll('.progress-connector');
  
  const howPreviewSteps = [
    document.getElementById('preview-step-1'),
    document.getElementById('preview-step-2'),
    document.getElementById('preview-step-3')
  ];
  const howStepItems = document.querySelectorAll('.step-item');

  // --- Navbar Scroll Effect ---
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // --- Mobile Navigation ---
  hamburger.addEventListener('click', () => {
    mobileNav.classList.add('open');
  });

  mobileNavClose.addEventListener('click', () => {
    mobileNav.classList.remove('open');
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
    });
  });

  // --- Page Navigation (landing / dashboard / practice / settings) ---
  const settingsPage = document.getElementById('settings-page');
  const selectPage = document.getElementById('select-page');
  const pages = [landingPage, dashboardPage, appPage, settingsPage, selectPage];

  function transitionTo(pageEl) {
    const current = pages.find(p => p.classList.contains('active'));
    if (current === pageEl) return;
    mobileNav.classList.remove('open');
    current.style.opacity = '0';
    setTimeout(() => {
      current.classList.remove('active');
      pageEl.classList.add('active');
      pageEl.style.opacity = '0';
      window.scrollTo(0, 0);

      setTimeout(() => {
        pageEl.style.transition = 'opacity 0.5s ease';
        pageEl.style.opacity = '1';
      }, 50);
    }, 300);
  }

  // Both destinations require an account — guests get the sign-in window
  window.goToDashboard = async function () {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.requireAuth('dashboard');
    window.SaliqProgress.render(session.user);
    transitionTo(dashboardPage);
  };

  window.goToReading = async function () {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.requireAuth('reading');
    // Reading starts with choosing a passage (surah or juz + ayah range)
    renderSelectGrid();
    transitionTo(selectPage);
  };

  dashboardButtons.forEach(btn => {
    if (btn) btn.addEventListener('click', () => window.goToDashboard());
  });
  readingButtons.forEach(btn => {
    if (btn) btn.addEventListener('click', () => window.goToReading());
  });

  document.getElementById('btn-start-reading').addEventListener('click', () => window.goToReading());
  document.getElementById('btn-back-dashboard').addEventListener('click', () => window.goToDashboard());

  // --- Settings page navigation ---
  let settingsReturnPage = dashboardPage;

  window.goToSettings = async function () {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return window.requireAuth('dashboard');
    const active = pages.find(p => p.classList.contains('active'));
    settingsReturnPage = (active && active !== settingsPage) ? active : dashboardPage;
    syncSettingsUI();
    transitionTo(settingsPage);
  };

  document.getElementById('btn-settings-dash').addEventListener('click', () => window.goToSettings());
  document.getElementById('btn-settings-app').addEventListener('click', () => window.goToSettings());
  document.getElementById('btn-settings-nav').addEventListener('click', () => window.goToSettings());

  // Change the passage from the practice page → back to the picker
  document.getElementById('btn-change-passage').addEventListener('click', () => window.goToReading());
  document.getElementById('btn-settings-back').addEventListener('click', () => transitionTo(settingsReturnPage));

  // --- Nav links & logo: go back to landing page from any page ---
  function showLandingPage(targetId) {
    if (landingPage.classList.contains('active')) {
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    transitionTo(landingPage);
    if (targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 700);
    }
  }

  document.querySelector('.navbar__logo').addEventListener('click', () => showLandingPage('home'));

  document.querySelectorAll('.navbar__nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').replace('#', '');
      if (!landingPage.classList.contains('active')) {
        e.preventDefault();
        showLandingPage(targetId);
      }
    });
  });

  // --- Language (translations + feedback), synced with Settings ---
  const LANG_KEY = 'saliq_lang';
  const VALID_LANGS = ['en', 'ru', 'kk'];
  const LANG_NAMES = { en: 'English', ru: 'Russian', kk: 'Kazakh' };

  let currentLang = localStorage.getItem(LANG_KEY);
  if (!VALID_LANGS.includes(currentLang)) currentLang = 'ru';

  function syncLangUI() {
    document.querySelectorAll('#lang-grid .theme-option').forEach(b =>
      b.classList.toggle('active', b.dataset.lang === currentLang));
    explBlocks.forEach(block => {
      block.style.display = block.classList.contains('lang-' + currentLang) ? 'block' : 'none';
    });
  }

  function setLanguage(lang) {
    if (!VALID_LANGS.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    syncLangUI();
    supabaseClient.auth.updateUser({ data: { preferred_language: lang } })
      .then(({ error }) => { if (error) console.error('Failed to save language:', error); });
    if (currentPassage) renderPassage();
  }

  syncLangUI();

  // The language saved on the user's account wins over the local copy
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    const saved = session?.user?.user_metadata?.preferred_language;
    if (saved && VALID_LANGS.includes(saved) && saved !== currentLang) {
      currentLang = saved;
      localStorage.setItem(LANG_KEY, saved);
      syncLangUI();
      if (currentPassage) renderPassage();
    }
  });

  document.querySelectorAll('#lang-grid .theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.dataset.lang);
      showToast(`Language switched to ${LANG_NAMES[currentLang]}`, 'success');
    });
  });

  // --- Full Quran (data in quran/*.json) ---
  const bismillahEl = document.getElementById('bismillah-display');

  // --- Display settings: what to show for each ayah ---
  const SETTINGS_KEY = 'saliq_display_settings';
  let displaySettings = { arabic: true, transliteration: true, translation: true };
  try {
    Object.assign(displaySettings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch (e) { /* corrupted local copy — keep defaults */ }

  // The copy saved on the user's account wins over the local one
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    const saved = session?.user?.user_metadata?.display_settings;
    if (saved) {
      Object.assign(displaySettings, saved);
      syncSettingsUI();
      if (currentPassage) renderPassage();
    }
  });

  const setArabic      = document.getElementById('set-arabic');
  const setTranslit    = document.getElementById('set-translit');
  const setTranslation = document.getElementById('set-translation');

  function syncSettingsUI() {
    setArabic.checked      = !!displaySettings.arabic;
    setTranslit.checked    = !!displaySettings.transliteration;
    setTranslation.checked = !!displaySettings.translation;
  }
  syncSettingsUI();

  [setArabic, setTranslit, setTranslation].forEach(el => {
    el.addEventListener('change', () => {
      const next = {
        arabic: setArabic.checked,
        transliteration: setTranslit.checked,
        translation: setTranslation.checked
      };
      if (!next.arabic && !next.transliteration && !next.translation) {
        showToast('At least one display option must stay on.', 'error');
        syncSettingsUI();
        return;
      }
      displaySettings = next;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      supabaseClient.auth.updateUser({ data: { display_settings: next } })
        .then(({ error }) => { if (error) console.error('Failed to save settings:', error); });
      if (currentPassage) renderPassage();
      showToast('Settings saved.', 'success');
    });
  });

  // --- Color theme (recolors the whole site) ---
  const THEME_KEY = 'saliq_theme';
  const VALID_THEMES = ['green', 'black', 'blue', 'gold', 'purple'];
  let currentTheme = localStorage.getItem(THEME_KEY);
  if (!VALID_THEMES.includes(currentTheme)) currentTheme = 'green';

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    document.querySelectorAll('#theme-grid .theme-option').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.theme === theme));
  }
  applyTheme(currentTheme);

  // The theme saved on the user's account wins over the local copy
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    const saved = session?.user?.user_metadata?.theme;
    if (saved && VALID_THEMES.includes(saved) && saved !== currentTheme) {
      currentTheme = saved;
      localStorage.setItem(THEME_KEY, saved);
      applyTheme(saved);
    }
  });

  document.querySelectorAll('#theme-grid .theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTheme = btn.dataset.theme;
      localStorage.setItem(THEME_KEY, currentTheme);
      applyTheme(currentTheme);
      supabaseClient.auth.updateUser({ data: { theme: currentTheme } })
        .then(({ error }) => { if (error) console.error('Failed to save theme:', error); });
      showToast('Theme applied.', 'success');
    });
  });

  let surahIndex = [];
  let pageStarts = [];        // 604 mushaf pages: [surah, ayah] where each starts
  let currentPassage = null;  // { title, segments: [{ data, from, to }] }
  let currentMushafPage = null;
  let quranData = null;       // the whole Quran, loaded once from quran/all.json

  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const toArabicNum = (n) => String(n).split('').map(d => AR_DIGITS[+d]).join('');
  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // The whole Quran (index + page map + all 114 surahs) ships as one file —
  // a single fetch, cached by the browser after the first visit
  const quranReady = fetch('quran/all.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(d => {
      quranData = d;
      surahIndex = d.index;
      pageStarts = d.pages;
      renderSelectGrid();
      if (currentPassage) {
        computePassagePages(currentPassage);
        renderPassage();
      }
    })
    .catch(err => {
      console.error('Failed to load Quran data:', err);
      showToast('Could not load the Quran data. Please refresh the page.', 'error');
    });

  function surahMeta(num) {
    return surahIndex.find(s => s.n === num);
  }

  async function fetchSurah(num) {
    if (!quranData) await quranReady;
    if (!quranData) throw new Error('Quran data unavailable');
    return quranData.surahs[num];
  }

  function verseBlockHtml(surahNum, v) {
    const ds = displaySettings;
    return `
      <div class="verse-block">
        <div class="verse-ref">${surahNum}:${v.n}</div>
        ${ds.arabic ? `<div class="quran-arabic-text verse-arabic">${v.ar.split(' ').map(w => `<span class="word">${escHtml(w)}</span>`).join(' ')} ﴿${toArabicNum(v.n)}﴾</div>` : ''}
        ${ds.transliteration ? `<div class="verse-translit">${escHtml(v.tr || '')}</div>` : ''}
        ${ds.translation ? `<div class="verse-translation">${escHtml(v[currentLang] || v.ru || '')}</div>` : ''}
      </div>`;
  }

  // --- Mushaf page math: every passage is displayed one page at a time ---
  const posOf = (s, a) => s * 1000 + a;

  function pageStartPos(p) {
    const [s, a] = pageStarts[p - 1];
    return posOf(s, a);
  }

  function pageEndPos(p) {
    if (p >= pageStarts.length) return posOf(114, 6);
    const [es, ea] = pageStarts[p]; // start of the next page
    if (ea === 1) {
      const ps = es - 1;
      return posOf(ps, (surahMeta(ps) || { ayahs: 1 }).ayahs);
    }
    return posOf(es, ea - 1);
  }

  function findPageFor(position) {
    let lo = 1, hi = pageStarts.length, ans = 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pageStartPos(mid) <= position) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }

  function computePassagePages(passage) {
    passage.pageIdx = 0;
    if (!pageStarts.length || !passage.segments.length) {
      passage.firstPage = 0;
      passage.lastPage = 0;
      return;
    }
    const s0 = passage.segments[0];
    const sl = passage.segments[passage.segments.length - 1];
    passage.firstPage = findPageFor(posOf(s0.data.n, s0.from));
    passage.lastPage = findPageFor(posOf(sl.data.n, sl.to));
  }

  // The part of the passage that sits on the currently displayed page
  function visibleSegments() {
    if (!currentPassage) return [];
    if (!pageStarts.length || !currentPassage.firstPage) return currentPassage.segments;

    const p = currentPassage.firstPage + currentPassage.pageIdx;
    const lo = pageStartPos(p), hi = pageEndPos(p);
    const out = [];
    for (const seg of currentPassage.segments) {
      const s = seg.data;
      const vs = s.verses.filter(v =>
        v.n >= seg.from && v.n <= seg.to &&
        posOf(s.n, v.n) >= lo && posOf(s.n, v.n) <= hi);
      if (vs.length) out.push({ data: s, from: vs[0].n, to: vs[vs.length - 1].n });
    }
    return out;
  }

  function renderPassage() {
    if (!currentPassage) return;
    const ds = displaySettings;
    const segs = visibleSegments();
    const multi = segs.length > 1;
    let html = '';

    for (const seg of segs) {
      const s = seg.data;
      if (multi) {
        html += `<div class="segment-header">${escHtml(s.name)}<small>${escHtml(s.meaning || '')} • Ayah ${seg.from}-${seg.to}</small></div>`;
      }
      // The Bismillah heads every surah except At-Tawbah (9); in Al-Fatihah (1)
      // it IS ayah 1, so it is already part of the text
      if (ds.arabic && seg.from === 1 && s.n !== 9 && s.n !== 1) {
        html += `<div class="bismillah verse-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
      }
      html += s.verses.filter(v => v.n >= seg.from && v.n <= seg.to)
        .map(v => verseBlockHtml(s.n, v)).join('');
    }

    quranTextDisplay.innerHTML = html || '<div class="session-empty">Nothing to display.</div>';
    bismillahEl.style.display = 'none'; // rendered inline per surah

    if (segs.length) {
      document.getElementById('passage-label').innerHTML = multi
        ? `<strong>${escHtml(currentPassage.title)}</strong> (${segs.length} surahs)`
        : `Surah <strong>${escHtml(segs[0].data.name)}</strong> (Ayah ${segs[0].from}-${segs[0].to})`;
    }

    quranTextDisplay.scrollTop = 0;
    updatePageNav();
  }

  // --- Step 1: Load Text ---
  async function setPassage(spec, title) {
    // spec: [{ surah, from, to }] — one entry per surah in the passage
    const segments = [];
    for (const part of spec) {
      const data = await fetchSurah(part.surah);
      segments.push({
        data,
        from: Math.max(1, part.from),
        to: Math.min(part.to, data.ayahs)
      });
    }
    currentPassage = { title, segments };
    currentMushafPage = null;
    computePassagePages(currentPassage);
    renderPassage();

    // Reset panels for a fresh recitation
    feedbackPanel.classList.remove('visible');
    micPanel.style.display = '';
    updateProgress(2);
  }

  // --- Choose Passage page (the Start Reading flow) ---
  // Standard juz boundaries: [start surah, start ayah, end surah, end ayah]
  const JUZ_BOUNDS = [
    [1,1,2,141],[2,142,2,252],[2,253,3,92],[3,93,4,23],[4,24,4,147],
    [4,148,5,81],[5,82,6,110],[6,111,7,87],[7,88,8,40],[8,41,9,92],
    [9,93,11,5],[11,6,12,52],[12,53,14,52],[15,1,16,128],[17,1,18,74],
    [18,75,20,135],[21,1,22,78],[23,1,25,20],[25,21,27,55],[27,56,29,45],
    [29,46,33,30],[33,31,36,27],[36,28,39,31],[39,32,41,46],[41,47,45,37],
    [46,1,51,30],[51,31,57,29],[58,1,66,12],[67,1,77,50],[78,1,114,6]
  ];

  const selectGrid   = document.getElementById('select-grid');
  const selectSearch = document.getElementById('select-search');
  const tabSurahs    = document.getElementById('tab-surahs');
  const tabJuz       = document.getElementById('tab-juz');
  const tabPages     = document.getElementById('tab-pages');
  let selectMode = 'surahs';

  function renderSelectGrid() {
    const q = (selectSearch.value || '').trim().toLowerCase();

    if (selectMode === 'surahs') {
      const items = surahIndex.filter(s =>
        !q || s.name.toLowerCase().includes(q) || String(s.n) === q || (s.meaning || '').toLowerCase().includes(q));
      selectGrid.innerHTML = items.map(s => `
        <div class="surah-item" data-num="${s.n}">
          <div class="surah-item__num">${s.n}</div>
          <div class="surah-item__info">
            <span class="surah-item__name">${escHtml(s.name)}</span>
            <span class="surah-item__meta">${escHtml(s.meaning || '')} • ${s.ayahs} Ayahs</span>
          </div>
          <div class="surah-item__arabic">${escHtml(s.arabic || '')}</div>
        </div>`).join('');
      selectGrid.querySelectorAll('.surah-item').forEach(item => {
        item.addEventListener('click', async () => {
          const num = parseInt(item.dataset.num, 10);
          const meta = surahMeta(num);
          try {
            await setPassage([{ surah: num, from: 1, to: meta ? meta.ayahs : 286 }], meta ? meta.name : 'Surah ' + num);
            transitionTo(appPage);
            showToast(`${meta ? meta.name : 'Surah'} loaded. Bismillah!`, 'success');
          } catch (err) {
            console.error('Failed to load surah:', err);
            showToast('Could not load the surah text. Please try again.', 'error');
          }
        });
      });

    } else if (selectMode === 'pages') {
      selectGrid.innerHTML = `<div class="ayah-grid page-grid">${
        Array.from({ length: pageStarts.length || 604 }, (_, i) =>
          `<button type="button" class="ayah-chip" data-page="${i + 1}">${i + 1}</button>`).join('')
      }</div>`;
      selectGrid.querySelectorAll('.ayah-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
          try {
            await loadPage(parseInt(chip.dataset.page, 10));
            transitionTo(appPage);
            showToast(`Page ${chip.dataset.page} loaded. Bismillah!`, 'success');
          } catch (err) {
            console.error('Failed to load page:', err);
            showToast('Could not load the page. Please try again.', 'error');
          }
        });
      });

    } else {
      selectGrid.innerHTML = JUZ_BOUNDS.map((b, i) => {
        const [s1, a1, s2, a2] = b;
        const m1 = surahMeta(s1), m2 = surahMeta(s2);
        return `
        <div class="surah-item" data-juz="${i + 1}">
          <div class="surah-item__num">${i + 1}</div>
          <div class="surah-item__info">
            <span class="surah-item__name">Juz ${i + 1}</span>
            <span class="surah-item__meta">${m1 ? escHtml(m1.name) : s1} ${a1} → ${m2 ? escHtml(m2.name) : s2} ${a2}</span>
          </div>
          <div class="surah-item__arabic">جزء</div>
        </div>`;
      }).join('');
      selectGrid.querySelectorAll('.surah-item').forEach(item => {
        item.addEventListener('click', async () => {
          try {
            await startJuzReading(parseInt(item.dataset.juz, 10));
          } catch (err) {
            console.error('Failed to load juz:', err);
            showToast('Could not load the juz text. Please try again.', 'error');
          }
        });
      });
    }
  }

  function setSelectMode(mode) {
    selectMode = mode;
    tabSurahs.classList.toggle('active', mode === 'surahs');
    tabJuz.classList.toggle('active', mode === 'juz');
    tabPages.classList.toggle('active', mode === 'pages');
    selectSearch.style.display = mode === 'surahs' ? '' : 'none';
    renderSelectGrid();
  }

  tabSurahs.addEventListener('click', () => setSelectMode('surahs'));
  tabJuz.addEventListener('click', () => setSelectMode('juz'));
  tabPages.addEventListener('click', () => setSelectMode('pages'));
  selectSearch.addEventListener('input', () => renderSelectGrid());

  document.getElementById('btn-select-back').addEventListener('click', () => window.goToDashboard());

  // --- Mushaf pages (604 standard pages) ---
  function pageSpec(p) {
    const [ss, sa] = pageStarts[p - 1];
    let stopS, stopA;
    if (p >= pageStarts.length) {
      stopS = 114; stopA = 6; // last page ends at An-Nas 6
    } else {
      const [es, ea] = pageStarts[p]; // start of the next page
      if (ea === 1) {
        stopS = es - 1;
        stopA = (surahMeta(stopS) || { ayahs: 1 }).ayahs;
      } else {
        stopS = es;
        stopA = ea - 1;
      }
    }
    const spec = [];
    for (let s = ss; s <= stopS; s++) {
      spec.push({
        surah: s,
        from: s === ss ? sa : 1,
        to: s === stopS ? stopA : (surahMeta(s) || { ayahs: 286 }).ayahs
      });
    }
    return spec;
  }

  async function loadPage(p) {
    if (!pageStarts.length) throw new Error('Page map not loaded');
    p = Math.min(Math.max(p, 1), pageStarts.length);
    await setPassage(pageSpec(p), 'Page ' + p);
    currentMushafPage = p;
    updatePageNav();
  }

  const pageNav = document.getElementById('page-nav');
  const btnPagePrev = document.getElementById('btn-page-prev');
  const btnPageNext = document.getElementById('btn-page-next');

  function updatePageNav() {
    const label = document.getElementById('page-nav-label');
    const total = currentPassage && currentPassage.firstPage
      ? currentPassage.lastPage - currentPassage.firstPage + 1 : 0;

    if (total > 1) {
      // Surah/juz spanning several mushaf pages — flip inside the passage
      pageNav.style.display = '';
      label.innerText = `Page ${currentPassage.pageIdx + 1} / ${total}`;
      btnPagePrev.disabled = currentPassage.pageIdx <= 0;
      btnPageNext.disabled = currentPassage.pageIdx >= total - 1;
    } else if (currentMushafPage) {
      // Reading the mushaf page by page — flip through the whole Quran
      pageNav.style.display = '';
      label.innerText = `Page ${currentMushafPage} / ${pageStarts.length}`;
      btnPagePrev.disabled = currentMushafPage <= 1;
      btnPageNext.disabled = currentMushafPage >= pageStarts.length;
    } else {
      pageNav.style.display = 'none';
    }
  }

  async function stepPage(delta) {
    if (!currentPassage) return;
    const total = currentPassage.firstPage
      ? currentPassage.lastPage - currentPassage.firstPage + 1 : 0;

    if (total > 1) {
      const next = currentPassage.pageIdx + delta;
      if (next < 0 || next >= total) return;
      currentPassage.pageIdx = next;
      renderPassage();
      // A new page starts a fresh recitation
      feedbackPanel.classList.remove('visible');
      micPanel.style.display = '';
      updateProgress(2);
      return;
    }

    if (currentMushafPage) {
      const target = currentMushafPage + delta;
      if (target < 1 || target > pageStarts.length) return;
      try {
        await loadPage(target);
      } catch (err) {
        console.error('Failed to load page:', err);
        showToast('Could not load the page. Please try again.', 'error');
      }
    }
  }

  // --- Animated page turns (buttons, swipe, arrow keys) ---
  function canStep(delta) {
    if (!currentPassage) return false;
    const total = currentPassage.firstPage
      ? currentPassage.lastPage - currentPassage.firstPage + 1 : 0;
    if (total > 1) {
      const next = currentPassage.pageIdx + delta;
      return next >= 0 && next < total;
    }
    if (currentMushafPage) {
      const target = currentMushafPage + delta;
      return target >= 1 && target <= pageStarts.length;
    }
    return false;
  }

  let turning = false;

  async function turnPage(delta) {
    if (turning || !canStep(delta)) return;
    turning = true;

    const outCls  = delta > 0 ? 'turn-out-left' : 'turn-out-right';
    const prepCls = delta > 0 ? 'turn-prep-right' : 'turn-prep-left';

    quranTextDisplay.classList.add(outCls);
    setTimeout(async () => {
      await stepPage(delta);
      // place the new page just off-screen on the incoming side, then slide it in
      quranTextDisplay.classList.remove(outCls);
      quranTextDisplay.classList.add(prepCls);
      void quranTextDisplay.offsetWidth;
      quranTextDisplay.classList.remove(prepCls);
      setTimeout(() => { turning = false; }, 240);
    }, 230);
  }

  btnPagePrev.addEventListener('click', () => turnPage(-1));
  btnPageNext.addEventListener('click', () => turnPage(1));

  // Swipe on the text: left → next page, right → previous page
  let touchX = null, touchY = null;
  quranTextDisplay.addEventListener('touchstart', (e) => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });

  quranTextDisplay.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = touchY = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      turnPage(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  // Arrow keys on desktop
  document.addEventListener('keydown', (e) => {
    if (!appPage.classList.contains('active')) return;
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowRight') turnPage(1);
    if (e.key === 'ArrowLeft') turnPage(-1);
  });

  async function startJuzReading(j) {
    const [s1, a1, s2, a2] = JUZ_BOUNDS[j - 1];
    const spec = [];
    for (let s = s1; s <= s2; s++) {
      const meta = surahMeta(s);
      spec.push({
        surah: s,
        from: s === s1 ? a1 : 1,
        to: s === s2 ? a2 : (meta ? meta.ayahs : 286)
      });
    }
    await setPassage(spec, 'Juz ' + j);
    transitionTo(appPage);
    showToast(`Juz ${j} loaded. Bismillah!`, 'success');
  }

  // --- Step 2: Recording Flow ---
  let isRecording = false;
  let timerInterval;
  let seconds = 0;

  // Generate waveform bars
  for (let i = 0; i < 30; i++) {
    const bar = document.createElement('div');
    bar.className = 'aw-bar';
    audioWaveform.appendChild(bar);
  }
  const waveBars = document.querySelectorAll('.aw-bar');

  btnRecord.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  function startRecording() {
    isRecording = true;
    btnRecord.classList.add('recording');
    btnRecord.innerHTML = '<i class="fa-solid fa-square"></i>';
    
    micStatusTitle.innerText = 'Listening...';
    micStatusTitle.style.color = 'var(--clr-red-300)';
    micStatusSubtitle.innerText = 'Recite the highlighted ayah clearly.';
    
    recordingTimer.classList.add('visible');
    audioWaveform.classList.add('visible');
    
    // Simulate waveform animation
    animateWaveform();
    
    // Timer
    seconds = 0;
    recordingTimer.innerText = '00:00';
    timerInterval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      recordingTimer.innerText = `${m}:${s}`;
    }, 1000);
  }

  function stopRecording() {
    isRecording = false;
    btnRecord.classList.remove('recording');
    btnRecord.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    
    micStatusTitle.innerText = 'Processing...';
    micStatusTitle.style.color = 'var(--clr-text-primary)';
    
    clearInterval(timerInterval);
    audioWaveform.classList.remove('visible');
    
    // Trigger Analysis Overlay
    triggerAnalysisOverlay();
  }

  function animateWaveform() {
    if (!isRecording) return;
    waveBars.forEach(bar => {
      const height = Math.random() * 36 + 4; // 4 to 40px
      bar.style.height = `${height}px`;
    });
    setTimeout(animateWaveform, 150);
  }

  // --- Step 3: Analysis & Feedback ---
  function triggerAnalysisOverlay() {
    analyzingOverlay.classList.add('visible');
    
    // Reset steps
    Array.from(analyzingSteps).forEach(step => {
      step.classList.remove('visible', 'done');
    });

    // Sequence the steps
    let delay = 500;
    Array.from(analyzingSteps).forEach((step, index) => {
      setTimeout(() => {
        step.classList.add('visible');
        if (index > 0) {
          analyzingSteps[index - 1].classList.add('done');
        }
      }, delay);
      delay += 800; // 800ms per step
    });

    // Finish analysis
    setTimeout(() => {
      analyzingSteps[analyzingSteps.length - 1].classList.add('done');
      
      setTimeout(() => {
        analyzingOverlay.classList.remove('visible');
        showFeedback();
      }, 600);
    }, delay + 200);
  }

  function showFeedback() {
    const passage = currentPassage || { title: 'Al-Fatihah', segments: [] };
    // Feedback and progress apply to the page currently on screen
    const segs = visibleSegments();
    const passageLabel = !segs.length
      ? 'Surah Al-Fatihah, Ayah 1-7'
      : segs.length > 1
        ? `${passage.title} (${segs.length} surahs)`
        : `Surah ${segs[0].data.name}, Ayah ${segs[0].from}-${segs[0].to}`;
    const score = 82 + Math.floor(Math.random() * 19); // 82–100

    // Hide Mic panel
    micPanel.style.display = 'none';

    // Show Feedback panel
    feedbackPanel.classList.add('visible');

    // Dynamic labels
    document.getElementById('feedback-passage-label').innerText = passageLabel;
    document.getElementById('score-ring-label').innerText = `${score}%`;

    // Highlight mistakes: known demo words for Al-Fatihah, a random word otherwise
    const words = Array.from(document.querySelectorAll('.quran-arabic-text .word'));
    words.forEach(w => w.classList.remove('highlighted-error', 'highlighted-ok'));

    let errorWords = [];
    if (score < 95) {
      errorWords = [document.getElementById('word-rahman'), document.getElementById('word-sirat')].filter(Boolean);
      if (!errorWords.length && words.length) {
        errorWords = [words[Math.floor(Math.random() * words.length)]];
      }
    }
    errorWords.forEach(w => w.classList.add('highlighted-error'));

    // Highlight some correct words to show it's analyzing
    words.filter(w => !errorWords.includes(w)).forEach((w, i) => {
      if (i % 3 === 0) w.classList.add('highlighted-ok');
    });

    // Update progress
    updateProgress(3);

    // Trigger circular progress animation (ring radius 25 → circumference ≈ 157)
    setTimeout(() => {
      document.querySelector('.score-ring-fill').style.strokeDashoffset = String(Math.round(157 * (1 - score / 100)));
    }, 100);

    // Save this recitation to the user's personal progress —
    // one entry per surah visible on the recited page
    if (window.SaliqProgress && segs.length) {
      window.SaliqProgress.record({
        title: segs.length === 1 ? segs[0].data.name : passage.title,
        segments: segs.map(seg => ({
          surah: seg.data.n,
          toAyah: seg.to,
          count: seg.to - seg.from + 1
        })),
        score
      });
    }

    feedbackPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Analysis complete. Review your feedback.', 'success');
  }

  // --- Practice Again: back to the mic for another round ---
  const btnPracticeAgain = document.getElementById('btn-practice-again');
  if (btnPracticeAgain) {
    btnPracticeAgain.addEventListener('click', () => {
      feedbackPanel.classList.remove('visible');
      micPanel.style.display = '';
      micStatusTitle.innerText = 'Ready to Recite';
      micStatusTitle.style.color = 'var(--clr-text-primary)';
      micStatusSubtitle.innerText = 'Press the button below and start speaking clearly.';
      recordingTimer.classList.remove('visible');
      document.querySelectorAll('.quran-arabic-text .word').forEach(w => w.classList.remove('highlighted-error', 'highlighted-ok'));
      updateProgress(2);
      micPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // --- Progress Bar Logic ---
  function updateProgress(stepNum) {
    progressSteps.forEach((step, idx) => {
      const sNum = parseInt(step.getAttribute('data-step'));
      step.classList.remove('current', 'done');
      
      if (sNum < stepNum) {
        step.classList.add('done');
      } else if (sNum === stepNum) {
        step.classList.add('current');
      }
    });

    progressConnectors.forEach((conn, idx) => {
      if (idx < stepNum - 1) {
        conn.classList.add('filled');
      } else {
        conn.classList.remove('filled');
      }
    });
  }

  // --- Toast Notification Utility ---
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    
    toastMsg.innerText = message;
    toast.className = `toast visible ${type}`;
    
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }

  // Expose toast function globally so auth.js can use it
  window.showToast = showToast;

  // --- How It Works Preview Interactive ---
  howStepItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const step = item.getAttribute('data-step');
      
      // Update active state
      howStepItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Update visual
      howPreviewSteps.forEach(s => s.classList.remove('visible'));
      document.getElementById(`preview-step-${step}`).classList.add('visible');
    });
  });

  // Audio button simulation in mistakes
  const audioBtns = document.querySelectorAll('.mistake-audio-btn');
  audioBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const icon = this.querySelector('i');
      if (icon.classList.contains('fa-play')) {
        icon.classList.replace('fa-play', 'fa-pause');
        setTimeout(() => {
          icon.classList.replace('fa-pause', 'fa-play');
        }, 1500);
      }
    });
  });
});
