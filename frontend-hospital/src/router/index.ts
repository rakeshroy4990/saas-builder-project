import { createRouter, createWebHistory } from 'vue-router';
import DynamicPage from '../components/renderer/DynamicPage.vue';
import NotFound from '../components/system/NotFound.vue';

const defaultPageId = import.meta.env.VITE_DEFAULT_PAGE_ID ?? 'home';
const routePackageName = 'hospital';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: `/${defaultPageId}`
    },
    {
      // Explicit legacy root that used to include package name.
      path: `/${routePackageName}`,
      redirect: '/home'
    },
    {
      // Legacy full route form used by older links.
      path: '/:packageName/:pageId',
      redirect: (to) => `/${String(to.params.pageId ?? '')}`
    },
    // Legacy redirects for old bookmarked /page URLs.
    {
      path: '/page/hospital',
      redirect: '/home'
    },
    {
      path: '/page/:packageName/:pageId',
      redirect: (to) => `/${String(to.params.pageId ?? '')}`
    },
    {
      path: '/:pageId',
      component: DynamicPage
    },
    {
      path: '/:pathMatch(.*)*',
      component: NotFound
    }
  ]
});
