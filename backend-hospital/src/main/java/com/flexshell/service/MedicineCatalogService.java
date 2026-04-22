package com.flexshell.service;

import com.flexshell.controller.dto.MedicineSearchResultDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Lightweight catalog for prescription autocomplete. Replace with Mongo or external API when needed.
 */
@Service
public class MedicineCatalogService {
    private static final List<MedicineSearchResultDto> CATALOG = buildCatalog();

    public List<MedicineSearchResultDto> search(String rawQuery, int limit) {
        String q = rawQuery == null ? "" : rawQuery.trim().toLowerCase(Locale.ROOT);
        if (q.length() < 2 || limit <= 0) {
            return List.of();
        }
        List<MedicineSearchResultDto> out = new ArrayList<>();
        for (MedicineSearchResultDto row : CATALOG) {
            if (matches(row, q)) {
                out.add(row);
                if (out.size() >= limit) {
                    break;
                }
            }
        }
        return out;
    }

    private static boolean matches(MedicineSearchResultDto row, String q) {
        return contains(row.getName(), q)
                || contains(row.getComposition(), q)
                || contains(row.getManufacturer(), q);
    }

    private static boolean contains(String field, String q) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(q);
    }

    private static List<MedicineSearchResultDto> buildCatalog() {
        List<MedicineSearchResultDto> rows = new ArrayList<>();
        add(rows, "med-paracetamol-500", "Paracetamol 500", "Paracetamol 500 mg", "Generic", "10 tablets", null, false);
        add(rows, "med-paracetamol-650", "Paracetamol 650", "Paracetamol 650 mg", "Generic", "15 tablets", null, false);
        add(rows, "med-dolo-650", "Dolo 650", "Paracetamol 650 mg", "Micro Labs", "15 tablets", null, false);
        add(rows, "med-crocin-advance", "Crocin Advance", "Paracetamol 650 mg", "GSK", "20 tablets", null, false);
        add(rows, "med-azee-500", "Azee 500", "Azithromycin 500 mg", "Cipla", "3 tablets", null, false);
        add(rows, "med-azithral-500", "Azithral 500", "Azithromycin 500 mg", "Alembic", "3 tablets", null, false);
        add(rows, "med-augmentin-625", "Augmentin 625", "Amoxicillin + Clavulanic acid", "GSK", "10 tablets", null, false);
        add(rows, "med-pantop-40", "Pantop 40", "Pantoprazole 40 mg", "Generic", "10 tablets", null, false);
        add(rows, "med-pantocid-d", "Pantocid D", "Pantoprazole + Domperidone", "Sun Pharma", "10 capsules", null, false);
        add(rows, "med-omee-20", "Omee 20", "Omeprazole 20 mg", "Dr Reddy's", "20 capsules", null, false);
        add(rows, "med-montair-lc", "Montair LC", "Montelukast + Levocetirizine", "Cipla", "10 tablets", null, false);
        add(rows, "med-allegra-120", "Allegra 120", "Fexofenadine 120 mg", "Sanofi", "10 tablets", null, false);
        add(rows, "med-levocet-m", "Levocet M", "Levocetirizine + Montelukast", "Mankind", "10 tablets", null, false);
        add(rows, "med-amoxyclav-625", "Amoxyclav 625", "Amoxicillin + Clavulanic acid", "Generic", "10 tablets", null, false);
        add(rows, "med-cefixime-200", "Cefixime 200", "Cefixime 200 mg", "Generic", "10 tablets", null, false);
        add(rows, "med-oflox-200", "Oflox 200", "Ofloxacin 200 mg", "Generic", "10 tablets", null, false);
        add(rows, "med-metformin-500", "Metformin 500", "Metformin 500 mg", "Generic", "20 tablets", null, false);
        add(rows, "med-glycomet-500", "Glycomet 500", "Metformin 500 mg", "USV", "20 tablets", null, false);
        add(rows, "med-amlokind-5", "Amlokind 5", "Amlodipine 5 mg", "Mankind", "10 tablets", null, false);
        add(rows, "med-telmavas-40", "Telmavas 40", "Telmisartan 40 mg", "Generic", "10 tablets", null, false);
        add(rows, "med-atorva-20", "Atorva 20", "Atorvastatin 20 mg", "Generic", "10 tablets", null, false);
        add(rows, "med-rosuvas-10", "Rosuvas 10", "Rosuvastatin 10 mg", "Sun Pharma", "10 tablets", null, false);
        add(rows, "med-eltroxin-50", "Eltroxin 50", "Levothyroxine 50 mcg", "GSK", "100 tablets", null, false);
        add(rows, "med-thyronorm-75", "Thyronorm 75", "Levothyroxine 75 mcg", "Abbott", "100 tablets", null, false);
        add(rows, "med-insulin-r", "Insulin R", "Regular insulin", "Lilly", "10 ml vial", null, false);
        return List.copyOf(rows);
    }

    private static void add(
            List<MedicineSearchResultDto> rows,
            String id,
            String name,
            String composition,
            String manufacturer,
            String packSize,
            Object price,
            boolean discontinued
    ) {
        rows.add(new MedicineSearchResultDto(id, name, composition, manufacturer, packSize, price, discontinued));
    }
}
