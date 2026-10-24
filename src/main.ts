import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import { router } from './router'
import 'virtual:uno.css'
import { initializeTheme } from './composables/useTheme'
const disposeTheme = initializeTheme()
if (import.meta.hot) import.meta.hot.dispose(disposeTheme)
createApp(App).use(createPinia()).use(router).mount('#app')
