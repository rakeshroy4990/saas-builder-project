-- Pediatric immunization brands for prescription safety normalization (development seed).
-- Dose schedule validation is outside mg/kg reference — catalog entry enables recognition only.

INSERT INTO drug_reference (generic_name, drug_class, common_brand_names_india, pediatric_approved, notes, search_text)
VALUES
    (
        'Hepatitis B Vaccine',
        'vaccine',
        ARRAY['Hapibev', 'HepB', 'Engerix-B', 'Genevac-B', 'Revac-B'],
        true,
        'Inactivated HepB; immunization schedule dose — not mg/kg validated here.',
        'Hepatitis B Vaccine Hapibev HepB Engerix Genevac inactivated'
    ),
    (
        'Influenza Vaccine',
        'vaccine',
        ARRAY['Influvac Tetra', 'Influvac', 'Vaxigrip Tetra', 'Vaxigrip', 'Fluarix'],
        true,
        'Seasonal inactivated influenza; Tetra = quadrivalent.',
        'Influenza Vaccine Influvac Tetra Influvac Vaxigrip Fluarix'
    )
ON CONFLICT (generic_name) DO NOTHING;
