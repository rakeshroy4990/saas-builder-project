import type { ComposerTranslation } from 'vue-i18n';
import { CLOUDINARY_KIDS_WITH_DOC } from '../shared/constants';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';

type HeroVideoKind = 'shorts' | 'video' | null;

/** Builds `HomeContent` from vue-i18n so hero/services/highlights follow the language selector. */
export function buildHospitalHomeContent(
  t: ComposerTranslation,
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const isDoctor = String(authSession.role ?? '').trim().toUpperCase() === 'DOCTOR';
  const prevHero =
    existing && typeof existing.hero === 'object' && existing.hero !== null
      ? (existing.hero as Record<string, unknown>)
      : {};
  const videoId = prevHero.videoId != null ? prevHero.videoId : null;
  const videoKind = (prevHero.videoKind as HeroVideoKind) ?? null;

  const prevStats = existing?.stats;

  return {
    hero: {
      title: t('home.hero.title'),
      subtitle: t('home.hero.subtitle'),
      videoId,
      videoKind,
      ctaPrimary: isDoctor ? t('home.hero.ctaDoctor') : t('home.hero.ctaPrimary')
    },
    sections: {
      doctors: {
        heading: t('home.section.doctors.heading'),
        subheading: t('home.section.doctors.subheading')
      },
      services: {
        heading: t('home.section.services.heading'),
        subheading: t('home.section.services.subheading')
      },
      highlights: {
        heading: t('home.section.highlights.heading')
      },
      contact: {
        heading: t('home.section.contact.heading')
      }
    },
    services: [
      {
        icon: '👶',
        name: t('home.services.pediatrics.name'),
        description: t('home.services.pediatrics.description'),
        image: CLOUDINARY_KIDS_WITH_DOC
      }
    ],
    doctors: [
      {
        name: t('home.doctors.swati.name'),
        speciality: t('home.doctors.swati.speciality'),
        degree: t('home.doctors.swati.degree'),
        experience: t('home.doctors.swati.experience'),
        image: 'Dr_Swati_Pandey_rtmfqj'
      }
    ],
    highlights: [
      { title: t('home.highlights.tech.title'), detail: t('home.highlights.tech.detail') },
      { title: t('home.highlights.team.title'), detail: t('home.highlights.team.detail') },
      { title: t('home.highlights.care.title'), detail: t('home.highlights.care.detail') }
    ],
    contact: {
      whatsapp: t('home.contact.whatsapp'),
      email: t('home.contact.email')
    },
    stats: Array.isArray(prevStats) ? prevStats : []
  };
}
