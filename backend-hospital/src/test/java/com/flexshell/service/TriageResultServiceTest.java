package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.PdfRagTriageAdapter;
import com.flexshell.ai.PdfRagTriageAdapter.TriageAnalysisResult;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.TriageAnalyzeRequest;
import com.flexshell.controller.dto.TriageResultSaveRequest;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.model.TriageResultJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.TriageResultJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TriageResultServiceTest {

    @Mock
    private TriageResultJpaRepository triageRepository;
    @Mock
    private UserJpaRepository userRepository;
    @Mock
    private AppointmentJpaRepository appointmentRepository;
    @Mock
    private PdfRagTriageAdapter triageAdapter;
    @Mock
    private PlatformTransactionManager transactionManager;

    private TriageResultService service;

    @BeforeEach
    void setUp() {
        service = new TriageResultService(
                triageRepository,
                userRepository,
                appointmentRepository,
                triageAdapter,
                new ObjectMapper(),
                transactionManager,
                24
        );
    }

    @Test
    void analyze_escalates_neonate_home_care() {
        stubPatient("patient-1");
        when(triageAdapter.analyze(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TriageAnalysisResult(
                        "HOME_CARE",
                        "Rest at home.",
                        "Mild fever.",
                        List.of(),
                        "HIGH",
                        "gpt-4o-mini",
                        List.of()
                ));
        when(triageRepository.save(any())).thenAnswer(inv -> {
            TriageResultJpaEntity row = inv.getArgument(0);
            row.getClass();
            return row;
        });

        TriageAnalyzeRequest request = new TriageAnalyzeRequest();
        request.setChildAgeMonths(1);
        request.setReportedSymptoms(List.of("fever"));
        request.setSymptomSeverity("MILD");

        var response = service.analyze("patient-1", request, "Bearer token");

        assertEquals("CLINIC_VISIT", response.getUrgencyLevel());
    }

    @Test
    void linkToAppointment_merges_doctor_note_into_additional_notes() {
        stubPatient("patient-1");
        UUID triageId = UUID.randomUUID();
        UUID appointmentExternalId = UUID.randomUUID();

        TriageResultJpaEntity triage = new TriageResultJpaEntity();
        triage.setPatientUserId("patient-1");
        triage.setDoctorNote("Child has persistent cough.");
        when(triageRepository.findByExternalIdAndDeletedFalse(triageId)).thenReturn(Optional.of(triage));
        when(triageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AppointmentJpaEntity appointment = new AppointmentJpaEntity();
        appointment.setId("appt-1");
        appointment.setExternalId(appointmentExternalId);
        appointment.setCreatedBy("patient-1");
        appointment.setAdditionalNotes("Existing note");
        appointment.setDeleted(false);
        when(appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)).thenReturn(Optional.of(appointment));
        when(appointmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TriageResultSaveRequest saveRequest = new TriageResultSaveRequest();
        saveRequest.setExternalId(triageId);
        saveRequest.setAppointmentExternalId(appointmentExternalId);

        service.save("patient-1", saveRequest);

        ArgumentCaptor<AppointmentJpaEntity> captor = ArgumentCaptor.forClass(AppointmentJpaEntity.class);
        verify(appointmentRepository).save(captor.capture());
        assertTrue(captor.getValue().getAdditionalNotes().contains("[Pre-consultation triage]"));
        assertTrue(captor.getValue().getAdditionalNotes().contains("Child has persistent cough."));
    }

    @Test
    void findLatestForPatient_within24h_returns_recent_row() {
        TriageResultJpaEntity row = new TriageResultJpaEntity();
        row.setUrgencyLevel("CLINIC_VISIT");
        row.setUrgencyReasoning("Visit clinic");
        row.setDoctorNote("Note");
        row.setReportedSymptoms(new String[] {"fever"});
        row.setSymptomSeverity("MILD");
        row.setChildAgeMonths(12);
        row.setPatientUserId("patient-1");

        when(triageRepository.findFirstByPatientUserIdAndCreatedAtAfterAndDeletedFalseOrderByCreatedAtDesc(
                eq("patient-1"), any(Instant.class)))
                .thenReturn(Optional.of(row));

        Optional<?> result = service.findLatestForPatient("patient-1", Duration.ofHours(24));
        assertTrue(result.isPresent());
    }

    private void stubPatient(String userId) {
        UserJpaEntity user = new UserJpaEntity();
        user.setId(userId);
        user.setRole(UserRole.PATIENT);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    }
}
