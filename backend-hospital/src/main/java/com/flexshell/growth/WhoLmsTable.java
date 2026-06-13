package com.flexshell.growth;

import java.util.List;

public class WhoLmsTable {

    private final List<WhoLmsRow> rows;

    public WhoLmsTable(List<WhoLmsRow> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new IllegalArgumentException("WHO_LMS_TABLE_EMPTY");
        }
        this.rows = List.copyOf(rows);
    }

    public WhoLmsRow interpolate(double ageMonths) {
        if (rows.isEmpty()) {
            throw new IllegalStateException("WHO_LMS_TABLE_EMPTY");
        }
        if (ageMonths <= rows.get(0).ageMonths()) {
            return rows.get(0);
        }
        WhoLmsRow last = rows.get(rows.size() - 1);
        if (ageMonths >= last.ageMonths()) {
            return last;
        }
        for (int i = 0; i < rows.size() - 1; i++) {
            WhoLmsRow lo = rows.get(i);
            WhoLmsRow hi = rows.get(i + 1);
            if (ageMonths >= lo.ageMonths() && ageMonths <= hi.ageMonths()) {
                if (lo.ageMonths() == hi.ageMonths()) {
                    return lo;
                }
                double t = (ageMonths - lo.ageMonths()) / (hi.ageMonths() - lo.ageMonths());
                return new WhoLmsRow(
                        ageMonths,
                        lo.l() + t * (hi.l() - lo.l()),
                        lo.m() + t * (hi.m() - lo.m()),
                        lo.s() + t * (hi.s() - lo.s())
                );
            }
        }
        return last;
    }

    public double minAgeMonths() {
        return rows.get(0).ageMonths();
    }

    public double maxAgeMonths() {
        return rows.get(rows.size() - 1).ageMonths();
    }
}
