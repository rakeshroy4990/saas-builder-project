export const CLOUDINARY_SEA_IMAGE =
  'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/sea_xgqlrq.jpg';

export const MEDICAL_DEPARTMENT_CACHE_KEY = 'hospital.medicalDepartments';
export const APPOINTMENT_DOCTOR_CACHE_KEY = 'hospital.appointmentDoctorsByDepartment';

export const PRESCRIPTION_LIMIT_ERROR_MESSAGE =
  'Can not upload more than two images, please upload latest two images of prescription';

export const hospitalHomeContent = {
  hero: {
    title: 'Your Health, Our Priority',
    subtitle:
      'Experience compassionate care with state-of-the-art medical facilities. Our team of expert physicians is dedicated to your wellbeing.',
    image: CLOUDINARY_SEA_IMAGE,
    ctaPrimary: 'Schedule Visit',
    ctaSecondary: 'Emergency Care'
  },
  services: [
    {
      icon: '👶',
      name: 'Pediatrics',
      description: 'Gentle and comprehensive care for children of all ages'
    }
  ],
  doctors: [
    {
      name: 'Dr. Swati Pandey',
      speciality: 'Pediatrics Specialist',
      degree: 'MD, Stanford Medicine',
      experience: '5+ years experience',
      image: 'Dr_Swati_Pandey_rtmfqj'
    }
  ],
  highlights: [
    { title: 'Advanced Technology', detail: 'Latest medical equipment and diagnostic tools' },
    { title: 'Expert Medical Team', detail: 'Board-certified physicians and specialists' },
    { title: '24/7 Emergency Care', detail: 'Round-the-clock emergency services' },
    { title: 'Patient-Centered Care', detail: 'Personalized treatment plans for every patient' }
  ],
  contact: {
    phone: 'Emergency: 9569955006 | Appointments: 9569955006',
    location: '123 Medical Center Whitefield, Bangalore 560066',
    hours: 'Monday - Friday: 8AM - 8PM | Emergency: 24/7'
  }
};
