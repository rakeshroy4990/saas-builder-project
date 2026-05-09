import { createRouter, createWebHistory } from 'vue-router';
import DynamicPage from '../components/renderer/DynamicPage.vue';
import SetLocaleView from '../components/system/SetLocaleView.vue';
import NotFound from '../components/system/NotFound.vue';

const defaultPackageName =
  import.meta.env.VITE_DEFAULT_PACKAGE_NAME ?? import.meta.env.VITE_DEFAULT_NAMESPACE ?? 'ecommerce';
const defaultPageId = import.meta.env.VITE_DEFAULT_PAGE_ID ?? 'home';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: `/page/${defaultPackageName}/${defaultPageId}`
    },
    {
      path: '/page/:packageName/:pageId',
      component: DynamicPage
    },
    {
      path: '/locale/:code',
      component: SetLocaleView
    },
    {
      path: '/:pathMatch(.*)*',
      component: NotFound
    }
  ]
});
