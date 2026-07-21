/* ============================================================
   SALIQ AI — Authentication Logic
   (Google sign-in + one-time profile completion)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const authOverlay     = document.getElementById('auth-overlay');
  const authCloseBtn    = document.getElementById('auth-close');
  const signInBtnNav    = document.getElementById('btn-signin-nav');
  const btnGoogleSignin = document.getElementById('btn-google-signin');
  const errorAuth       = document.getElementById('error-auth');
  const navProfile      = document.getElementById('nav-profile');
  const profileAvatar   = document.getElementById('profile-avatar');
  const profileEmail    = document.getElementById('profile-email');
  const btnSignOut      = document.getElementById('btn-signout');

  const authSubtitle     = document.getElementById('auth-subtitle');
  const viewSignin       = document.getElementById('view-signin');
  const viewProfile      = document.getElementById('view-profile');
  const btnProfileSubmit = document.getElementById('btn-profile-submit');

  const SUBTITLES = {
    signin:  'Sign in with your Google account to save your tajweed progress and unlock personalized coaching.',
    profile: 'Almost done! Tell us a bit about yourself.'
  };

  // Set when a guest clicks Dashboard / Start Reciting; survives the
  // Google OAuth page redirect so we can open the dashboard after login
  const DASHBOARD_REDIRECT_KEY = 'saliq_open_dashboard_after_login';

  // --- Views ---
  function switchView(name) {
    hideError();
    viewSignin.classList.toggle('active', name === 'signin');
    viewProfile.classList.toggle('active', name === 'profile');
    authSubtitle.innerText = SUBTITLES[name];
  }

  // --- Modal ---
  function openAuthModal() {
    switchView('signin');
    authOverlay.classList.add('active');
  }

  function closeAuthModal() {
    authOverlay.classList.remove('active');
    hideError();
    sessionStorage.removeItem(DASHBOARD_REDIRECT_KEY);
  }

  window.requireAuth = (target) => {
    openAuthModal();
    sessionStorage.setItem(DASHBOARD_REDIRECT_KEY, target === 'reading' ? 'reading' : 'dashboard');
    authSubtitle.innerText = 'Sign in with Google to continue.';
  };

  function goToPendingDestination(target) {
    if (target === 'reading' && window.goToReading) window.goToReading();
    else if (target && window.goToDashboard) window.goToDashboard();
  }

  if (signInBtnNav) signInBtnNav.addEventListener('click', openAuthModal);
  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (authOverlay) {
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) closeAuthModal();
    });
  }

  // --- Error ---
  function showError(msg) {
    errorAuth.querySelector('span').innerText = msg;
    errorAuth.classList.add('visible');
  }

  function hideError() {
    errorAuth.classList.remove('visible');
  }

  function friendlyError(error) {
    const msg = error?.message || '';
    if (error instanceof TypeError || /fetch|network/i.test(msg)) {
      return 'Cannot reach the authentication server. It may be paused or offline — please try again later.';
    }
    return msg || 'Something went wrong. Please try again.';
  }

  // --- Button loading state ---
  function setLoading(btn, loading, text) {
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  // --- Google Sign In ---
  if (btnGoogleSignin) {
    btnGoogleSignin.addEventListener('click', async () => {
      setLoading(btnGoogleSignin, true, 'Redirecting to Google...');

      try {
        // Never include the #fragment in the return address: Supabase appends
        // its tokens as a fragment, and "#home#access_token=..." is unparseable
        const redirectTo = window.location.protocol !== 'file:'
          ? window.location.origin + window.location.pathname + window.location.search
          : undefined;

        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: { ...(redirectTo && { redirectTo }) }
        });

        if (error) throw error;
        // Browser redirects to Google automatically

      } catch (error) {
        console.error('Google sign-in error:', error);
        showError(friendlyError(error));
        setLoading(btnGoogleSignin, false);
      }
    });
  }

  // --- Complete Profile (first sign-in) ---
  function openProfileForm(user) {
    const meta = user.user_metadata || {};
    document.getElementById('profile-name').value     = meta.full_name || meta.name || '';
    document.getElementById('profile-phone').value    = meta.phone || '';
    document.getElementById('profile-language').value = meta.preferred_language || 'ru';
    authOverlay.classList.add('active');
    switchView('profile');
  }

  viewProfile.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const name     = document.getElementById('profile-name').value.trim();
    const phone    = document.getElementById('profile-phone').value.trim();
    const language = document.getElementById('profile-language').value;

    if (!name) return showError('Please enter your full name.');

    setLoading(btnProfileSubmit, true, 'Saving...');
    try {
      const { error } = await supabaseClient.auth.updateUser({
        data: {
          full_name: name,
          phone: phone || null,
          preferred_language: language,
          profile_completed: true
        }
      });
      if (error) throw error;

      const pendingTarget = sessionStorage.getItem(DASHBOARD_REDIRECT_KEY);
      closeAuthModal();
      if (window.showToast) window.showToast('Profile saved. Welcome to Saliq AI!', 'success');
      goToPendingDestination(pendingTarget);

    } catch (error) {
      console.error('Profile save error:', error);
      showError(friendlyError(error));
    } finally {
      setLoading(btnProfileSubmit, false);
    }
  });

  // --- UI State ---
  function updateUIForUser(user) {
    if (user) {
      if (signInBtnNav) signInBtnNav.classList.add('auth-hidden');
      if (navProfile) navProfile.classList.add('visible');

      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
      const avatarUrl = user.user_metadata?.avatar_url;

      if (profileAvatar) {
        if (avatarUrl) {
          profileAvatar.innerHTML = `<img src="${avatarUrl}" alt="${name}">`;
        } else {
          profileAvatar.innerText = name.charAt(0).toUpperCase();
        }
      }
      if (profileEmail) profileEmail.innerText = name;

    } else {
      if (signInBtnNav) signInBtnNav.classList.remove('auth-hidden');
      if (navProfile) navProfile.classList.remove('visible');
    }
  }

  // Recover the session when the OAuth tokens arrive in a malformed fragment
  // (e.g. "#home#access_token=..." from older sign-in attempts) — the Supabase
  // client only auto-detects a fragment that STARTS with the tokens
  const rawHash = window.location.hash || '';
  if (rawHash.includes('access_token=') && !rawHash.startsWith('#access_token')) {
    const tokenParams   = new URLSearchParams(rawHash.slice(rawHash.lastIndexOf('access_token=')));
    const access_token  = tokenParams.get('access_token');
    const refresh_token = tokenParams.get('refresh_token');
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (access_token && refresh_token) {
      supabaseClient.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) {
          console.error('Session recovery failed:', error);
          openAuthModal();
          showError('Sign-in could not be completed — please try again.');
        }
      });
    }
  }

  // Surface OAuth errors that Supabase sends back in the URL after the
  // Google redirect — without this the failure is completely silent
  const hashParams  = new URLSearchParams((window.location.hash || '#').slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const oauthError  = hashParams.get('error_description') || queryParams.get('error_description')
                   || hashParams.get('error')             || queryParams.get('error');
  if (oauthError) {
    console.error('Sign-in redirect returned an error:', oauthError);
    openAuthModal();
    showError('Google sign-in failed: ' + oauthError);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // Handle the first SIGNED_IN per page load only — the event can re-fire
  // on tab refocus and must not re-open the modal or re-trigger redirects
  let signInHandled = false;

  supabaseClient.auth.onAuthStateChange((event, session) => {
    updateUIForUser(session?.user || null);

    if (event === 'SIGNED_IN' && session && !signInHandled) {
      signInHandled = true;

      const meta = session.user.user_metadata || {};
      if (!meta.profile_completed) {
        // First sign-in: ask for name and details before continuing
        openProfileForm(session.user);
        return;
      }

      const pendingTarget = sessionStorage.getItem(DASHBOARD_REDIRECT_KEY);
      closeAuthModal();
      if (window.showToast) window.showToast('Signed in successfully! Welcome.', 'success');
      goToPendingDestination(pendingTarget);
    }

    if (event === 'SIGNED_OUT') {
      signInHandled = false;
    }
  });

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    updateUIForUser(session?.user || null);
    // Signed in but never completed the profile (e.g. the SIGNED_IN event
    // was missed after the OAuth redirect) — ask for it now
    if (session && !signInHandled && !session.user.user_metadata?.profile_completed) {
      openProfileForm(session.user);
    }
  });

  // --- Sign Out ---
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      try {
        await supabaseClient.auth.signOut();
        if (window.showToast) window.showToast('Signed out successfully.', 'success');
      } catch (error) {
        console.error('Sign out error:', error);
      }
    });
  }
});
