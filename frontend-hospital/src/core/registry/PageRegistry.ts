import type { PageConfig } from '../types/PageConfig';

export class PageRegistry {
  private static instance: PageRegistry;
  private readonly pages = new Map<string, PageConfig>();

  static getInstance(): PageRegistry {
    if (!PageRegistry.instance) {
      PageRegistry.instance = new PageRegistry();
    }
    return PageRegistry.instance;
  }

  register(config: PageConfig): void {
    this.pages.set(`${config.packageName}::${config.pageId}`, config);
  }

  get(packageName: string, pageId: string): PageConfig | undefined {
    return this.pages.get(`${packageName}::${pageId}`);
  }
}
