let appointmentPrescriptionFiles: File[] = [];

export function getAppointmentPrescriptionFiles(): File[] {
  return appointmentPrescriptionFiles;
}

export function setAppointmentPrescriptionFiles(files: File[]): void {
  appointmentPrescriptionFiles = files;
}

export function clearAppointmentPrescriptionFiles(): void {
  appointmentPrescriptionFiles = [];
}
