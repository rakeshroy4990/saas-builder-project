export const CLOUDINARY_SEA_IMAGE =
  'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/sea_xgqlrq.jpg';
export const CLOUDINARY_YOUR_HEALTH_OUR_PRIORITY =
  'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/Your_Health_Our_Priority_wcrygd.jpg';
export const CLOUDINARY_KIDS_WITH_DOC =
  'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/Kids_With_Doc_ef1m5f.jpg';

export const MEDICAL_DEPARTMENT_CACHE_KEY = 'hospital.medicalDepartments';
export const APPOINTMENT_DOCTOR_CACHE_KEY = 'hospital.appointmentDoctorsByDepartment';

export const PRESCRIPTION_LIMIT_ERROR_MESSAGE =
  'Can not upload more than two images, please upload latest two images of prescription';

export const hospitalHomeContent = {
  hero: {
    title: 'Your Health, Our Priority',
    subtitle:
      'Experience compassionate care with state-of-the-art medical facilities. Our team of expert physicians is dedicated to your wellbeing.',
    image: CLOUDINARY_YOUR_HEALTH_OUR_PRIORITY,
    ctaPrimary: 'Schedule Visit',
    // ctaSecondary: 'Emergency Care'
  },
  services: [
    {
      icon: '👶',
      name: 'Pediatrics',
      description: 'Gentle and comprehensive care for children of all ages',
      /** Shown by `{{image}}` in home services list (`pages.ts` itemTemplate). Full Cloudinary URL or public id path. */
      image: CLOUDINARY_KIDS_WITH_DOC
    }
  ],
  doctors: [
    {
      name: 'Dr. Swati Pandey',
      speciality: 'Pediatrics Specialist',
      degree: 'MBBS, DNB Pediatrics, DCH (CMC Ludhiana)',
      experience: '5+ years experience',
      image: 'Dr_Swati_Pandey_rtmfqj'
    }
  ],
  highlights: [
    { title: 'Advanced Technology', detail: 'Latest medical equipment and diagnostic tools' },
    { title: 'Expert Medical Team', detail: 'Board-certified physicians and specialists' },
    // { title: '24/7 Emergency Care', detail: 'Round-the-clock emergency services' },
    { title: 'Patient-Centered Care', detail: 'Personalized treatment plans for every patient' }
  ],
  contact: {
    phone: 'Emergency: 9569955006 | Appointments: 9569955006',
    whatsapp: 'WhatsApp: 6360895190',
    email: 'EmailId: pedsforpeople@gmail.com',
    // location: '123 Medical Center Whitefield, Bangalore 560066',
    // hours: 'Monday - Friday: 8AM - 8PM'
  }
};
