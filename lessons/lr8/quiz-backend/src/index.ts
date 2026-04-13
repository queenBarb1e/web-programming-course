import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import admin from './routes/admin.js'
import sessions from './routes/session.js'
import auth from './routes/auth.js'

const app = new Hono()

app.use('*', logger())
//app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', auth)
app.route('/api/sessions', sessions)
app.route('/api/admin', admin)

app.get('/', (c) => c.text('Quiz API Server'))

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})