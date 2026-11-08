import { SOLO_ONLY } from './deployment'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { SESSION_VERIFIER } from './composables/useAccount'

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n key shown before the app name in the tab title. */
    title?: string
  }
}
export const router = createRouter({
  history: SOLO_ONLY ? createWebHashHistory(import.meta.env.BASE_URL) : createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('./views/HomeView.vue'),
      beforeEnter: (to) =>
        Object.keys(to.query).length ? { path: '/solo', query: to.query, replace: true } : true,
    },
    {
      path: '/solo',
      component: () => import('./components/QueensGame.vue'),
      meta: { title: 'nav.solo' },
    },
    {
      path: '/tutorial',
      component: () => import('./views/TutorialView.vue'),
      meta: { title: 'nav.tutorial' },
    },
    {
      path: '/stats',
      component: () => import('./views/StatsView.vue'),
      meta: { title: 'nav.stats' },
    },
    {
      path: '/leaderboard',
      component: () => import('./views/LeaderboardView.vue'),
      meta: { title: 'leaderboard.title' },
    },
    {
      path: '/rooms',
      component: () => import('./views/RoomModeView.vue'),
      meta: { title: 'nav.coop' },
    },
    {
      path: '/rooms/new',
      component: () => import('./views/CreateRoomView.vue'),
      meta: { title: 'nav.coop' },
    },
    {
      path: '/rooms/:roomId([A-Za-z0-9]{5})',
      component: () => import('./views/CoopRoomView.vue'),
      props: (route) => ({ roomId: String(route.params.roomId).toUpperCase() }),
      meta: { title: 'nav.coop' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./views/NotFoundView.vue'),
      meta: { title: 'notFound.title' },
    },
  ],
})
// main.ts already handed the sign-in verifier to loadAccount; keep it out of every route's query.
router.beforeEach((to) => {
  if (SOLO_ONLY && (to.path === '/leaderboard' || to.path.startsWith('/rooms')))
    return { path: '/', replace: true }
  if (!(SESSION_VERIFIER in to.query)) return true
  const { [SESSION_VERIFIER]: _verifier, ...query } = to.query
  return { ...to, query, replace: true }
})
