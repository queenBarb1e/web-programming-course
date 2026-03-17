import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import authRoutes from './routes/auth.js'
import 'dotenv/config'

const app = new Hono<{
  Bindings: { JWT_SECRET: string }
}>().use(async (c, next) => {
  c.env.JWT_SECRET = process.env.JWT_SECRET || ''
  await next()
})

// Checkpoint 1
app.get('/health', (c) => c.json({ status: 'ok' }))

 
// Checkpoint 3
app.route('/api/auth', authRoutes)


serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
