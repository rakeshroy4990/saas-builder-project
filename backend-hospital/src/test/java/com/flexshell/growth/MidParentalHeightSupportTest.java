package com.flexshell.growth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MidParentalHeightSupportTest {

    @Test
    void computeTargetHeightCm_boy_usesPlus13Adjustment() {
        double target = MidParentalHeightSupport.computeTargetHeightCm("male", 160.0, 178.0);
        assertEquals(175.5, target, 0.01);
    }

    @Test
    void computeTargetHeightCm_girl_usesMinus13Adjustment() {
        double target = MidParentalHeightSupport.computeTargetHeightCm("female", 160.0, 178.0);
        assertEquals(162.5, target, 0.01);
    }

    @Test
    void isValidParentHeight_rejectsOutOfRange() {
        assertTrue(MidParentalHeightSupport.isValidParentHeight(165.0));
        assertTrue(!MidParentalHeightSupport.isValidParentHeight(90.0));
    }
}
