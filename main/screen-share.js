const {
    BrowserWindow,
    desktopCapturer,
    session,
    ipcMain
} = require("electron");


const path =
    require("path");


function setupScreenShareMain({
                                  getMainWindow,
                                  getAppIcon,
                                  applyWindowIcon,
                                  baseDir
                              }) {

    // ======================================================
    // ESTADO LOCAL DO SCREEN SHARE
    // ======================================================

    const state = {

        pickerWindow:
            null,

        pickerResolve:
            null,

        pickerReject:
            null,

        selectedShareOptions:
            null,

        preparedSelectionToken:
            0
    };


    console.log(
        "[ScreenShare Main] módulo V2.3 inicializado."
    );


    if (
        typeof getMainWindow !==
        "function" ||
        typeof getAppIcon !==
        "function" ||
        typeof applyWindowIcon !==
        "function" ||
        !baseDir
    ) {

        throw new Error(
            "[ScreenShare Main] dependências inválidas em setupScreenShareMain()."
        );
    }


    // ======================================================
    // PICKER
    // ======================================================

    function createPickerWindow() {

        if (
            state.pickerWindow &&
            !state.pickerWindow.isDestroyed()
        ) {

            state.pickerWindow.focus();


            return;
        }


        const appIcon =
            getAppIcon();


        const parentWindow =
            getMainWindow();


        const windowOptions = {
            width:
                1000,

            height:
                720,

            minWidth:
                700,

            minHeight:
                550,

            title:
                "Escolher o que compartilhar",

            icon:
                appIcon ||
                undefined,

            modal:
                Boolean(
                    parentWindow &&
                    !parentWindow.isDestroyed()
                ),

            parent:
                parentWindow &&
                !parentWindow.isDestroyed()
                    ? parentWindow
                    : undefined,

            autoHideMenuBar:
                true,

            webPreferences: {

                preload:
                    path.join(
                        baseDir,
                        "preload.js"
                    ),

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true
            }
        };


        state.pickerWindow =
            new BrowserWindow(
                windowOptions
            );


        applyWindowIcon(
            state.pickerWindow
        );


        const pickerPath =
            path.join(
                baseDir,
                "picker.html"
            );


        console.log(
            "Picker carregado de:",
            pickerPath
        );


        state.pickerWindow
            .loadFile(
                pickerPath
            )
            .catch(
                error => {

                    console.error(
                        "[ScreenShare Main] erro carregando picker:",
                        error
                    );


                    const reject =
                        state.pickerReject;


                    state.pickerResolve =
                        null;

                    state.pickerReject =
                        null;

                    state.selectedShareOptions =
                        null;


                    if (reject) {

                        reject(
                            error
                        );
                    }


                    if (
                        state.pickerWindow &&
                        !state.pickerWindow.isDestroyed()
                    ) {

                        state.pickerWindow.destroy();
                    }


                    state.pickerWindow =
                        null;
                }
            );


        state.pickerWindow.on(
            "closed",
            () => {

                state.pickerWindow =
                    null;


                if (
                    state.pickerReject
                ) {

                    const reject =
                        state.pickerReject;


                    state.pickerResolve =
                        null;


                    state.pickerReject =
                        null;


                    state.selectedShareOptions =
                        null;


                    reject(
                        new Error(
                            "SCREEN_SHARE_CANCELLED"
                        )
                    );
                }
            }
        );
    }


    function cancelPicker() {

        const reject =
            state.pickerReject;


        state.pickerResolve =
            null;


        state.pickerReject =
            null;


        state.selectedShareOptions =
            null;


        state.preparedSelectionToken++;


        if (
            reject
        ) {

            reject(
                new Error(
                    "SCREEN_SHARE_CANCELLED"
                )
            );
        }


        if (
            state.pickerWindow &&
            !state.pickerWindow.isDestroyed()
        ) {

            state.pickerWindow.destroy();
        }


        state.pickerWindow =
            null;
    }


    // ======================================================
    // SOLICITAR FONTE DE SCREEN SHARE
    // ======================================================

    function requestScreenShareSelection() {

        if (
            state.pickerResolve ||
            state.pickerReject
        ) {

            cancelPicker();
        }


        return new Promise(
            (
                resolve,
                reject
            ) => {

                state.pickerResolve =
                    resolve;


                state.pickerReject =
                    reject;


                createPickerWindow();
            }
        );
    }


    // ======================================================
    // ABRIR PICKER
    // ======================================================

    ipcMain.handle(
        "screenshare:choose-source",
        async () => {

            console.log(
                "Picker solicitado pelo preload."
            );


            return requestScreenShareSelection();
        }
    );


    // ======================================================
    // FONTES
    // ======================================================

    ipcMain.handle(
        "screen:get-sources",
        async (
            _event,
            type =
            "window"
        ) => {

            const start =
                Date.now();


            const sourceType =
                type ===
                "screen"
                    ? "screen"
                    : "window";


            try {

                const sources =
                    await desktopCapturer
                        .getSources({
                            types: [
                                sourceType
                            ],

                            thumbnailSize: {
                                width:
                                    0,

                                height:
                                    0
                            },

                            fetchWindowIcons:
                                sourceType ===
                                "window"
                        });


                console.log(
                    `${sourceType}: ${sources.length} fontes em ${Date.now() - start}ms`
                );


                return sources.map(
                    source => ({

                        id:
                        source.id,

                        name:
                        source.name,

                        displayId:
                        source.display_id,

                        appIcon:
                            source.appIcon &&
                            !source.appIcon.isEmpty()
                                ? source.appIcon.toDataURL()
                                : null
                    })
                );

            } catch (error) {

                console.error(
                    "Erro listando fontes:",
                    error
                );


                return [];
            }
        }
    );


    // ======================================================
    // THUMBNAILS
    // ======================================================

    ipcMain.handle(
        "screen:get-thumbnails",
        async (
            _event,
            type
        ) => {

            if (
                type !==
                "screen"
            ) {

                return [];
            }


            try {

                const sources =
                    await desktopCapturer
                        .getSources({
                            types: [
                                "screen"
                            ],

                            thumbnailSize: {
                                width:
                                    320,

                                height:
                                    180
                            },

                            fetchWindowIcons:
                                false
                        });


                return sources.map(
                    source => ({

                        id:
                        source.id,

                        thumbnail:
                            source.thumbnail &&
                            !source.thumbnail.isEmpty()
                                ? source.thumbnail.toDataURL()
                                : null
                    })
                );

            } catch (error) {

                console.error(
                    "Erro carregando thumbnails:",
                    error
                );


                return [];
            }
        }
    );


    // ======================================================
    // SELECT SOURCE
    // ======================================================

    ipcMain.on(
        "screen:select-source",
        (
            _event,
            options
        ) => {

            if (
                !options ||
                !options.sourceId
            ) {

                return;
            }


            const sourceId =
                String(
                    options.sourceId
                );


            const isWindow =
                sourceId.startsWith(
                    "window:"
                );


            let audioMode =
                String(
                    options.audioMode ||
                    "none"
                );


            if (
                audioMode !==
                "process" &&
                audioMode !==
                "loopback" &&
                audioMode !==
                "none"
            ) {

                audioMode =
                    "none";
            }


            if (
                audioMode ===
                "process" &&
                !isWindow
            ) {

                audioMode =
                    "loopback";
            }


            console.log(
                "Seleção do picker:",
                {
                    sourceId,
                    isWindow,
                    audioMode
                }
            );


            state.selectedShareOptions = {
                sourceId,
                audioMode
            };


            const preparedToken =
                ++state.preparedSelectionToken;


            /*
             * Se uma troca for preparada pelo botão custom mas o
             * Sharkord não chegar a chamar getDisplayMedia, a fonte
             * não pode ficar presa para uma tentativa futura.
             */
            setTimeout(
                () => {

                    if (
                        state.preparedSelectionToken ===
                        preparedToken &&
                        state.selectedShareOptions
                    ) {

                        console.log(
                            "[ScreenShare Main] fonte pré-selecionada expirou sem uso."
                        );


                        state.selectedShareOptions =
                            null;
                    }
                },
                15000
            );


            const result = {
                sourceId,
                audioMode
            };


            const resolve =
                state.pickerResolve;


            state.pickerResolve =
                null;


            state.pickerReject =
                null;


            if (
                state.pickerWindow &&
                !state.pickerWindow.isDestroyed()
            ) {

                state.pickerWindow.destroy();
            }


            state.pickerWindow =
                null;


            if (
                resolve
            ) {

                resolve(
                    result
                );
            }
        }
    );


    ipcMain.on(
        "screen:cancel",
        () => {

            /*
             * O renderer do picker pode emitir um cancel tardio
             * durante/apos o fechamento da janela.
             *
             * Quando a fonte ja foi escolhida, state.pickerResolve e
             * state.pickerReject ja foram limpos. Nesse caso NAO devemos
             * chamar cancelPicker(), pois ele apagaria
             * state.selectedShareOptions antes do getDisplayMedia().
             */
            if (
                !state.pickerResolve &&
                !state.pickerReject
            ) {

                console.log(
                    "Cancel tardio do picker ignorado."
                );


                return;
            }


            console.log(
                "Compartilhamento cancelado."
            );


            cancelPicker();
        }
    );


    // ======================================================
    // DISPLAY MEDIA
    // ======================================================

    function configureDisplayMediaHandler() {

        session.defaultSession
            .setDisplayMediaRequestHandler(
                async (
                    request,
                    callback
                ) => {

                    console.log(
                        "getDisplayMedia real:",
                        request.securityOrigin
                    );


                    let selection =
                        state.selectedShareOptions;


                    if (
                        !selection
                    ) {

                        console.warn(
                            "getDisplayMedia sem fonte pré-selecionada; abrindo picker pelo processo principal."
                        );


                        try {

                            selection =
                                await requestScreenShareSelection();


                            console.log(
                                "Seleção obtida pelo fallback do getDisplayMedia:",
                                selection
                            );

                        } catch (error) {

                            console.log(
                                "Picker cancelado durante getDisplayMedia:",
                                error?.message ||
                                String(
                                    error
                                )
                            );


                            try {

                                callback({});

                            } catch {}


                            return;
                        }
                    }


                    /*
                     * screen:select-source também grava state.selectedShareOptions.
                     * A partir daqui usamos a cópia local e liberamos o estado
                     * global para a próxima solicitação.
                     */
                    state.selectedShareOptions =
                        null;


                    state.preparedSelectionToken++;


                    console.log(
                        "Iniciando captura:",
                        selection
                    );


                    try {

                        const sources =
                            await desktopCapturer
                                .getSources({
                                    types: [
                                        "screen",
                                        "window"
                                    ],

                                    thumbnailSize: {
                                        width:
                                            0,

                                        height:
                                            0
                                    },

                                    fetchWindowIcons:
                                        false
                                });


                        const source =
                            sources.find(
                                item =>
                                    item.id ===
                                    selection.sourceId
                            );


                        if (
                            !source
                        ) {

                            console.error(
                                "Fonte desapareceu:",
                                selection.sourceId
                            );


                            try {

                                callback({});

                            } catch {}


                            return;
                        }


                        if (
                            selection.audioMode ===
                            "loopback"
                        ) {

                            console.log(
                                "Captura:",
                                source.name
                            );


                            console.log(
                                "Áudio: LOOPBACK GLOBAL"
                            );


                            callback({
                                video:
                                source,

                                audio:
                                    "loopback"
                            });


                            return;
                        }


                        if (
                            selection.audioMode ===
                            "process"
                        ) {

                            console.log(
                                "Captura:",
                                source.name
                            );


                            console.log(
                                "Áudio: PROCESS LOOPBACK"
                            );


                            callback({
                                video:
                                source
                            });


                            return;
                        }


                        console.log(
                            "Captura:",
                            source.name
                        );


                        console.log(
                            "Áudio: DESATIVADO"
                        );


                        callback({
                            video:
                            source
                        });

                    } catch (error) {

                        console.error(
                            "Erro iniciando captura:",
                            error
                        );


                        try {

                            callback({});

                        } catch {}
                    }
                }
            );
    }

    configureDisplayMediaHandler();


    console.log(
        "[ScreenShare Main] display media handler configurado."
    );


    return {
        cancelPicker,

        getState: () => ({
            pickerOpen:
                Boolean(
                    state.pickerWindow &&
                    !state.pickerWindow.isDestroyed()
                ),

            awaitingSelection:
                Boolean(
                    state.pickerResolve ||
                    state.pickerReject
                ),

            hasPreselectedSource:
                Boolean(
                    state.selectedShareOptions
                )
        })
    };
}


module.exports = {
    setupScreenShareMain
};
