import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../store/useAppStore';
import { apiClient } from '../../http/apiClient';
import { URLRegistry } from '../../http/URLRegistry';

const asSuccess = (data: Record<string, unknown> = {}) => ({ responseCode: 'SUCCESS', ...data });

const demoHomeContent = {
  menu: [
    { label: 'New Arrivals' },
    { label: 'Women' },
    { label: 'Men' },
    { label: 'Accessories' },
    { label: 'Sale' }
  ],
  hero: {
    badge: 'Spring 2026 Collection',
    title: 'Comfort-first streetwear for everyday movement',
    subtitle: 'Breathable fabrics, modern fits, and fresh colors curated weekly.',
    ctaPrimary: 'Shop Women',
    ctaSecondary: 'Shop Men',
    image: 'sea_xgqlrq.jpg'
  },
  categories: [
    {
      name: 'Women',
      caption: 'Effortless everyday essentials',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Men',
      caption: 'Relaxed fits and utility layers',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Accessories',
      caption: 'Caps, bags, and daily carry',
      image: 'sea_xgqlrq.jpg'
    }
  ],
  products: [
    {
      name: 'Cloud Knit Hoodie',
      price: '$79',
      color: 'Heather Gray',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'AirFlex Cargo Pants',
      price: '$68',
      color: 'Olive',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Luna Ribbed Top',
      price: '$44',
      color: 'Ivory',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Metro Trainer',
      price: '$92',
      color: 'Black / White',
      image: 'sea_xgqlrq.jpg'
    }
  ]
};

export const ecommerceServices: ServiceDefinition[] = [
  {
    packageName: 'ecommerce',
    serviceId: 'load-home-content',
    execute: async () => {
      useAppStore().setData('ecommerce', 'HomeContent', demoHomeContent);
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'load-products',
    execute: async () => {
      const store = useAppStore();
      try {
        const response = await apiClient.get(URLRegistry.paths.products);
        const payload = response.data ?? {};
        store.setData('ecommerce', 'Products', payload);
        if (!store.getData('ecommerce', 'HomeContent')) {
          store.setData('ecommerce', 'HomeContent', {
            ...demoHomeContent,
            products: payload.items ?? demoHomeContent.products
          });
        }
      } catch {
        store.setData('ecommerce', 'Products', { items: demoHomeContent.products });
        store.setData('ecommerce', 'HomeContent', demoHomeContent);
      }
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'load-cart',
    execute: async () => {
      useAppStore().setData('ecommerce', 'Cart', { cartId: 'cart-1', items: [] });
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'process-checkout',
    responseCodes: { failure: ['PAYMENT_FAILED'] },
    execute: async () => asSuccess({ orderId: 'ORD-001' })
  },
  { packageName: 'ecommerce', serviceId: 'load-product-detail', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'add-to-cart', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'update-cart-line', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'remove-cart-line', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'load-orders', execute: async () => asSuccess() }
];
