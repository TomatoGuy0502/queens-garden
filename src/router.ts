import { createRouter, createWebHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('./views/HomeView.vue'),
      beforeEnter: (to) =>
        Object.keys(to.query).length ? { path: '/solo', query: to.query, replace: true } : true,
    },
    { path: '/solo', component: () => import('./components/QueensGame.vue') },
    { path: '/stats', component: () => import('./views/StatsView.vue') },
    { path: '/rooms/new', component: () => import('./views/CreateRoomView.vue') },
    {
      path: '/rooms/:roomId([A-Za-z0-9]{5})',
      component: () => import('./views/CoopRoomView.vue'),
      props: (route) => ({ roomId: String(route.params.roomId).toUpperCase() }),
    },
    { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue') },
  ],
})
