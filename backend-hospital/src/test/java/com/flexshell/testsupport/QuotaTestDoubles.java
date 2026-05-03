package com.flexshell.testsupport;

import com.flexshell.persistence.postgres.SmartAiDailyUsagePgRepository;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

import static org.mockito.Mockito.when;

public final class QuotaTestDoubles {

    private QuotaTestDoubles() {
    }

    /**
     * {@link SmartAiQuotaService} constructor requires an {@link ObjectProvider}; tests use no PostgreSQL quota bean.
     */
    @SuppressWarnings("unchecked")
    public static ObjectProvider<SmartAiDailyUsagePgRepository> emptyPgDailyUsage() {
        ObjectProvider<SmartAiDailyUsagePgRepository> p = Mockito.mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(null);
        return p;
    }
}
