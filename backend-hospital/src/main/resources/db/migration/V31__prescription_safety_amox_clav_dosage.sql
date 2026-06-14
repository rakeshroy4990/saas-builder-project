-- Pediatric dosage reference for Amoxicillin-Clavulanate (amoxicillin component, mg/kg per dose).

INSERT INTO pediatric_dosage_reference (
    generic_name, route, min_age_months, max_age_months,
    dose_per_kg_mg, frequency_per_day_min, frequency_per_day_max,
    max_single_dose_mg, max_daily_dose_mg, source, notes
)
SELECT
    'Amoxicillin-Clavulanate', 'oral', 1, 216,
    25.000, 3, 3, 500.00, 75.00, 'BNFc 2024',
    'Amoxicillin component mg/kg per dose; syrup dose derived from ml × strength/5'
WHERE NOT EXISTS (
    SELECT 1
    FROM pediatric_dosage_reference
    WHERE generic_name = 'Amoxicillin-Clavulanate'
      AND route = 'oral'
      AND min_age_months = 1
      AND max_age_months = 216
      AND deleted = false
);
