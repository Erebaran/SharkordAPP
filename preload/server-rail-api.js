const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "sharkordDesktopServers",
    {
        getState:
            () =>
                ipcRenderer.invoke(
                    "server-sidebar:get-state"
                ),

        connect:
            serverUrl =>
                ipcRenderer.invoke(
                    "server-sidebar:connect",
                    serverUrl
                ),

        add:
            serverUrl =>
                ipcRenderer.invoke(
                    "server-sidebar:add",
                    serverUrl
                ),

        remove:
            serverUrl =>
                ipcRenderer.invoke(
                    "server-sidebar:remove",
                    serverUrl
                )
    }
);