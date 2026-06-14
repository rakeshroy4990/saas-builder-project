-- Common Indian syrup brands for prescription safety normalization (development seed).

UPDATE drug_reference
SET common_brand_names_india = array_cat(common_brand_names_india, ARRAY['Advent', 'Advent Forte']),
    search_text = search_text || ' Advent Advent Forte'
WHERE generic_name = 'Amoxicillin-Clavulanate'
  AND NOT ('Advent' = ANY (common_brand_names_india));

UPDATE drug_reference
SET common_brand_names_india = array_cat(common_brand_names_india, ARRAY['Electral', 'Enfalyte']),
    search_text = search_text || ' Electral Enfalyte oral rehydration sachet'
WHERE generic_name = 'ORS'
  AND NOT ('Electral' = ANY (common_brand_names_india));
