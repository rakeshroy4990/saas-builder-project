package com.flexshell.auth.cookie;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthResponseCookiesPolicyTest {

    @Test
    void crossSiteDeploymentUsesNoneAndSecure() {
        AuthResponseCookies.EffectiveCookiePolicy p =
                AuthResponseCookies.resolvePolicy(true, false, "Lax");
        assertEquals("None", p.sameSite());
        assertTrue(p.secure());
    }

    @Test
    void explicitNoneInConfigForcesSecureEvenWhenConfigSecureFalse() {
        AuthResponseCookies.EffectiveCookiePolicy p =
                AuthResponseCookies.resolvePolicy(false, false, "None");
        assertEquals("None", p.sameSite());
        assertTrue(p.secure());
    }

    @Test
    void localDevDefaultsToLaxAndRespectsConfigSecure() {
        AuthResponseCookies.EffectiveCookiePolicy p =
                AuthResponseCookies.resolvePolicy(false, false, "");
        assertEquals("Lax", p.sameSite());
        assertFalse(p.secure());
    }
}
