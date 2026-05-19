// ============================================================
//  db.js — conexión a MySQL
// ============================================================
//  Este archivo corre en Node, nunca en el browser.
//  Las credenciales vienen del .env — el browser nunca las ve.
// ============================================================

const mysql  = require('mysql2')
require('dotenv').config()

// createPool maneja múltiples conexiones automáticamente.
// Es mejor que createConnection para una app real.
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Cuántas conexiones simultáneas permite el pool
  connectionLimit: 10,

  // Si la DB tarda, no se cuelga para siempre
  connectTimeout: 10000,
})

// Verificamos la conexión al arrancar
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err.message)
    console.error('   Verificá las credenciales en el archivo .env')
    return
  }
  console.log('✅ Conectado a MySQL —', process.env.DB_NAME)
  connection.release() // devolvemos la conexión al pool
})

// Exportamos la versión promise para usar async/await
module.exports = pool.promise()
