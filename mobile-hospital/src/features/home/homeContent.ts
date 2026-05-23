import type { TFunction } from 'i18next';

const CLOUDINARY_BASE = 'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879';

export type HomeDoctor = {
  name: string;
  speciality: string;
  degree: string;
  experience: string;
  imageUrl: string;
};

export type HomeService = {
  icon: string;
  name: string;
  description: string;
  imageUrl: string;
};

export type HomeHighlight = {
  title: string;
  detail: string;
};

export type HomeContentModel = {
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
  };
  doctors: HomeDoctor[];
  services: HomeService[];
  highlights: HomeHighlight[];
  contact: {
    heading: string;
    whatsapp: string;
    email: string;
  };
  sections: {
    doctorsHeading: string;
    doctorsSubheading: string;
    servicesHeading: string;
    servicesSubheading: string;
    highlightsHeading: string;
  };
};

export function buildHomeContent(t: TFunction, isDoctor: boolean): HomeContentModel {
  return {
    hero: {
      title: t('home.hero.title'),
      subtitle: t('home.hero.subtitle'),
      ctaPrimary: isDoctor ? t('home.hero.ctaDoctor') : t('home.hero.ctaPrimary')
    },
    sections: {
      doctorsHeading: t('home.section.doctors.heading'),
      doctorsSubheading: t('home.section.doctors.subheading'),
      servicesHeading: t('home.section.services.heading'),
      servicesSubheading: t('home.section.services.subheading'),
      highlightsHeading: t('home.section.highlights.heading')
    },
    doctors: [
      {
        name: t('home.doctors.swati.name'),
        speciality: t('home.doctors.swati.speciality'),
        degree: t('home.doctors.swati.degree'),
        experience: t('home.doctors.swati.experience'),
        imageUrl: `${CLOUDINARY_BASE}/Dr_Swati_Pandey_rtmfqj.jpg`
      }
    ],
    services: [
      {
        icon: '👶',
        name: t('home.services.pediatrics.name'),
        description: t('home.services.pediatrics.description'),
        imageUrl: `${CLOUDINARY_BASE}/Kids_With_Doc_ef1m5f.jpg`
      }
    ],
    highlights: [
      { title: t('home.highlights.tech.title'), detail: t('home.highlights.tech.detail') },
      { title: t('home.highlights.team.title'), detail: t('home.highlights.team.detail') },
      { title: t('home.highlights.care.title'), detail: t('home.highlights.care.detail') }
    ],
    contact: {
      heading: t('home.section.contact.heading'),
      whatsapp: t('home.contact.whatsapp'),
      email: t('home.contact.email')
    }
  };
}
