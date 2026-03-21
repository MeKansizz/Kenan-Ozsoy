import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { initSchema } from './db/schema'
import kenanRoutes from './routes/kenan'

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors())
app.use(express.json())

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// Init DB
initSchema()

// Routes
app.use('/api/kenan', kenanRoutes)

// Production: serve built frontend
const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Kenan Özsoy running on http://localhost:${PORT}`)
})
