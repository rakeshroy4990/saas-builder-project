package com.flexshell.controller.v1;

import com.flexshell.analytics.AnalyticsMatviewRefreshService;
import com.flexshell.analytics.AnalyticsRepository;
import com.flexshell.analytics.AnalyticsService;
import com.flexshell.controller.dto.AnalyticsRefreshResponseDto;
import com.flexshell.controller.dto.ClinicOverviewDto;
import com.flexshell.controller.dto.DailyAppointmentSummaryDto;
import com.flexshell.controller.dto.DoctorComparisonDto;
import com.flexshell.controller.dto.HeatmapCellDto;
import com.flexshell.controller.dto.NewVsReturningDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.i18n.LocalizedApiMessages;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsV1Controller {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter CSV_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(IST);

    private final AnalyticsService analyticsService;
    private final AnalyticsRepository analyticsRepository;
    private final AnalyticsMatviewRefreshService refreshService;
    private final LocalizedApiMessages messages;

    @Value("${app.analytics.csv-max-rows:10000}")
    private int csvMaxRows;

    public AnalyticsV1Controller(
            AnalyticsService analyticsService,
            AnalyticsRepository analyticsRepository,
            AnalyticsMatviewRefreshService refreshService,
            LocalizedApiMessages messages
    ) {
        this.analyticsService = analyticsService;
        this.analyticsRepository = analyticsRepository;
        this.refreshService = refreshService;
        this.messages = messages;
    }

    @GetMapping(value = "/overview", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<ClinicOverviewDto>> overview(
            @RequestParam(value = "From", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "To", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        return handle(() -> analyticsService.getOverview(
                actorId(authentication),
                roles(authentication),
                from,
                to,
                doctorId
        ), "success.analytics.overview");
    }

    @GetMapping(value = "/trend", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DailyAppointmentSummaryDto>>> trend(
            @RequestParam(value = "From", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "To", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        return handle(() -> analyticsService.getTrend(
                actorId(authentication),
                roles(authentication),
                from,
                to,
                doctorId
        ), "success.analytics.trend");
    }

    @GetMapping(value = "/heatmap", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<HeatmapCellDto>>> heatmap(
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        return handle(() -> analyticsService.getHeatmap(
                actorId(authentication),
                roles(authentication),
                doctorId
        ), "success.analytics.heatmap");
    }

    @GetMapping(value = "/retention", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Map<String, Object>>> retention(
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        return handle(() -> {
            AnalyticsService.RetentionBundle bundle = analyticsService.getRetention(
                    actorId(authentication),
                    roles(authentication),
                    doctorId
            );
            return Map.of(
                    "Retention", bundle.retention(),
                    "NewVsReturning", bundle.newVsReturning()
            );
        }, "success.analytics.retention");
    }

    @GetMapping(value = "/doctors", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorComparisonDto>>> doctors(
            @RequestParam(value = "From", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "To", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication authentication
    ) {
        return handle(() -> analyticsService.getDoctorComparison(
                actorId(authentication),
                roles(authentication),
                from,
                to
        ), "success.analytics.doctors");
    }

    @PostMapping(value = "/refresh", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AnalyticsRefreshResponseDto>> refresh(Authentication authentication) {
        try {
            analyticsService.assertAdmin(roles(authentication));
            long durationMs = refreshService.refresh("manual", actorId(authentication));
            return ResponseEntity.ok(StandardApiResponse.success(
                    messages.success("success.analytics.refreshed"),
                    new AnalyticsRefreshResponseDto(durationMs, "manual")
            ));
        } catch (SecurityException ex) {
            return forbidden();
        }
    }

    @GetMapping(value = "/export/appointments", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> exportAppointments(
            @RequestParam(value = "From", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "To", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        try {
            analyticsService.assertAnalyticsAccess(roles(authentication));
            String scopedDoctor = analyticsService.resolveScopedDoctorId(
                    actorId(authentication),
                    roles(authentication),
                    doctorId
            );
            LocalDate end = to == null ? LocalDate.now() : to;
            LocalDate start = from == null ? end.minusDays(29) : from;
            List<DailyAppointmentSummaryDto> rows = analyticsRepository.listDailyForExport(scopedDoctor, start, end);
            String filename = "agastya_analytics_appointments_" + start + "_" + end + ".csv";
            StreamingResponseBody body = outputStream -> {
                try (CSVPrinter printer = new CSVPrinter(
                        new OutputStreamWriter(outputStream, StandardCharsets.UTF_8),
                        CSVFormat.DEFAULT.builder()
                                .setHeader(
                                        "Date", "DoctorId", "TotalScheduled", "Completed", "NoShow",
                                        "Cancelled", "Rescheduled", "CompletionRatePct", "VideoCount", "InPersonCount"
                                )
                                .build()
                )) {
                    int count = 0;
                    for (DailyAppointmentSummaryDto row : rows) {
                        if (count++ >= csvMaxRows) {
                            break;
                        }
                        printer.printRecord(
                                row.appointmentDate(),
                                row.doctorId(),
                                row.totalScheduled(),
                                row.totalCompleted(),
                                row.totalNoShow(),
                                row.totalCancelled(),
                                row.totalRescheduled(),
                                row.completionRatePct(),
                                row.totalVideo(),
                                row.totalInPerson()
                        );
                    }
                    printer.flush();
                }
            };
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(body);
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping(value = "/export/patients", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> exportPatients(
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        try {
            analyticsService.assertAnalyticsAccess(roles(authentication));
            String scopedDoctor = analyticsService.resolveScopedDoctorId(
                    actorId(authentication),
                    roles(authentication),
                    doctorId
            );
            List<AnalyticsRepository.PatientExportRow> rows = analyticsRepository.listPatientExportRows(scopedDoctor, csvMaxRows);
            String filename = "agastya_analytics_patients_" + LocalDate.now() + ".csv";
            StreamingResponseBody body = outputStream -> {
                try (CSVPrinter printer = new CSVPrinter(
                        new OutputStreamWriter(outputStream, StandardCharsets.UTF_8),
                        CSVFormat.DEFAULT.builder()
                                .setHeader(
                                        "PatientName", "TotalVisits", "CompletedVisits",
                                        "FirstVisitDate", "LastVisitDate", "PatientCategory"
                                )
                                .build()
                )) {
                    for (AnalyticsRepository.PatientExportRow row : rows) {
                        printer.printRecord(
                                row.patientName(),
                                row.totalVisits(),
                                row.completedVisits(),
                                formatInstant(row.firstVisitAt()),
                                formatInstant(row.lastVisitAt()),
                                row.patientCategory()
                        );
                    }
                    printer.flush();
                }
            };
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(body);
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping(value = "/export/retention", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> exportRetention(
            @RequestParam(value = "DoctorId", required = false) String doctorId,
            Authentication authentication
    ) {
        try {
            analyticsService.assertAnalyticsAccess(roles(authentication));
            String scopedDoctor = analyticsService.resolveScopedDoctorId(
                    actorId(authentication),
                    roles(authentication),
                    doctorId
            );
            List<NewVsReturningDto> rows = analyticsRepository.getNewVsReturningByMonth(scopedDoctor, 6);
            String filename = "agastya_analytics_retention_" + LocalDate.now() + ".csv";
            StreamingResponseBody body = outputStream -> {
                try (CSVPrinter printer = new CSVPrinter(
                        new OutputStreamWriter(outputStream, StandardCharsets.UTF_8),
                        CSVFormat.DEFAULT.builder()
                                .setHeader("Month", "NewPatients", "ReturningPatients")
                                .build()
                )) {
                    for (NewVsReturningDto row : rows) {
                        printer.printRecord(row.month(), row.newPatients(), row.returningPatients());
                    }
                    printer.flush();
                }
            };
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(body);
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    private <T> ResponseEntity<StandardApiResponse<T>> handle(
            java.util.concurrent.Callable<T> supplier,
            String messageKey
    ) {
        try {
            T data = supplier.call();
            return ResponseEntity.ok(StandardApiResponse.success(messages.success(messageKey), data));
        } catch (SecurityException ex) {
            return forbidden();
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(StandardApiResponse.error(messages.forErrorCode("ANALYTICS_FAILED"), "ANALYTICS_FAILED"));
        }
    }

    private static String formatInstant(Instant instant) {
        return instant == null ? "" : CSV_DATE.format(instant);
    }

    private <T> ResponseEntity<StandardApiResponse<T>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(StandardApiResponse.error(messages.forErrorCode("ANALYTICS_FORBIDDEN"), "ANALYTICS_FORBIDDEN"));
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private static List<String> roles(Authentication authentication) {
        if (authentication == null) {
            return List.of();
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
}
