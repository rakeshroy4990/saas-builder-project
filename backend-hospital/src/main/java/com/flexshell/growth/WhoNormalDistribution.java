package com.flexshell.growth;

final class WhoNormalDistribution {

    private WhoNormalDistribution() {
    }

    static double percentileFromZ(double z) {
        double cdf = normalCdf(z);
        double percentile = cdf * 100.0;
        return Math.max(0.01, Math.min(99.99, percentile));
    }

    static double valueForPercentile(double percentile, WhoLmsRow lms) {
        double z = normalQuantile(percentile / 100.0);
        return measurementFromZ(z, lms);
    }

    static double zFromMeasurement(double measurement, WhoLmsRow lms) {
        double l = lms.l();
        double m = lms.m();
        double s = lms.s();
        if (m <= 0.0 || s <= 0.0 || measurement <= 0.0) {
            throw new IllegalArgumentException("WHO_LMS_INVALID");
        }
        if (Math.abs(l) < 1e-9) {
            return Math.log(measurement / m) / s;
        }
        return (Math.pow(measurement / m, l) - 1.0) / (l * s);
    }

    private static double measurementFromZ(double z, WhoLmsRow lms) {
        double l = lms.l();
        double m = lms.m();
        double s = lms.s();
        if (Math.abs(l) < 1e-9) {
            return m * Math.exp(s * z);
        }
        double inner = 1.0 + l * s * z;
        if (inner <= 0.0) {
            return m * 0.01;
        }
        return m * Math.pow(inner, 1.0 / l);
    }

    private static double normalCdf(double z) {
        return 0.5 * (1.0 + erf(z / Math.sqrt(2.0)));
    }

    private static double normalQuantile(double p) {
        if (p <= 0.0) {
            return -8.0;
        }
        if (p >= 1.0) {
            return 8.0;
        }
        // Acklam's approximation
        double[] a = {
                -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
                1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00
        };
        double[] b = {
                -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
                6.680131188771972e+01, -1.328068155288572e+01
        };
        double[] c = {
                -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
                -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00
        };
        double[] d = {
                7.784695709091636e-03, 3.224671290700398e-01, 2.445134137142996e+00,
                3.754408661907416e+00
        };
        double q = p - 0.5;
        double r;
        if (Math.abs(q) <= 0.425) {
            r = 0.180625 - q * q;
            return q * (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5])
                    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0);
        }
        r = q < 0.0 ? p : 1.0 - p;
        r = Math.sqrt(-Math.log(r));
        double x;
        if (r <= 5.0) {
            r -= 1.6;
            x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5])
                    / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1.0);
        } else {
            r -= 5.0;
            x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5])
                    / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1.0);
        }
        return q < 0.0 ? -x : x;
    }

    private static double erf(double x) {
        double t = 1.0 / (1.0 + 0.3275911 * Math.abs(x));
        double y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
                * Math.exp(-x * x);
        return x < 0.0 ? -y : y;
    }
}
