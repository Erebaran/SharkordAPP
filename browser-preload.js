const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "internalBrowser",
    {

        newTab: (url) => {
            return ipcRenderer.invoke(
                "browser:new-tab",
                url
            );
        },


        closeTab: (tabId) => {
            return ipcRenderer.invoke(
                "browser:close-tab",
                tabId
            );
        },


        selectTab: (tabId) => {
            return ipcRenderer.invoke(
                "browser:select-tab",
                tabId
            );
        },


        navigate: (tabId, url) => {
            return ipcRenderer.invoke(
                "browser:navigate",
                {
                    tabId,
                    url
                }
            );
        },


        back: (tabId) => {
            return ipcRenderer.invoke(
                "browser:back",
                tabId
            );
        },


        forward: (tabId) => {
            return ipcRenderer.invoke(
                "browser:forward",
                tabId
            );
        },


        reload: (tabId) => {
            return ipcRenderer.invoke(
                "browser:reload",
                tabId
            );
        },


        getTabs: () => {
            return ipcRenderer.invoke(
                "browser:get-tabs"
            );
        },


        onTabsChanged: (callback) => {

            ipcRenderer.on(
                "browser:tabs-changed",
                (
                    event,
                    tabs
                ) => {

                    callback(tabs);
                }
            );
        }
    }
);