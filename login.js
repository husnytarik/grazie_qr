/* ═══════════════════════════════════
   Coffee Grazie — Login Logic
═══════════════════════════════════ */

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Zaten giriş yapılmışsa direkt admin'e yönlendir
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'admin.html';
});

async function handleLogin(e) {
  e.preventDefault();

  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtn');
  const errEl    = document.getElementById('loginError');

  errEl.textContent = '';
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged yönlendirecek
  } catch(err) {
    btn.classList.remove('loading');
    btn.disabled = false;
    errEl.textContent = getErrorMessage(err.code);
  }
}

function getErrorMessage(code) {
  const messages = {
    'auth/invalid-email':       'Geçersiz e-posta adresi.',
    'auth/user-not-found':      'Bu e-posta ile kayıtlı kullanıcı yok.',
    'auth/wrong-password':      'Şifre hatalı.',
    'auth/invalid-credential':  'E-posta veya şifre hatalı.',
    'auth/too-many-requests':   'Çok fazla deneme. Lütfen bekleyin.',
    'auth/network-request-failed': 'Bağlantı hatası. İnternet bağlantını kontrol et.',
  };
  return messages[code] || 'Giriş yapılamadı. Tekrar dene.';
}

function togglePassword() {
  const input   = document.getElementById('passwordInput');
  const icon    = document.getElementById('eyeIcon');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.innerHTML = isHidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}
