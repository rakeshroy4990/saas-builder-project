package com.flexshell.service;

import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.DoctorScheduleDayDto;
import com.flexshell.controller.dto.DoctorScheduleQueryDto;
import com.flexshell.controller.dto.DoctorScheduleResponse;
import com.flexshell.controller.dto.DoctorScheduleUpsertRequest;
import com.flexshell.controller.dto.PagedDoctorScheduleListDto;
import com.flexshell.controller.support.EntityQuerySupport;
import com.flexshell.controller.dto.DoctorScheduleWindowDto;
import com.flexshell.doctorschedule.DoctorScheduleDay;
import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.persistence.api.DoctorScheduleAccess;
import com.flexshell.doctorschedule.DoctorScheduleWindow;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class DoctorScheduleService {
    public static final Set<String> DAY_KEYS = Set.of("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN");

    private final ObjectProvider<DoctorScheduleAccess> doctorScheduleAccessProvider;
    private final ObjectProvider<UserAccess> userAccessProvider;

    public DoctorScheduleService(
            ObjectProvider<DoctorScheduleAccess> doctorScheduleAccessProvider,
            ObjectProvider<UserAccess> userAccessProvider) {
        this.doctorScheduleAccessProvider = doctorScheduleAccessProvider;
        this.userAccessProvider = userAccessProvider;
    }

    public Optional<DoctorScheduleResponse> getSchedule(String doctorId, String actorUserId) {
        String docId = normalize(doctorId);
        if (docId.isBlank()) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_DOCTOR_ID_REQUIRED");
        }
        ensureCanReadSchedule(actorUserId, docId);
        return requireScheduleAccess().findByDoctorId(docId).map(this::toResponse);
    }

    /** Default shape when no Mongo document exists yet (not persisted until PUT). */
    public DoctorScheduleResponse emptyShellForDoctor(String doctorId) {
        DoctorScheduleResponse r = new DoctorScheduleResponse();
        r.setDoctorId(normalize(doctorId));
        Map<String, DoctorScheduleDayDto> weekly = new LinkedHashMap<>();
        for (String key : DAY_KEYS) {
            DoctorScheduleDayDto dto = new DoctorScheduleDayDto();
            dto.setEnabled(false);
            dto.setSlotMinutes(15);
            DoctorScheduleWindowDto w = new DoctorScheduleWindowDto();
            w.setStart("09:00");
            w.setEnd("17:00");
            dto.setWindows(new ArrayList<>(Collections.singletonList(w)));
            weekly.put(key, dto);
        }
        r.setWeekly(weekly);
        return r;
    }

    public DoctorScheduleResponse upsert(DoctorScheduleUpsertRequest request, String actorUserId) {
        if (request == null) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_REQUEST_REQUIRED");
        }
        String doctorId = normalize(request.getDoctorId());
        if (doctorId.isBlank()) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_DOCTOR_ID_REQUIRED");
        }
        ensureCanWriteSchedule(actorUserId, doctorId);
        Map<String, DoctorScheduleDayDto> weeklyDto = request.getWeekly();
        if (weeklyDto == null || weeklyDto.isEmpty()) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_WEEKLY_REQUIRED");
        }
        validateWeekly(weeklyDto);
        DoctorScheduleAccess doctorScheduleAccess = requireScheduleAccess();
        DoctorScheduleEntity entity = doctorScheduleAccess.findByDoctorId(doctorId).orElseGet(() -> {
            DoctorScheduleEntity e = new DoctorScheduleEntity();
            e.setDoctorId(doctorId);
            return e;
        });
        entity.setDoctorId(doctorId);
        entity.setWeekly(fromDtoWeekly(weeklyDto));
        entity.setUpdatedAt(Instant.now());
        entity.setUpdatedBy(actorUserId);
        return toResponse(doctorScheduleAccess.save(entity));
    }

    /**
     * Business key: {@code doctorId}.
     */
    public PagedDoctorScheduleListDto listPaged(String actorUserId, int page, int size, DoctorScheduleQueryDto query) {
        int safePage = EntityQuerySupport.safePage(page);
        int safeSize = EntityQuerySupport.safeSize(size);
        String doctorFilter = query == null || query.getDoctorId() == null ? "" : query.getDoctorId().trim();
        if (!doctorFilter.isBlank()) {
            ensureCanReadSchedule(actorUserId, doctorFilter);
            Optional<DoctorScheduleResponse> one = getSchedule(doctorFilter, actorUserId);
            List<DoctorScheduleResponse> content = one.map(List::of)
                    .orElseGet(() -> List.of(emptyShellForDoctor(doctorFilter)));
            return new PagedDoctorScheduleListDto(content, content.size(), 1, 0, safeSize);
        }
        UserRole role = resolveRole(actorUserId);
        if (role != UserRole.ADMIN) {
            throw new SecurityException("Only admins can list all doctor schedules");
        }
        Page<DoctorScheduleEntity> rows = requireScheduleAccess().findAll(PageRequest.of(safePage, safeSize));
        List<DoctorScheduleResponse> content = rows.stream().map(this::toResponse).toList();
        return new PagedDoctorScheduleListDto(
                content,
                rows.getTotalElements(),
                rows.getTotalPages(),
                rows.getNumber(),
                rows.getSize());
    }

    public boolean deleteByBusinessKey(String doctorId, String actorUserId) {
        String docId = normalize(doctorId);
        if (docId.isBlank()) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_DOCTOR_ID_REQUIRED");
        }
        ensureCanWriteSchedule(actorUserId, docId);
        return requireScheduleAccess().deleteByDoctorId(docId);
    }

    public void ensureCanReadSchedule(String actorUserId, String doctorId) {
        UserRole role = resolveRole(actorUserId);
        if (role == UserRole.ADMIN) {
            return;
        }
        if (role == UserRole.DOCTOR && normalize(actorUserId).equals(normalize(doctorId))) {
            return;
        }
        throw new SecurityException("You do not have access to this doctor schedule");
    }

    public void ensureCanWriteSchedule(String actorUserId, String doctorId) {
        ensureCanReadSchedule(actorUserId, doctorId);
    }

    private void validateWeekly(Map<String, DoctorScheduleDayDto> weekly) {
        for (String key : weekly.keySet()) {
            if (!DAY_KEYS.contains(key)) {
                throw new IllegalArgumentException("DOCTOR_SCHEDULE_INVALID_DAY_KEY");
            }
        }
        boolean anyWorking = false;
        for (String dayKey : DAY_KEYS) {
            DoctorScheduleDayDto day = weekly.get(dayKey);
            if (day == null || !day.isEnabled()) {
                continue;
            }
            if (day.getSlotMinutes() != 15 && day.getSlotMinutes() != 30) {
                throw new IllegalArgumentException("DOCTOR_SCHEDULE_INVALID_SLOT_MINUTES");
            }
            List<DoctorScheduleWindowDto> windows = day.getWindows();
            if (windows == null || windows.isEmpty()) {
                throw new IllegalArgumentException("DOCTOR_SCHEDULE_WINDOW_REQUIRED");
            }
            List<DoctorScheduleWindowDto> sorted = new ArrayList<>(windows);
            sorted.sort(Comparator.comparing(w -> parseTimeStart(w.getStart())));
            LocalTime prevEnd = null;
            for (DoctorScheduleWindowDto w : sorted) {
                LocalTime s = parseTimeStrict(w.getStart(), dayKey + " start");
                LocalTime e = parseTimeStrict(w.getEnd(), dayKey + " end");
                if (!s.isBefore(e)) {
                    throw new IllegalArgumentException("DOCTOR_SCHEDULE_WINDOW_ORDER_INVALID");
                }
                if (prevEnd != null && s.isBefore(prevEnd)) {
                    throw new IllegalArgumentException("DOCTOR_SCHEDULE_WINDOWS_OVERLAP");
                }
                prevEnd = e;
            }
            anyWorking = true;
        }
        if (!anyWorking) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_NO_ENABLED_DAY");
        }
    }

    private LocalTime parseTimeStart(String raw) {
        try {
            return LocalTime.parse(normalize(raw));
        } catch (Exception ex) {
            return LocalTime.MIN;
        }
    }

    private LocalTime parseTimeStrict(String raw, String label) {
        try {
            return LocalTime.parse(normalize(raw));
        } catch (Exception ex) {
            throw new IllegalArgumentException("DOCTOR_SCHEDULE_INVALID_TIME");
        }
    }

    private Map<String, DoctorScheduleDay> fromDtoWeekly(Map<String, DoctorScheduleDayDto> dto) {
        Map<String, DoctorScheduleDay> out = new LinkedHashMap<>();
        for (String key : DAY_KEYS) {
            DoctorScheduleDayDto d = dto.get(key);
            DoctorScheduleDay day = new DoctorScheduleDay();
            if (d != null) {
                day.setEnabled(d.isEnabled());
                day.setSlotMinutes(d.getSlotMinutes() == 30 ? 30 : 15);
                List<DoctorScheduleWindow> wins = new ArrayList<>();
                if (d.getWindows() != null) {
                    for (DoctorScheduleWindowDto w : d.getWindows()) {
                        DoctorScheduleWindow x = new DoctorScheduleWindow();
                        x.setStart(normalize(w.getStart()));
                        x.setEnd(normalize(w.getEnd()));
                        wins.add(x);
                    }
                }
                day.setWindows(wins);
            } else {
                day.setEnabled(false);
                day.setSlotMinutes(15);
                day.setWindows(new ArrayList<>());
            }
            out.put(key, day);
        }
        return out;
    }

    private DoctorScheduleResponse toResponse(DoctorScheduleEntity entity) {
        DoctorScheduleResponse r = new DoctorScheduleResponse();
        r.setDoctorId(entity.getDoctorId());
        Map<String, DoctorScheduleDayDto> weekly = new LinkedHashMap<>();
        Map<String, DoctorScheduleDay> src = entity.getWeekly();
        for (String key : DAY_KEYS) {
            DoctorScheduleDay day = src == null ? null : src.get(key);
            DoctorScheduleDayDto dto = new DoctorScheduleDayDto();
            if (day != null) {
                dto.setEnabled(day.isEnabled());
                dto.setSlotMinutes(day.getSlotMinutes());
                List<DoctorScheduleWindowDto> wins = new ArrayList<>();
                if (day.getWindows() != null) {
                    for (DoctorScheduleWindow w : day.getWindows()) {
                        DoctorScheduleWindowDto wd = new DoctorScheduleWindowDto();
                        wd.setStart(w.getStart());
                        wd.setEnd(w.getEnd());
                        wins.add(wd);
                    }
                }
                dto.setWindows(wins);
            }
            weekly.put(key, dto);
        }
        r.setWeekly(weekly);
        r.setUpdatedBy(entity.getUpdatedBy());
        r.setUpdatedAt(entity.getUpdatedAt() == null ? null : entity.getUpdatedAt().toString());
        return r;
    }

    private DoctorScheduleAccess requireScheduleAccess() {
        DoctorScheduleAccess access = doctorScheduleAccessProvider.getIfAvailable();
        if (access == null) {
            throw new IllegalStateException("Doctor schedule persistence is unavailable");
        }
        return access;
    }

    private UserRole resolveRole(String actorUserId) {
        UserAccess ua = userAccessProvider.getIfAvailable();
        if (ua == null) {
            throw new IllegalStateException("User persistence unavailable");
        }
        UserEntity user = ua.findById(normalize(actorUserId))
                .orElseThrow(() -> new SecurityException("User not found"));
        return user.getRole();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
