-- Cefixime oral pediatric reference + probiotic (Bifilac) recognition.
-- DOSAGE VALUES ARE SEED DATA FOR DEVELOPMENT — clinically review before production.

INSERT INTO pediatric_dosage_reference (
    generic_name, route, min_age_months, max_age_months,
    dose_per_kg_mg, frequency_per_day_min, frequency_per_day_max,
    max_single_dose_mg, max_daily_dose_mg, source, notes
)
SELECT
    'Cefixime', 'oral', 1, 216,
    8.000, 1, 1, 400.00, 8.00, 'BNFc 2024',
    '8 mg/kg once daily (max 400 mg/day); alternate 4 mg/kg BD per BNFc'
WHERE NOT EXISTS (
    SELECT 1
    FROM pediatric_dosage_reference
    WHERE generic_name = 'Cefixime'
      AND route = 'oral'
      AND min_age_months = 1
      AND max_age_months = 216
      AND deleted = false
);

INSERT INTO drug_reference (generic_name, drug_class, common_brand_names_india, pediatric_approved, notes, search_text)
VALUES
    (
        'Probiotic',
        'probiotic',
        ARRAY['Bifilac', 'Vibact', 'Biolac', 'Econorm', 'Velgut'],
        true,
        'Live micro-organism supplement; dosing is organism-count based, not mg/kg.',
        'Probiotic Bifilac Vibact Biolac Econorm Velgut lactobacillus'
    )
ON CONFLICT (generic_name) DO NOTHING;

UPDATE drug_reference
SET common_brand_names_india = (
        SELECT COALESCE(array_agg(DISTINCT brand), ARRAY[]::text[])
        FROM unnest(
            COALESCE(drug_reference.common_brand_names_india, ARRAY[]::text[])
            || ARRAY['Mahacef', 'Omnix', 'Cefix']::text[]
        ) AS brand
    ),
    search_text = trim(COALESCE(search_text, '') || ' Mahacef Omnix Cefix')
WHERE generic_name = 'Cefixime';
