const {
    contextBridge,
    ipcRenderer
} = require("electron");


// ======================================================
// PROCESS AUDIO API
// ======================================================

contextBridge.exposeInMainWorld(
    "electronProcessAudio",
    {
        start: sourceId =>
            ipcRenderer.invoke(
                "process-audio:start",
                sourceId
            ),

        stop: captureId =>
            ipcRenderer.invoke(
                "process-audio:stop",
                captureId
            ),

        removeListeners: () => {

            ipcRenderer.removeAllListeners(
                "process-audio:chunk"
            );

            ipcRenderer.removeAllListeners(
                "process-audio:error"
            );
        },

        onChunk: callback => {

            const listener =
                (_event, data) => {
                    callback(data);
                };


            ipcRenderer.on(
                "process-audio:chunk",
                listener
            );


            return () => {
                ipcRenderer.removeListener(
                    "process-audio:chunk",
                    listener
                );
            };
        },

        onError: callback => {

            const listener =
                (_event, message) => {
                    callback(message);
                };


            ipcRenderer.on(
                "process-audio:error",
                listener
            );


            return () => {
                ipcRenderer.removeListener(
                    "process-audio:error",
                    listener
                );
            };
        }
    }
);
