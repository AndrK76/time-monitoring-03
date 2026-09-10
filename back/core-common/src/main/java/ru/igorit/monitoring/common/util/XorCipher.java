package ru.igorit.monitoring.common.util;

import lombok.extern.log4j.Log4j2;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Простое XOR-маскирование строк с последующим Base64-кодированием.
 * Используется для защиты токенов в БД (не является криптостойким — только маскировка).
 */
@Log4j2
public final class XorCipher {

    private XorCipher() {}

    /**
     * Маскирует строку: XOR с ключом → Base64.
     */
    public static String encrypt(String value, String secret) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        byte[] data = value.getBytes(StandardCharsets.UTF_8);
        byte[] key = secret.getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[data.length];
        for (int i = 0; i < data.length; i++) {
            result[i] = (byte) (data[i] ^ key[i % key.length]);
        }
        return Base64.getEncoder().encodeToString(result);
    }

    /**
     * Размаскировывает строку: Base64 → XOR с ключом.
     */
    public static String decrypt(String masked, String secret) {
        try {
            if (masked == null || masked.isEmpty()) {
                return masked;
            }
            byte[] data = Base64.getDecoder().decode(masked);
            byte[] key = secret.getBytes(StandardCharsets.UTF_8);
            byte[] result = new byte[data.length];
            for (int i = 0; i < data.length; i++) {
                result[i] = (byte) (data[i] ^ key[i % key.length]);
            }
            return new String(result, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error(e.getMessage());
            return masked;
        }
    }
}