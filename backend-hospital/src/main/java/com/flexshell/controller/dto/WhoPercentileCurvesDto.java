package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class WhoPercentileCurvesDto {

    @JsonProperty("Metric")
    private String metric;

    @JsonProperty("Sex")
    private String sex;

    @JsonProperty("Curves")
    private Map<String, List<WhoCurvePointDto>> curves;

    public WhoPercentileCurvesDto() {
    }

    public WhoPercentileCurvesDto(String metric, String sex, Map<String, List<WhoCurvePointDto>> curves) {
        this.metric = metric;
        this.sex = sex;
        this.curves = curves;
    }

    public String getMetric() {
        return metric;
    }

    public void setMetric(String metric) {
        this.metric = metric;
    }

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public Map<String, List<WhoCurvePointDto>> getCurves() {
        return curves;
    }

    public void setCurves(Map<String, List<WhoCurvePointDto>> curves) {
        this.curves = curves;
    }
}
