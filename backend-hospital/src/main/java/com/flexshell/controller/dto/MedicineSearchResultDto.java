package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Matches {@code frontend-hospital} medicine search rows.
 */
public class MedicineSearchResultDto {
    private String id;
    private String name;
    private String composition;
    private String manufacturer;
    @JsonProperty("pack_size")
    private String packSize;
    private Object price;
    @JsonProperty("is_discontinued")
    private Boolean isDiscontinued;

    public MedicineSearchResultDto() {
    }

    public MedicineSearchResultDto(
            String id,
            String name,
            String composition,
            String manufacturer,
            String packSize,
            Object price,
            Boolean isDiscontinued
    ) {
        this.id = id;
        this.name = name;
        this.composition = composition;
        this.manufacturer = manufacturer;
        this.packSize = packSize;
        this.price = price;
        this.isDiscontinued = isDiscontinued;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getComposition() {
        return composition;
    }

    public void setComposition(String composition) {
        this.composition = composition;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getPackSize() {
        return packSize;
    }

    public void setPackSize(String packSize) {
        this.packSize = packSize;
    }

    public Object getPrice() {
        return price;
    }

    public void setPrice(Object price) {
        this.price = price;
    }

    public Boolean getIsDiscontinued() {
        return isDiscontinued;
    }

    public void setIsDiscontinued(Boolean discontinued) {
        isDiscontinued = discontinued;
    }
}
