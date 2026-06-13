package com.flexshell.controller.v1;

import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.WhoPercentileCurvesDto;
import com.flexshell.growth.WhoGrowthMetric;
import com.flexshell.growth.WhoPercentileService;
import com.flexshell.i18n.LocalizedApiMessages;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
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
            @RequestParam(defaultValue = "male") String sex,
            @RequestParam(defaultValue = "0") int fromMonths,
            @RequestParam(defaultValue = "60") int toMonths
    ) {
        try {
            WhoPercentileCurvesDto data = whoPercentileService.getPercentileCurves(
                    WhoGrowthMetric.fromWire(metric),
                    sex,
                    fromMonths,
                    toMonths
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
