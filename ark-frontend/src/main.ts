import { createApp } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import '@fortawesome/fontawesome-free/css/all.min.css'
import '@fontsource/libre-barcode-128'
import './index.css'
import App from './App.vue'
import router from './router'
import { initTheme } from './lib/theme'
import { restoreSession } from './lib/session'

initTheme()
const app = createApp(App).use(router)
app.component('FontAwesomeIcon', FontAwesomeIcon)
// 恢复会话后再挂载，避免首页闪烁
void restoreSession().finally(() => app.mount('#app'))
