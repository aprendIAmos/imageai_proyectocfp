// ============================================================
//  server.js — servidor Express principal
// ============================================================
//  Para correrlo:
//    node server.js
//  o con auto-reload:
//    npx nodemon server.js
// ============================================================

const express = require('express')
const cors    = require('cors')
const db      = require('./db')
require('dotenv').config()

const app  = express()
const PORT = process.env.SERVER_PORT || 3000

// ─────────────────────────────────────────────
//  MIDDLEWARES
// ─────────────────────────────────────────────

app.use(cors())
app.use(express.json())

// Servimos todos los archivos estáticos desde /public
app.use(express.static('public'))


// ════════════════════════════════════════════
//  AUTENTICACIÓN
// ════════════════════════════════════════════

// ─────────────────────────────────────────────
//  POST /login
//  Body: { email, password }
//  Respuesta: { ok, user: { id, email } }
// ─────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Email y contraseña son obligatorios.' })
  }

  try {
    // Buscamos el usuario — usamos ? para evitar SQL injection
    const [rows] = await db.execute(
      'SELECT id, email FROM usuarios WHERE email = ? AND passsword = ?',
      [email, password]
    )

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, message: 'Email o contraseña incorrectos.' })
    }

    const user = rows[0]
    console.log(`✅ Login exitoso: ${user.email}`)

    // Devolvemos id y email (el front lo guarda en sessionStorage)
    return res.json({ ok: true, user: { id: user.id, email: user.email } })

  } catch (err) {
    console.error('❌ Error en /login:', err.message)
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' })
  }
})


// ─────────────────────────────────────────────
//  POST /register
//  Body: { email, password }
//  Respuesta: { ok, message, userId }
// ─────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Email y contraseña son obligatorios.' })
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    )

    if (existing.length > 0) {
      return res.status(409).json({ ok: false, message: 'Ese email ya está registrado.' })
    }

    const [result] = await db.execute(
      'INSERT INTO usuarios (email, passsword) VALUES (?, ?)',
      [email, password]
    )

    console.log(`✅ Nuevo usuario registrado: ${email}`)
    return res.status(201).json({ ok: true, message: 'Cuenta creada exitosamente.', userId: result.insertId })

  } catch (err) {
    console.error('❌ Error en /register:', err.message)
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' })
  }
})


// ════════════════════════════════════════════
//  PROMPTS — historial del sidebar
// ════════════════════════════════════════════

// ─────────────────────────────────────────────
//  GET /prompts?userId=X
//  Devuelve todos los prompts del usuario,
//  ordenados del más nuevo al más viejo.
// ─────────────────────────────────────────────
app.get('/prompts', async (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ ok: false, message: 'userId es obligatorio.' })
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, texto, created_at FROM prompts WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )

    return res.json({ ok: true, prompts: rows })

  } catch (err) {
    console.error('❌ Error en GET /prompts:', err.message)
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' })
  }
})


// ─────────────────────────────────────────────
//  DELETE /prompts/:id?userId=X
//  Elimina un prompt específico.
//  Verificamos que le pertenezca al usuario
//  antes de borrarlo (seguridad básica).
// ─────────────────────────────────────────────
app.delete('/prompts/:id', async (req, res) => {
  const { id }     = req.params
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ ok: false, message: 'userId es obligatorio.' })
  }

  try {
    const [result] = await db.execute(
      'DELETE FROM prompts WHERE id = ? AND user_id = ?',
      [id, userId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: 'Prompt no encontrado.' })
    }

    console.log(`✅ Prompt ${id} eliminado`)
    return res.json({ ok: true })

  } catch (err) {
    console.error('❌ Error en DELETE /prompts/:id:', err.message)
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' })
  }
})


// ─────────────────────────────────────────────
//  DELETE /prompts?userId=X
//  Limpia TODO el historial de un usuario.
// ─────────────────────────────────────────────
app.delete('/prompts', async (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ ok: false, message: 'userId es obligatorio.' })
  }

  try {
    await db.execute('DELETE FROM prompts WHERE user_id = ?', [userId])

    console.log(`✅ Historial limpiado para user ${userId}`)
    return res.json({ ok: true })

  } catch (err) {
    console.error('❌ Error en DELETE /prompts:', err.message)
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' })
  }
})


// ════════════════════════════════════════════
//  GENERACIÓN DE IMÁGENES — OpenAI DALL·E 3
// ════════════════════════════════════════════

// ─────────────────────────────────────────────
//  POST /generate
//  Body: { userId, prompt }
//
//  Flujo:
//    1. Llama a la API de OpenAI con el prompt
//    2. Guarda el prompt en la DB (es permanente)
//    3. Devuelve la URL temporal de la imagen
//
//  ⚠️ La URL de OpenAI expira en ~1 hora.
//     No la guardamos en DB — solo vive en la
//     sesión del browser hasta que se recarga.
// ─────────────────────────────────────────────
app.post('/generate', async (req, res) => {
  const { userId, prompt } = req.body

  if (!userId || !prompt) {
    return res.status(400).json({ ok: false, message: 'userId y prompt son obligatorios.' })
  }

  try {
    // ── 1. Llamamos a la API de OpenAI ────────────────────────
    // La API key viene del .env — el browser NUNCA la ve
    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model:  'gpt-image-1-mini',   // modelo de generación de imágenes
        prompt: prompt,
        n:      1,            // una imagen por request
        size:   '1024x1024'   // tamaño estándar cuadrado
        // response_format fue deprecado — la API devuelve URL por defecto
      })
    })

    const openaiData = await openaiResponse.json()

    // Si OpenAI devuelve error (clave inválida, contenido bloqueado, etc.)
    if (!openaiResponse.ok) {
      console.error('❌ Error de OpenAI:', openaiData.error?.message)
      return res.status(500).json({
        ok:      false,
        message: openaiData.error?.message || 'Error al generar la imagen.'
      })
    }

    // gpt-image-1-mini devuelve la imagen en base64 (campo b64_json)
    // La convertimos a un data URL para que el browser pueda mostrarla directamente
    const b64      = openaiData.data[0].b64_json
    const imageUrl = `data:image/png;base64,${b64}`

    // ── 2. Guardamos el prompt en la DB (permanente) ──────────
    const [result] = await db.execute(
      'INSERT INTO prompts (user_id, texto) VALUES (?, ?)',
      [userId, prompt]
    )

    console.log(`✅ Imagen generada para user ${userId}: "${prompt.substring(0, 50)}..."`)

    // ── 3. Respondemos al frontend ────────────────────────────
    return res.json({
      ok:       true,
      imageUrl,             // data URL en base64 — desaparece al recargar
      prompt: {
        id:         result.insertId,
        texto:      prompt,
        created_at: new Date().toISOString()
      }
    })

  } catch (err) {
    console.error('❌ Error en POST /generate:', err.message)
    return res.status(500).json({ ok: false, message: 'Error interno del servidor.' })
  }
})


// ─────────────────────────────────────────────
//  INICIAMOS EL SERVIDOR
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('─────────────────────────────────────────')
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
  console.log('   Endpoints disponibles:')
  console.log('   POST   /login          → autenticar usuario')
  console.log('   POST   /register       → registrar usuario')
  console.log('   GET    /prompts        → obtener historial')
  console.log('   DELETE /prompts/:id    → borrar un prompt')
  console.log('   DELETE /prompts        → limpiar historial')
  console.log('   POST   /generate       → generar imagen con IA')
  console.log('─────────────────────────────────────────')
})
