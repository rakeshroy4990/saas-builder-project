import type { TFunction } from 'i18next';

const CLOUDINARY_BASE = 'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879';

export type HomeDoctor = {
  name: string;
  speciality: string;
  degree: string;
  experience: string;
  cardLine: string;
  imageUrl: string;
};

export type HomeVideoChip = {
  id: string;
  title: string;
  videoId: string | null;
};

export type HomeContentModel = {
  heroCta: string;
  doctors: HomeDoctor[];
  videoChips: HomeVideoChip[];
};

export function buildHomeContent(t: TFunction, isDoctor: boolean): HomeContentModel {
  return {
    heroCta: isDoctor ? t('home.hero.ctaDoctor') : t('home.launcher.heroCta'),
    doctors: [
      {
        name: t('home.doctors.swati.name'),
        speciality: t('home.doctors.swati.speciality'),
        degree: t('home.doctors.swati.degree'),
        experience: t('home.doctors.swati.experience'),
        cardLine: t('home.doctors.swati.cardLine'),
        imageUrl: `${CLOUDINARY_BASE}/Dr_Swati_Pandey_rtmfqj.jpg`
      }
    ],
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
