import { createApp } from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faArrowRight,
  faChartLine,
  faCode,
  faFileLines,
  faFlag,
  faGaugeHigh,
  faListCheck,
  faMagnifyingGlass,
  faMoon,
  faPlay,
  faRankingStar,
  faSun,
  faTerminal,
  faTrophy,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import App from './App.vue'
import './style.css'
import './dark.css'
import './ark-fixes.css'
import './auth.css'
library.add(
  faArrowRight,
  faChartLine,
  faCode,
  faFileLines,
  faFlag,
  faGaugeHigh,
  faListCheck,
  faMagnifyingGlass,
  faMoon,
  faPlay,
  faRankingStar,
  faSun,
  faTerminal,
  faTrophy,
  faUser,
)
createApp(App).component('font-awesome-icon', FontAwesomeIcon).mount('#app')
