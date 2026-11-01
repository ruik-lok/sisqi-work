package com.sisqi.work;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * 凭据存储：Android Keystore 里的 AES-256-GCM 密钥加密后写入 SharedPreferences。
 * 明文密钥不落盘、不进 localStorage、不进日志；导出备份也不含密钥。
 */
final class SecretStore {
    private static final String TAG = "SISQI";
    private static final String KEY_ALIAS = "sisqi.secrets.v1";
    private static final String PREFS = "sisqi_secrets";
    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    private final SharedPreferences prefs;

    SecretStore(Context ctx) {
        prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(KEY_ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build());
            kg.generateKey();
        }
        return (SecretKey) ks.getKey(KEY_ALIAS, null);
    }

    boolean set(String id, String value) {
        try {
            Cipher c = Cipher.getInstance(TRANSFORM);
            c.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = c.getIV();
            byte[] ct = c.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String payload = Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
            return prefs.edit().putString(id, payload).commit();
        } catch (Exception e) {
            Log.e(TAG, "secret set failed: " + e);
            return false;
        }
    }

    String get(String id) {
        String payload = prefs.getString(id, null);
        if (payload == null) return "";
        try {
            int cut = payload.indexOf(':');
            if (cut <= 0) return "";
            byte[] iv = Base64.decode(payload.substring(0, cut), Base64.NO_WRAP);
            byte[] ct = Base64.decode(payload.substring(cut + 1), Base64.NO_WRAP);
            Cipher c = Cipher.getInstance(TRANSFORM);
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(c.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.e(TAG, "secret get failed: " + e);
            return "";
        }
    }

    void delete(String id) {
        prefs.edit().remove(id).apply();
    }
}
