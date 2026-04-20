package com.flexshell.prescription;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class PrescriptionCrypto {

    private PrescriptionCrypto() {}

    public static String sha256Hex(byte[] data) {
        if (data == null) {
            return "";
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(data);
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
