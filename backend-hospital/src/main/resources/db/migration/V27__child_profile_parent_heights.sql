ALTER TABLE child_profiles
    ADD COLUMN mother_height_cm NUMERIC(5, 2),
    ADD COLUMN father_height_cm NUMERIC(5, 2);

COMMENT ON COLUMN child_profiles.mother_height_cm IS 'Biological mother height in cm (optional, for mid-parental height).';
COMMENT ON COLUMN child_profiles.father_height_cm IS 'Biological father height in cm (optional, for mid-parental height).';
