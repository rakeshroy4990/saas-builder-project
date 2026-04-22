package com.flexshell.controller;

import com.flexshell.controller.dto.MedicineSearchResultDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.MedicineCatalogService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/medicines")
public class MedicineSearchController {
    private static final int DEFAULT_LIMIT = 25;

    private final MedicineCatalogService medicineCatalogService;

    public MedicineSearchController(MedicineCatalogService medicineCatalogService) {
        this.medicineCatalogService = medicineCatalogService;
    }

    @GetMapping(value = "/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<MedicineSearchResultDto>>> search(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "limit", defaultValue = "" + DEFAULT_LIMIT) int limit
    ) {
        int capped = Math.min(Math.max(limit, 1), 50);
        List<MedicineSearchResultDto> data = medicineCatalogService.search(q, capped);
        return ResponseEntity.ok(StandardApiResponse.success("Medicines fetched", data));
    }
}
