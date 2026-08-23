const {
    contextBridge,
    ipcRenderer
} = require("electron");


// ======================================================
// APP UPDATE API
// ======================================================

contextBridge.exposeInMainWorld(
    "sharkordUpdater",
    {
        getState: () =>
            ipcRenderer.invoke(
                "updater:get-state"
            ),

        check: () =>
            ipcRenderer.invoke(
                "updater:check"
            ),

        download: () =>
            ipcRenderer.invoke(
                "updater:download"
            ),

        install: () =>
            ipcRenderer.invoke(
                "updater:install"
            ),

        onState: callback => {
            if (
                typeof callback !==
                "function"
            ) {
                return () => {};
            }

            const listener =
                (
                    _event,
                    state
                ) => {
                    callback(state);
                };

            ipcRenderer.on(
                "updater:state",
                listener
            );

            return () => {
                ipcRenderer.removeListener(
                    "updater:state",
                    listener
                );
            };
        }
    }
);
