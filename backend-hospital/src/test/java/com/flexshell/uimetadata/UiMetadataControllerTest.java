package com.flexshell.uimetadata;

import com.flexshell.service.UiMetadataService;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataPackageDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class UiMetadataControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UiMetadataService uiMetadataService;

    @Test
    void getReturnsStoredJsonWhenPresent() throws Exception {
        UiMetadataGetResponse stored = new UiMetadataGetResponse();
        UiMetadataPackageDto pkg = new UiMetadataPackageDto();
        pkg.setPackageName("social");
        stored.setPackages(java.util.List.of(pkg));
        when(uiMetadataService.isStorageAvailable()).thenReturn(true);
        when(uiMetadataService.loadStored()).thenReturn(Optional.of(stored));

        mockMvc.perform(get("/api/uiMetdata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("1.0"))
                .andExpect(jsonPath("$.packages[0].packageName").value("social"));
    }

    @Test
    void getReturnsNotFoundWhenMissing() throws Exception {
        when(uiMetadataService.isStorageAvailable()).thenReturn(true);
        when(uiMetadataService.loadStored()).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/uiMetdata"))
                .andExpect(status().isNotFound());
    }

    @Test
    void postSavesPayload() throws Exception {
        String payload = "{\"version\":\"1.0\",\"packages\":[{\"packageName\":\"social\",\"pages\":[]}]}";
        when(uiMetadataService.save(org.mockito.ArgumentMatchers.any())).thenReturn(true);

        mockMvc.perform(post("/api/uiMetdata/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated());

        verify(uiMetadataService).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void postReturnsBadRequestForMalformedPayload() throws Exception {
        String invalid = "{\"version\":\"\",\"packages\":[{\"packageName\":\"\",\"pages\":null}]}";

        mockMvc.perform(post("/api/uiMetdata/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deleteRemovesDocument() throws Exception {
        when(uiMetadataService.deleteStoredById("default")).thenReturn(true);

        mockMvc.perform(delete("/api/uiMetdata/default"))
                .andExpect(status().isNoContent());

        verify(uiMetadataService).deleteStoredById("default");
    }
}
