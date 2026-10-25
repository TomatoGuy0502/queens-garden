import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n key shown before the app name in the tab title. */
    title?: string
  }
}
export const router = createRouter({
  history: createWebHistory(),
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
