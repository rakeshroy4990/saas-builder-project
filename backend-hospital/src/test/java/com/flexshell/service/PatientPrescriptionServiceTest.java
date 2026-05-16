package com.flexshell.service;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.PatientPrescriptionUploadResponse;
import com.flexshell.persistence.postgres.model.PatientPrescriptionJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionGroupItemJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionGroupJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import com.flexshell.storage.PrescriptionFileStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PatientPrescriptionServiceTest {

    @Mock
    private PatientPrescriptionJpaRepository prescriptionRepository;
    @Mock
    private PatientPrescriptionGroupJpaRepository groupRepository;
    @Mock
    private PatientPrescriptionGroupItemJpaRepository groupItemRepository;
    @Mock
    private AppointmentJpaRepository appointmentRepository;
    @Mock
    private UserJpaRepository userRepository;
    @Mock
    private PrescriptionFileStorage storageService;
    @Mock
    private PatientPrescriptionExtractionWorker extractionWorker;

    private PatientPrescriptionService service;

    @BeforeEach
    void setUp() {
        service = new PatientPrescriptionService(
                prescriptionRepository,
                groupRepository,
                groupItemRepository,
                appointmentRepository,
                userRepository,
                storageService,
                extractionWorker,
                900
        );
    }

    @Test
    void upload_returnsDuplicateWhenHashExists() {
        byte[] bytes = "same-content".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "rx.jpg", "image/jpeg", bytes);

        PatientPrescriptionJpaEntity existing = new PatientPrescriptionJpaEntity();
        existing.setExternalId(UUID.randomUUID());
        existing.setPatientUserId("user-1");
        existing.setUploadedBy("user-1");
        existing.setStatus("verified");

        when(prescriptionRepository.findByFileHashAndDeletedFalse(anyString())).thenReturn(Optional.of(existing));

        PatientPrescriptionUploadResponse response = service.upload("user-1", file, null, null, null);

        assertTrue(response.isDuplicate());
        assertEquals(existing.getExternalId(), response.externalId());
        verify(storageService, never()).upload(anyString(), any(), anyString());
        verify(prescriptionRepository, never()).save(any());
    }

    @Test
    void upload_rejectsUnsupportedMime() {
        MockMultipartFile file = new MockMultipartFile("file", "doc.docx", "application/msword", new byte[] {1, 2, 3});
        assertThrows(IllegalArgumentException.class, () -> service.upload("user-1", file, null, null, null));
    }

    @Test
    void listForActor_doctorQueriesByDoctorId() {
        UserJpaEntity doctor = new UserJpaEntity();
        doctor.setId("doctor-1");
        doctor.setRole(UserRole.DOCTOR);
        when(userRepository.findById("doctor-1")).thenReturn(Optional.of(doctor));

        PatientPrescriptionJpaEntity row = new PatientPrescriptionJpaEntity();
        row.setExternalId(UUID.randomUUID());
        row.setDoctorId("doctor-1");
        row.setPatientUserId("patient-1");
        row.setStatus("verified");
        when(prescriptionRepository.findByDoctorIdAndDeletedFalse("doctor-1", Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(row)));

        var page = service.listForActor("doctor-1", Pageable.unpaged());

        assertEquals(1, page.getTotalElements());
        verify(prescriptionRepository).findByDoctorIdAndDeletedFalse("doctor-1", Pageable.unpaged());
    }
}
