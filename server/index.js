// ArkOJ backend entry point.
//   pnpm start  -> production (serves dist/ if built)
//   pnpm dev    -> watch mode
import { createApp } from './src/app.js'

const PORT = Number(process.env.PORT || 3000)

const app = createApp()
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[arkoj] server listening on http://localhost:${PORT}`)
})
