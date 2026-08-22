const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "shareControl",
    {
        switchSource: () => {
            ipcRenderer.send(
                "screenshare:control-switch"
            );
        }
    }
);