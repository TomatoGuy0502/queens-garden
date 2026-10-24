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
    { path: '/rooms/new', component: () => import('./views/CreateRoomView.vue') },
    {
      path: '/rooms/:roomId([a-f0-9]{12})',
      component: () => import('./views/CoopRoomView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue') },
  ],
})
