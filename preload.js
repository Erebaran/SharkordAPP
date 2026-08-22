const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "screenPicker",
    {

        // ==============================
        // JANELAS / MONITORES
        // ==============================

        getSources: (type) => {

            return ipcRenderer.invoke(
                "screen:get-sources",
                type
            );
        },


        // ==============================
        // THUMBNAILS DE MONITOR
        // ==============================

        getThumbnails: (type) => {

            return ipcRenderer.invoke(
                "screen:get-thumbnails",
                type
            );
        },


        // ==============================
        // ABAS DO NAVEGADOR INTERNO
        // ==============================

        getBrowserTabs: () => {

            return ipcRenderer.invoke(
                "screen:get-browser-tabs"
            );
        },


        // ==============================
        // SELECIONAR FONTE
        // ==============================

        selectSource: (options) => {

            ipcRenderer.send(
                "screen:select-source",
                options
            );
        },


        // ==============================
        // CANCELAR
        // ==============================

        cancel: () => {

            ipcRenderer.send(
                "screen:cancel"
            );
        }
    }
);