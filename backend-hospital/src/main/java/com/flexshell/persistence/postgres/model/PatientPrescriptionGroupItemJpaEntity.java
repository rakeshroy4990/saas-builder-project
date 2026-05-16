package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "patient_prescription_group_items")
@IdClass(PatientPrescriptionGroupItemJpaEntity.GroupItemId.class)
public class PatientPrescriptionGroupItemJpaEntity {

    @Id
    @Column(name = "prescription_id", length = 64)
    private String prescriptionId;

    @Id
    @Column(name = "group_id", length = 64)
    private String groupId;

    @Column(name = "page_number", nullable = false)
    private int pageNumber = 1;

    @Column(name = "is_primary", nullable = false)
    private boolean primaryPage = false;

    public String getPrescriptionId() {
        return prescriptionId;
    }

    public void setPrescriptionId(String prescriptionId) {
        this.prescriptionId = prescriptionId;
    }

    public String getGroupId() {
        return groupId;
    }

    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }

    public int getPageNumber() {
        return pageNumber;
    }

    public void setPageNumber(int pageNumber) {
        this.pageNumber = pageNumber;
    }

    public boolean isPrimaryPage() {
        return primaryPage;
    }

    public void setPrimaryPage(boolean primaryPage) {
        this.primaryPage = primaryPage;
    }

    public static class GroupItemId implements Serializable {
        private String prescriptionId;
        private String groupId;

        public GroupItemId() {
        }

        public GroupItemId(String prescriptionId, String groupId) {
            this.prescriptionId = prescriptionId;
            this.groupId = groupId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof GroupItemId that)) {
                return false;
            }
            return Objects.equals(prescriptionId, that.prescriptionId) && Objects.equals(groupId, that.groupId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(prescriptionId, groupId);
        }
    }
}
