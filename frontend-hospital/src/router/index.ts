import { createRouter, createWebHistory } from 'vue-router';
import DynamicPage from '../components/renderer/DynamicPage.vue';
import NotFound from '../components/system/NotFound.vue';

const defaultPackageName =
  import.meta.env.VITE_DEFAULT_PACKAGE_NAME ?? import.meta.env.VITE_DEFAULT_NAMESPACE ?? 'ecommerce';
const defaultPageId = import.meta.env.VITE_DEFAULT_PAGE_ID ?? 'home';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: `/${defaultPackageName}/${defaultPageId}`
    },
    {
      path: '/hospital',
      redirect: '/hospital/home'
    },
    // Legacy redirects for old bookmarked /page URLs.
    {
      path: '/page/hospital',
      redirect: '/hospital/home'
    },
    {
      path: '/page/:packageName/:pageId',
      redirect: (to) => `/${String(to.params.packageName ?? '')}/${String(to.params.pageId ?? '')}`
    },
    {
      path: '/:packageName/:pageId',
      component: DynamicPage
    },
    {
      path: '/:pathMatch(.*)*',
      component: NotFound
    }
  ]
});
