package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class GrowthChartContextResponse {

    @JsonProperty("ChildProfile")
    private ChildProfileResponse childProfile;

    @JsonProperty("Metric")
    private String metric;

    @JsonProperty("Records")
    private List<GrowthRecordResponse> records;

    @JsonProperty("PercentileCurves")
    private WhoPercentileCurvesDto percentileCurves;

    @JsonProperty("LatestSummary")
    private GrowthLatestSummaryDto latestSummary;

    @JsonProperty("MidParentalHeight")
    private MidParentalHeightDto midParentalHeight;

    public ChildProfileResponse getChildProfile() {
        return childProfile;
    }

    public void setChildProfile(ChildProfileResponse childProfile) {
        this.childProfile = childProfile;
    }

    public String getMetric() {
        return metric;
    }

    public void setMetric(String metric) {
        this.metric = metric;
    }

    public List<GrowthRecordResponse> getRecords() {
        return records;
    }

    public void setRecords(List<GrowthRecordResponse> records) {
        this.records = records;
    }

    public WhoPercentileCurvesDto getPercentileCurves() {
        return percentileCurves;
    }

    public void setPercentileCurves(WhoPercentileCurvesDto percentileCurves) {
        this.percentileCurves = percentileCurves;
    }

    public GrowthLatestSummaryDto getLatestSummary() {
        return latestSummary;
    }

    public void setLatestSummary(GrowthLatestSummaryDto latestSummary) {
        this.latestSummary = latestSummary;
    }

    public MidParentalHeightDto getMidParentalHeight() {
        return midParentalHeight;
    }

    public void setMidParentalHeight(MidParentalHeightDto midParentalHeight) {
        this.midParentalHeight = midParentalHeight;
    }
}
