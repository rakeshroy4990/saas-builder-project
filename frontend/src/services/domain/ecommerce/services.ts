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
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80'
  },
  categories: [
    {
      name: 'Women',
      caption: 'Effortless everyday essentials',
      image:
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Men',
      caption: 'Relaxed fits and utility layers',
      image:
        'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Accessories',
      caption: 'Caps, bags, and daily carry',
      image:
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'
    }
  ],
  products: [
    {
      name: 'Cloud Knit Hoodie',
      price: '$79',
      color: 'Heather Gray',
      image:
        'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?auto=format&fit=crop&w=900&q=80'
    },
    {
      name: 'AirFlex Cargo Pants',
      price: '$68',
      color: 'Olive',
      image:
        'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=80'
    },
    {
      name: 'Luna Ribbed Top',
      price: '$44',
      color: 'Ivory',
      image:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'
    },
    {
      name: 'Metro Trainer',
      price: '$92',
      color: 'Black / White',
      image:
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80'
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
