import type { TFunction } from 'i18next';

export type HomeVideoChip = {
  id: string;
  title: string;
  videoId: string | null;
};

export type HomeContentModel = {
  heroCta: string;
  videoChips: HomeVideoChip[];
};

export function buildHomeContent(t: TFunction, isDoctor: boolean): HomeContentModel {
  return {
    heroCta: isDoctor ? t('home.hero.ctaDoctor') : t('home.launcher.heroCta'),
    videoChips: [
      {
        id: 'hero',
        title: t('home.launcher.videoChipTitle'),
        videoId: null
      }
    ]
  };
}

export function withHeroVideoChip(
  chips: HomeVideoChip[],
  videoId: string | null
): HomeVideoChip[] {
  return chips.map((chip) => (chip.id === 'hero' ? { ...chip, videoId } : chip));
}
