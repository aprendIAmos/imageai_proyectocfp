// ============================================================
//  script.js — frontend de login/registro (index.html)
// ============================================================
//  Este archivo lo ejecuta el BROWSER.
//  No tiene acceso a MySQL, no tiene require, no tiene .env.
//  Solo habla con el backend a través de HTTP (fetch).
// ============================================================


// ─────────────────────────────────────────────
//  SESIÓN: si el usuario ya está logueado,
//  lo mandamos directo al panel sin pasar por el login.
// ─────────────────────────────────────────────

if (sessionStorage.getItem('imageai_user')) {
  window.location.href = 'panel.html'
}


// ─────────────────────────────────────────────
//  URL base de la API
// ─────────────────────────────────────────────
const API_URL = 'https://creatufotoconia.onrender.com'


// ─────────────────────────────────────────────
//  VISTAS
// ─────────────────────────────────────────────
const viewFront = document.getElementById('view-front')
const viewAuth  = document.getElementById('view-auth')

const authViews = {
  login:   document.getElementById('view-login'),
  signup:  document.getElementById('view-signup'),
  loading: document.getElementById('view-loading'),
}

function showAuthSubView(name) {
  Object.values(authViews).forEach(v => v.classList.add('hidden'))
  authViews[name].classList.remove('hidden')
}

// Front page → Auth
document.getElementById('goToAuth').addEventListener('click', () => {
  viewFront.classList.add('hidden')
  viewAuth.classList.remove('hidden')
  showAuthSubView('login')
})

// Login ↔ Signup
document.getElementById('goToSignup').addEventListener('click', (e) => {
  e.preventDefault()
  clearForm('signup')
  showAuthSubView('signup')
})
document.getElementById('goToLogin').addEventListener('click', (e) => {
  e.preventDefault()
  clearForm('login')
  showAuthSubView('login')
})


// ─────────────────────────────────────────────
//  TOGGLE PASSWORD
// ─────────────────────────────────────────────
document.querySelectorAll('.toggle-pass').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input  = document.getElementById(btn.dataset.target)
    const svg    = btn.querySelector('.eye-icon')
    const isPass = input.type === 'password'
    input.type   = isPass ? 'text' : 'password'
    svg.innerHTML = isPass
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>`
  })
})


// ─────────────────────────────────────────────
//  VALIDACIONES
// ─────────────────────────────────────────────
function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
}
function setError(inputId, errorId, msg) {
  document.getElementById(inputId).classList.add('is-error')
  document.getElementById(errorId).textContent = msg
}
function clearError(inputId, errorId) {
  document.getElementById(inputId).classList.remove('is-error')
  document.getElementById(errorId).textContent = ''
}
function clearForm(prefix) {
  [`${prefix}-email`, `${prefix}-password`].forEach(id => {
    const el = document.getElementById(id)
    if (el) { el.value = ''; el.classList.remove('is-error') }
  });
  [`${prefix}-email-error`, `${prefix}-password-error`].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.textContent = ''
  })
}
['login-email','login-password','signup-email','signup-password'].forEach(id => {
  const el = document.getElementById(id)
  if (el) el.addEventListener('input', () => clearError(id, `${id}-error`))
})


// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
const toast     = document.getElementById('toast')
const toastMsg  = document.getElementById('toastMsg')
const toastIcon = document.getElementById('toastIcon')
let toastTimeout

function showToast(type, message) {
  clearTimeout(toastTimeout)
  toast.className = `toast ${type}`
  toastIcon.textContent = type === 'success' ? '✅' : '❌'
  toastMsg.textContent  = message
  void toast.offsetWidth
  toast.classList.add('show')
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500)
}

function showLoading(title, subtitle) {
  document.getElementById('loading-title').textContent    = title
  document.getElementById('loading-subtitle').textContent = subtitle
  showAuthSubView('loading')
}


// ─────────────────────────────────────────────
//  LOGIN — llama a POST /login
// ─────────────────────────────────────────────
document.getElementById('loginBtn').addEventListener('click', handleLogin)
document.getElementById('login-email').addEventListener('keydown',    e => e.key === 'Enter' && handleLogin())
document.getElementById('login-password').addEventListener('keydown', e => e.key === 'Enter' && handleLogin())

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  let hasError   = false

  if (!email) {
    setError('login-email', 'login-email-error', 'El email es obligatorio.'); hasError = true
  } else if (!isValidEmail(email)) {
    setError('login-email', 'login-email-error', 'Ingresá un email válido.'); hasError = true
  }
  if (!password) {
    setError('login-password', 'login-password-error', 'La contraseña es obligatoria.'); hasError = true
  }
  if (hasError) return

  showLoading('Welcome back 👋', 'Verificando credenciales...')

  try {
    // Enviamos email y password al backend
    const response = await fetch(`${API_URL}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (data.ok) {
      // ── GUARDAMOS LA SESIÓN EN sessionStorage ─────────────
      // sessionStorage se borra al cerrar la pestaña o el browser.
      // Guardamos { id, email } como JSON para usarlo en panel.js
      sessionStorage.setItem('imageai_user', JSON.stringify(data.user))

      // Redirigimos al panel
      window.location.href = 'panel.html'

    } else {
      showAuthSubView('login')
      showToast('error', data.message)
    }

  } catch (err) {
    showAuthSubView('login')
    showToast('error', 'No se pudo conectar con el servidor.')
    console.error('❌ Error de red:', err.message)
  }
}


// ─────────────────────────────────────────────
//  SIGN UP — llama a POST /register
// ─────────────────────────────────────────────
document.getElementById('signupBtn').addEventListener('click', handleSignup)
document.getElementById('signup-email').addEventListener('keydown',    e => e.key === 'Enter' && handleSignup())
document.getElementById('signup-password').addEventListener('keydown', e => e.key === 'Enter' && handleSignup())

async function handleSignup() {
  const email    = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  let hasError   = false

  if (!email) {
    setError('signup-email', 'signup-email-error', 'El email es obligatorio.'); hasError = true
  } else if (!isValidEmail(email)) {
    setError('signup-email', 'signup-email-error', 'Ingresá un email válido.'); hasError = true
  }
  if (!password) {
    setError('signup-password', 'signup-password-error', 'La contraseña es obligatoria.'); hasError = true
  } else if (password.length < 6) {
    setError('signup-password', 'signup-password-error', 'Mínimo 6 caracteres.'); hasError = true
  }
  if (hasError) return

  showLoading("Let's Get Started 🚀", 'Creando tu cuenta...')

  try {
    const response = await fetch(`${API_URL}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (data.ok) {
      clearForm('signup')
      showAuthSubView('login')
      showToast('success', '¡Cuenta creada! Ya podés iniciar sesión.')
    } else {
      showAuthSubView('signup')
      showToast('error', data.message)
    }

  } catch (err) {
    showAuthSubView('signup')
    showToast('error', 'No se pudo conectar con el servidor.')
    console.error('❌ Error de red:', err.message)
  }
}
