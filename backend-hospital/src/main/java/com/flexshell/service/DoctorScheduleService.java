package com.flexshell.service;

import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.DoctorScheduleDayDto;
import com.flexshell.controller.dto.DoctorScheduleResponse;
import com.flexshell.controller.dto.DoctorScheduleUpsertRequest;
import com.flexshell.controller.dto.DoctorScheduleWindowDto;
import com.flexshell.doctorschedule.DoctorScheduleDay;
import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.doctorschedule.DoctorScheduleRepository;
import com.flexshell.doctorschedule.DoctorScheduleWindow;
import org.springframework.beans.factory.ObjectProvider;
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

    private final ObjectProvider<DoctorScheduleRepository> doctorScheduleRepositoryProvider;
    private final ObjectProvider<UserAccess> userAccessProvider;

    public DoctorScheduleService(
            ObjectProvider<DoctorScheduleRepository> doctorScheduleRepositoryProvider,
            ObjectProvider<UserAccess> userAccessProvider) {
        this.doctorScheduleRepositoryProvider = doctorScheduleRepositoryProvider;
        this.userAccessProvider = userAccessProvider;
    }

    public Optional<DoctorScheduleResponse> getSchedule(String doctorId, String actorUserId) {
        String docId = normalize(doctorId);
        if (docId.isBlank()) {
            throw new IllegalArgumentException("DoctorId is required");
        }
        ensureCanReadSchedule(actorUserId, docId);
        return requireScheduleRepository().findByDoctorId(docId).map(this::toResponse);
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
            throw new IllegalArgumentException("Request body is required");
        }
        String doctorId = normalize(request.getDoctorId());
        if (doctorId.isBlank()) {
            throw new IllegalArgumentException("DoctorId is required");
        }
        ensureCanWriteSchedule(actorUserId, doctorId);
        Map<String, DoctorScheduleDayDto> weeklyDto = request.getWeekly();
        if (weeklyDto == null || weeklyDto.isEmpty()) {
            throw new IllegalArgumentException("Weekly schedule is required");
        }
        validateWeekly(weeklyDto);
        DoctorScheduleRepository doctorScheduleRepository = requireScheduleRepository();
        DoctorScheduleEntity entity = doctorScheduleRepository.findByDoctorId(doctorId).orElseGet(() -> {
            DoctorScheduleEntity e = new DoctorScheduleEntity();
            e.setDoctorId(doctorId);
            return e;
        });
        entity.setDoctorId(doctorId);
        entity.setWeekly(fromDtoWeekly(weeklyDto));
        entity.setUpdatedAt(Instant.now());
        entity.setUpdatedBy(actorUserId);
        return toResponse(doctorScheduleRepository.save(entity));
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
                throw new IllegalArgumentException("Invalid day key: " + key + ". Use MON..SUN.");
            }
        }
        boolean anyWorking = false;
        for (String dayKey : DAY_KEYS) {
            DoctorScheduleDayDto day = weekly.get(dayKey);
            if (day == null || !day.isEnabled()) {
                continue;
            }
            if (day.getSlotMinutes() != 15 && day.getSlotMinutes() != 30) {
                throw new IllegalArgumentException(dayKey + ": SlotMinutes must be 15 or 30");
            }
            List<DoctorScheduleWindowDto> windows = day.getWindows();
            if (windows == null || windows.isEmpty()) {
                throw new IllegalArgumentException(dayKey + ": enabled days require at least one time window");
            }
            List<DoctorScheduleWindowDto> sorted = new ArrayList<>(windows);
            sorted.sort(Comparator.comparing(w -> parseTimeStart(w.getStart())));
            LocalTime prevEnd = null;
            for (DoctorScheduleWindowDto w : sorted) {
                LocalTime s = parseTimeStrict(w.getStart(), dayKey + " start");
                LocalTime e = parseTimeStrict(w.getEnd(), dayKey + " end");
                if (!s.isBefore(e)) {
                    throw new IllegalArgumentException(dayKey + ": each window must have start before end");
                }
                if (prevEnd != null && s.isBefore(prevEnd)) {
                    throw new IllegalArgumentException(dayKey + ": time windows must not overlap");
                }
                prevEnd = e;
            }
            anyWorking = true;
        }
        if (!anyWorking) {
            throw new IllegalArgumentException("At least one weekday must be enabled with time windows");
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
            throw new IllegalArgumentException("Invalid time for " + label + ": " + raw);
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

    private DoctorScheduleRepository requireScheduleRepository() {
        DoctorScheduleRepository repository = doctorScheduleRepositoryProvider.getIfAvailable();
        if (repository == null) {
            throw new IllegalStateException("Doctor schedule persistence is unavailable");
        }
        return repository;
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
