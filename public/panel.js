// ============================================================
//  panel.js — lógica del panel principal (post-login)
// ============================================================
//  Este archivo lo ejecuta el BROWSER.
//  No tiene acceso a MySQL ni a .env.
//  Habla con el backend mediante fetch().
//
//  SESIÓN: usamos sessionStorage para guardar el usuario.
//  sessionStorage se borra automáticamente al cerrar la pestaña.
//  Es la opción más simple y didáctica para este proyecto.
// ============================================================


// ─────────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────────

const API_URL = 'http://localhost:3000'


// ─────────────────────────────────────────────
//  PROTECCIÓN DE RUTA
//
//  Si el usuario no está logueado (no hay datos
//  en sessionStorage), lo mandamos al login.
//  Esto evita acceder a panel.html directamente.
// ─────────────────────────────────────────────

// Intentamos leer los datos del usuario guardados al hacer login
const sessionUser = sessionStorage.getItem('imageai_user')

if (!sessionUser) {
  // No hay sesión → redirigir al login
  window.location.href = 'index.html'
}

// Parseamos el objeto { id, email } guardado como JSON
const currentUser = JSON.parse(sessionUser)


// ─────────────────────────────────────────────
//  REFERENCIAS AL DOM
// ─────────────────────────────────────────────

const promptList      = document.getElementById('promptList')
const emptyState      = document.getElementById('emptyState')
const btnClearAll     = document.getElementById('btnClearAll')
const btnLogout       = document.getElementById('btnLogout')
const userEmail       = document.getElementById('userEmail')
const userAvatar      = document.getElementById('userAvatar')

const imagePlaceholder = document.getElementById('imagePlaceholder')
const imageLoading     = document.getElementById('imageLoading')
const imageResult      = document.getElementById('imageResult')
const generatedImage   = document.getElementById('generatedImage')
const imageCaption     = document.getElementById('imageCaption')

const promptInput      = document.getElementById('promptInput')
const charCount        = document.getElementById('charCount')
const btnGenerate      = document.getElementById('btnGenerate')

const toast            = document.getElementById('toast')
const toastMsg         = document.getElementById('toastMsg')
const toastIcon        = document.getElementById('toastIcon')


// ─────────────────────────────────────────────
//  INICIALIZACIÓN
//
//  Apenas carga la página:
//    1. Mostramos el email del usuario en el sidebar
//    2. Cargamos su historial de prompts desde la DB
// ─────────────────────────────────────────────

function init() {
  // Mostramos el email y la inicial del avatar
  userEmail.textContent  = currentUser.email
  userAvatar.textContent = currentUser.email.charAt(0).toUpperCase()

  // Cargamos el historial desde el backend
  loadPrompts()
}

// Llamamos init cuando el DOM esté listo
init()


// ─────────────────────────────────────────────
//  TOAST — notificaciones visuales
// ─────────────────────────────────────────────

let toastTimeout

function showToast(type, message) {
  clearTimeout(toastTimeout)
  toast.className    = `toast ${type}`
  toastIcon.textContent = type === 'success' ? '✅' : '❌'
  toastMsg.textContent  = message
  void toast.offsetWidth          // fuerza reflow para reiniciar la animación
  toast.classList.add('show')
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500)
}


// ─────────────────────────────────────────────
//  CONTADOR DE CARACTERES del textarea
// ─────────────────────────────────────────────

promptInput.addEventListener('input', () => {
  const len = promptInput.value.length
  charCount.textContent = `${len} / 1000`
})


// ═══════════════════════════════════════════════
//  HISTORIAL DE PROMPTS — SIDEBAR
// ═══════════════════════════════════════════════

// ─────────────────────────────────────────────
//  loadPrompts()
//  Llama a GET /prompts?userId=X
//  y renderiza la lista en el sidebar.
// ─────────────────────────────────────────────

async function loadPrompts() {
  try {
    const response = await fetch(`${API_URL}/prompts?userId=${currentUser.id}`)
    const data     = await response.json()

    if (!data.ok) {
      console.error('❌ Error al cargar prompts:', data.message)
      return
    }

    // Renderizamos cada prompt en el sidebar
    renderPromptList(data.prompts)

  } catch (err) {
    console.error('❌ Error de red al cargar prompts:', err.message)
  }
}


// ─────────────────────────────────────────────
//  renderPromptList(prompts)
//  Vacía la lista y la reconstruye con los datos.
//  Muestra el estado vacío si no hay prompts.
// ─────────────────────────────────────────────

function renderPromptList(prompts) {
  // Limpiamos la lista anterior
  promptList.innerHTML = ''

  if (prompts.length === 0) {
    // Sin historial → mostramos el estado vacío
    emptyState.classList.remove('hidden')
    return
  }

  // Hay prompts → ocultamos el estado vacío
  emptyState.classList.add('hidden')

  // Creamos un <li> por cada prompt
  prompts.forEach(prompt => {
    const li = createPromptItem(prompt)
    promptList.appendChild(li)
  })
}


// ─────────────────────────────────────────────
//  createPromptItem(prompt)
//  Crea el elemento <li> de un prompt
//  con su ícono, texto truncado y botón de borrar.
// ─────────────────────────────────────────────

function createPromptItem(prompt) {
  const li = document.createElement('li')
  li.className    = 'prompt-item'
  li.dataset.id   = prompt.id   // guardamos el id para poder borrarlo

  li.innerHTML = `
    <!-- Ícono de imagen -->
    <svg class="prompt-item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>

    <!-- Texto del prompt (truncado con CSS) -->
    <span class="prompt-item-text" title="${escapeHtml(prompt.texto)}">${escapeHtml(prompt.texto)}</span>

    <!-- Botón eliminar este prompt -->
    <button class="prompt-item-delete" title="Eliminar" data-id="${prompt.id}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `

  // Listener en el botón de borrar
  li.querySelector('.prompt-item-delete').addEventListener('click', (e) => {
    e.stopPropagation() // evita que dispare el click del <li>
    deletePrompt(prompt.id, li)
  })

  return li
}


// ─────────────────────────────────────────────
//  deletePrompt(id, liElement)
//  Llama a DELETE /prompts/:id y elimina el <li>.
// ─────────────────────────────────────────────

async function deletePrompt(id, liElement) {
  try {
    const response = await fetch(`${API_URL}/prompts/${id}?userId=${currentUser.id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (!data.ok) {
      showToast('error', 'No se pudo eliminar el prompt.')
      return
    }

    // Eliminamos el elemento del DOM con animación suave
    liElement.style.opacity    = '0'
    liElement.style.transition = 'opacity 0.2s'
    setTimeout(() => {
      liElement.remove()
      // Si ya no quedan items, mostramos el estado vacío
      if (promptList.children.length === 0) {
        emptyState.classList.remove('hidden')
      }
    }, 200)

  } catch (err) {
    showToast('error', 'Error de red al eliminar.')
    console.error('❌ Error al eliminar prompt:', err.message)
  }
}


// ─────────────────────────────────────────────
//  Botón "Limpiar todo"
//  Llama a DELETE /prompts?userId=X
// ─────────────────────────────────────────────

btnClearAll.addEventListener('click', async () => {
  // Confirmación simple antes de borrar todo
  if (!confirm('¿Seguro que querés limpiar todo el historial?')) return

  try {
    const response = await fetch(`${API_URL}/prompts?userId=${currentUser.id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (!data.ok) {
      showToast('error', 'No se pudo limpiar el historial.')
      return
    }

    // Limpiamos la lista del DOM
    promptList.innerHTML = ''
    emptyState.classList.remove('hidden')
    showToast('success', 'Historial limpiado.')

  } catch (err) {
    showToast('error', 'Error de red al limpiar.')
    console.error('❌ Error al limpiar historial:', err.message)
  }
})


// ═══════════════════════════════════════════════
//  GENERACIÓN DE IMÁGENES
// ═══════════════════════════════════════════════

// ─────────────────────────────────────────────
//  Botón "Generar" + Enter (Ctrl+Enter en textarea)
// ─────────────────────────────────────────────

btnGenerate.addEventListener('click', handleGenerate)

// Ctrl+Enter o Cmd+Enter para generar sin salir del textarea
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleGenerate()
  }
})


// ─────────────────────────────────────────────
//  handleGenerate()
//  Orquesta todo el flujo de generación:
//    1. Valida que haya texto
//    2. Muestra el loading
//    3. Llama a POST /generate en el backend
//    4. Muestra la imagen o el error
//    5. Agrega el prompt al sidebar
// ─────────────────────────────────────────────

async function handleGenerate() {
  const prompt = promptInput.value.trim()

  // Validación básica
  if (!prompt) {
    showToast('error', 'Escribí un prompt antes de generar.')
    promptInput.focus()
    return
  }

  // ── 1. Estado de carga ────────────────────────────────────
  setImageState('loading')
  btnGenerate.disabled = true

  try {
    // ── 2. Llamamos al backend ────────────────────────────────
    // El backend llama a OpenAI con la API key del .env
    const response = await fetch(`${API_URL}/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        userId: currentUser.id,
        prompt
      })
    })

    const data = await response.json()

    if (!data.ok) {
      // Error del backend (OpenAI rechazó el prompt, etc.)
      setImageState('placeholder')
      showToast('error', data.message || 'Error al generar la imagen.')
      return
    }

    // ── 3. Mostramos la imagen generada ───────────────────────
    // La URL de OpenAI es temporal — dura ~1 hora
    // Si el usuario recarga, la imagen desaparece (comportamiento esperado)
    showGeneratedImage(data.imageUrl, prompt)

    // ── 4. Agregamos el prompt al sidebar ─────────────────────
    addPromptToSidebar(data.prompt)

    // Limpiamos el textarea
    promptInput.value     = ''
    charCount.textContent = '0 / 1000'

    showToast('success', '¡Imagen generada!')

  } catch (err) {
    setImageState('placeholder')
    showToast('error', 'No se pudo conectar con el servidor.')
    console.error('❌ Error al generar imagen:', err.message)

  } finally {
    // Siempre rehabilitamos el botón al terminar
    btnGenerate.disabled = false
  }
}


// ─────────────────────────────────────────────
//  setImageState(state)
//  Controla qué se muestra en la zona de imagen.
//  Estados: 'placeholder' | 'loading' | 'result'
// ─────────────────────────────────────────────

function setImageState(state) {
  imagePlaceholder.classList.add('hidden')
  imageLoading.classList.add('hidden')
  imageResult.classList.add('hidden')

  if (state === 'placeholder') imagePlaceholder.classList.remove('hidden')
  if (state === 'loading')     imageLoading.classList.remove('hidden')
  if (state === 'result')      imageResult.classList.remove('hidden')
}


// ─────────────────────────────────────────────
//  showGeneratedImage(url, promptText)
//  Pone la imagen en el <img> y muestra el área.
// ─────────────────────────────────────────────

function showGeneratedImage(url, promptText) {
  generatedImage.src          = url
  imageCaption.textContent    = `"${promptText}"`
  setImageState('result')
}


// ─────────────────────────────────────────────
//  addPromptToSidebar(prompt)
//  Agrega el nuevo prompt al principio de la lista
//  sin necesitar recargar todo desde la DB.
// ─────────────────────────────────────────────

function addPromptToSidebar(prompt) {
  // Ocultamos el estado vacío si estaba visible
  emptyState.classList.add('hidden')

  // Creamos el elemento y lo insertamos al inicio
  const li = createPromptItem(prompt)
  promptList.insertBefore(li, promptList.firstChild)
}


// ═══════════════════════════════════════════════
//  CERRAR SESIÓN
// ═══════════════════════════════════════════════

btnLogout.addEventListener('click', () => {
  // Borramos los datos de sesión del browser
  sessionStorage.removeItem('imageai_user')

  // Redirigimos al login
  window.location.href = 'index.html'
})


// ═══════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════

// ─────────────────────────────────────────────
//  escapeHtml(str)
//  Escapa caracteres especiales HTML para evitar
//  XSS al insertar texto del usuario en el DOM.
// ─────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
