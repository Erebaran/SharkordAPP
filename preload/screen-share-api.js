const {
    contextBridge,
    ipcRenderer
} = require("electron");


// ======================================================
// SCREEN SHARE API
// ======================================================

contextBridge.exposeInMainWorld(
    "electronScreenShare",
    {
        chooseSource: () =>
            ipcRenderer.invoke(
                "screenshare:choose-source"
            )
    }
);
