package com.flexshell.controller.v1;

import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.WhoPercentileCurvesDto;
import com.flexshell.growth.WhoGrowthMetric;
import com.flexshell.growth.WhoPercentileService;
import com.flexshell.i18n.LocalizedApiMessages;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/who")
public class WhoPercentileV1Controller {

    private final WhoPercentileService whoPercentileService;
    private final LocalizedApiMessages messages;

    public WhoPercentileV1Controller(WhoPercentileService whoPercentileService, LocalizedApiMessages messages) {
        this.whoPercentileService = whoPercentileService;
        this.messages = messages;
    }

    @GetMapping(value = "/percentile-curves", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<WhoPercentileCurvesDto>> percentileCurves(
            @RequestParam(defaultValue = "wfa") String metric,
            @RequestParam(name = "Metric", required = false) String metricAlias,
            @RequestParam(defaultValue = "male") String sex,
            @RequestParam(name = "Sex", required = false) String sexAlias,
            @RequestParam(defaultValue = "0") int fromMonths,
            @RequestParam(name = "FromMonths", required = false) Integer fromMonthsAlias,
            @RequestParam(defaultValue = "60") int toMonths,
            @RequestParam(name = "ToMonths", required = false) Integer toMonthsAlias
    ) {
        try {
            String resolvedMetric = metricAlias != null && !metricAlias.isBlank() ? metricAlias : metric;
            String resolvedSex = sexAlias != null && !sexAlias.isBlank() ? sexAlias : sex;
            int resolvedFrom = fromMonthsAlias != null ? fromMonthsAlias : fromMonths;
            int resolvedTo = toMonthsAlias != null ? toMonthsAlias : toMonths;
            WhoPercentileCurvesDto data = whoPercentileService.getPercentileCurves(
                    WhoGrowthMetric.fromWire(resolvedMetric),
                    resolvedSex,
                    resolvedFrom,
                    resolvedTo
            );
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                    .body(StandardApiResponse.success(messages.success("success.who.percentile.curves"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        }
    }
}
