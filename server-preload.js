const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "serverPicker",
    {
        getLastServer: () => {
            return ipcRenderer.invoke(
                "server:get-last"
            );
        },


        getLastServerProfile: () => {
            return ipcRenderer.invoke(
                "server:get-last-profile"
            );
        },


        connect: (url) => {
            return ipcRenderer.invoke(
                "server:connect",
                url
            );
        }
    }
);