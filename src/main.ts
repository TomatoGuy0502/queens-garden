import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import { router } from './router'
import 'virtual:uno.css'
import { initializeTheme } from './composables/useTheme'
import { initializeLocale } from './composables/useLocale'
import { i18n } from './i18n'
const disposeTheme = initializeTheme()
const disposeLocale = initializeLocale()
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposeTheme()
    disposeLocale()
  })
createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
