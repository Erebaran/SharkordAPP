const {
    app,
    BrowserWindow,
    desktopCapturer,
    session,
    ipcMain,
    dialog,
    nativeImage
} = require("electron");


const path =
    require("path");


const fs =
    require("fs");


const http =
    require("http");


const https =
    require("https");


const {
    spawn
} =
    require("child_process");


const {
    autoUpdater
} = require(
    "electron-updater"
);


// ======================================================
// JANELAS / PICKER
// ======================================================

let serverWindow =
    null;


let mainWindow =
    null;


let pickerWindow =
    null;


let pickerResolve =
    null;


let pickerReject =
    null;


let selectedShareOptions =
    null;


// ======================================================
// PROCESS AUDIO
// ======================================================

let processAudioState =
    null;


let nextProcessAudioCaptureId =
    1;


// ======================================================
// AUTO UPDATE
// ======================================================

let updaterConfigured =
    false;


let updaterInstalling =
    false;


let updaterState = {

    status:
        "idle",

    currentVersion:
        null,

    availableVersion:
        null,

    percent:
        0,

    transferred:
        0,

    total:
        0,

    bytesPerSecond:
        0,

    error:
        null
};


function getUpdaterState() {

    return {
        ...updaterState,

        currentVersion:
            app.getVersion(),

        packaged:
        app.isPackaged
    };
}


function sendUpdaterState() {

    updaterState.currentVersion =
        app.getVersion();


    if (
        mainWindow &&
        !mainWindow.isDestroyed()
    ) {

        mainWindow
            .webContents
            .send(
                "updater:state",
                getUpdaterState()
            );
    }
}


function setUpdaterState(
    patch
) {

    updaterState = {
        ...updaterState,
        ...patch,

        currentVersion:
            app.getVersion()
    };


    sendUpdaterState();
}


function configureAutoUpdater() {

    if (
        updaterConfigured
    ) {

        return;
    }


    updaterConfigured =
        true;


    updaterState.currentVersion =
        app.getVersion();


    /*
     * O electron-updater só funciona de verdade
     * quando o aplicativo está empacotado.
     *
     * Em npm.cmd start deixamos o estado visível
     * como "development" para a interface.
     */
    if (
        !app.isPackaged
    ) {

        console.log(
            "[Updater] modo desenvolvimento - verificação desativada."
        );


        setUpdaterState({
            status:
                "development",

            error:
                null
        });


        return;
    }


    /*
     * A atualização agora é controlada pela UI:
     *
     * 1. verifica;
     * 2. informa que existe nova versão;
     * 3. usuário manda baixar;
     * 4. usuário manda reiniciar/instalar.
     */
    autoUpdater.autoDownload =
        false;


    autoUpdater.autoInstallOnAppQuit =
        false;


    autoUpdater.on(
        "checking-for-update",
        () => {

            console.log(
                "[Updater] procurando atualização..."
            );


            setUpdaterState({
                status:
                    "checking",

                availableVersion:
                    null,

                percent:
                    0,

                transferred:
                    0,

                total:
                    0,

                bytesPerSecond:
                    0,

                error:
                    null
            });
        }
    );


    autoUpdater.on(
        "update-available",
        info => {

            console.log(
                "[Updater] atualização encontrada:",
                {
                    atual:
                        app.getVersion(),

                    nova:
                    info.version
                }
            );


            setUpdaterState({
                status:
                    "available",

                availableVersion:
                    info.version ||
                    null,

                percent:
                    0,

                transferred:
                    0,

                total:
                    0,

                bytesPerSecond:
                    0,

                error:
                    null
            });
        }
    );


    autoUpdater.on(
        "update-not-available",
        info => {

            console.log(
                "[Updater] nenhuma atualização disponível:",
                {
                    atual:
                        app.getVersion(),

                    servidor:
                    info.version
                }
            );


            setUpdaterState({
                status:
                    "up-to-date",

                availableVersion:
                    null,

                percent:
                    0,

                transferred:
                    0,

                total:
                    0,

                bytesPerSecond:
                    0,

                error:
                    null
            });
        }
    );


    autoUpdater.on(
        "download-progress",
        progress => {

            const percent =
                Number(
                    progress.percent ||
                    0
                );


            console.log(
                `[Updater] download: ${percent.toFixed(1)}%`
            );


            setUpdaterState({
                status:
                    "downloading",

                percent,

                transferred:
                    Number(
                        progress.transferred ||
                        0
                    ),

                total:
                    Number(
                        progress.total ||
                        0
                    ),

                bytesPerSecond:
                    Number(
                        progress.bytesPerSecond ||
                        0
                    ),

                error:
                    null
            });
        }
    );


    autoUpdater.on(
        "update-downloaded",
        info => {

            console.log(
                "[Updater] atualização pronta para instalar:",
                info.version
            );


            setUpdaterState({
                status:
                    "downloaded",

                availableVersion:
                    info.version ||
                    updaterState.availableVersion,

                percent:
                    100,

                error:
                    null
            });
        }
    );


    autoUpdater.on(
        "error",
        error => {

            console.error(
                "[Updater] erro:",
                error
            );


            setUpdaterState({
                status:
                    "error",

                error:
                    error?.message ||
                    String(
                        error
                    )
            });
        }
    );


    /*
     * Continua verificando automaticamente ao abrir,
     * mas não baixa nada sem autorização do usuário.
     */
    setTimeout(
        () => {

            console.log(
                "[Updater] iniciando verificação automática."
            );


            autoUpdater
                .checkForUpdates()
                .catch(
                    error => {

                        console.error(
                            "[Updater] falha verificando atualização:",
                            error
                        );
                    }
                );

        },
        5000
    );
}


// ======================================================
// IPC AUTO UPDATE
// ======================================================

ipcMain.handle(
    "updater:get-state",
    async () => {

        return getUpdaterState();
    }
);


ipcMain.handle(
    "updater:check",
    async () => {

        if (
            !app.isPackaged
        ) {

            return {
                success:
                    false,

                reason:
                    "development",

                state:
                    getUpdaterState()
            };
        }


        try {

            await autoUpdater
                .checkForUpdates();


            return {
                success:
                    true,

                state:
                    getUpdaterState()
            };

        } catch (error) {

            console.error(
                "[Updater] erro na verificação manual:",
                error
            );


            return {
                success:
                    false,

                reason:
                    "error",

                error:
                    error?.message ||
                    String(
                        error
                    ),

                state:
                    getUpdaterState()
            };
        }
    }
);


ipcMain.handle(
    "updater:download",
    async () => {

        if (
            !app.isPackaged
        ) {

            return {
                success:
                    false,

                reason:
                    "development",

                state:
                    getUpdaterState()
            };
        }


        if (
            updaterState.status !==
            "available"
        ) {

            return {
                success:
                    false,

                reason:
                    "not-available",

                state:
                    getUpdaterState()
            };
        }


        try {

            setUpdaterState({
                status:
                    "downloading",

                percent:
                    0,

                error:
                    null
            });


            await autoUpdater
                .downloadUpdate();


            return {
                success:
                    true,

                state:
                    getUpdaterState()
            };

        } catch (error) {

            console.error(
                "[Updater] erro iniciando download:",
                error
            );


            setUpdaterState({
                status:
                    "error",

                error:
                    error?.message ||
                    String(
                        error
                    )
            });


            return {
                success:
                    false,

                reason:
                    "error",

                error:
                    error?.message ||
                    String(
                        error
                    ),

                state:
                    getUpdaterState()
            };
        }
    }
);


ipcMain.handle(
    "updater:install",
    async () => {

        if (
            !app.isPackaged
        ) {

            return {
                success:
                    false,

                reason:
                    "development",

                state:
                    getUpdaterState()
            };
        }


        if (
            updaterState.status !==
            "downloaded"
        ) {

            return {
                success:
                    false,

                reason:
                    "not-downloaded",

                state:
                    getUpdaterState()
            };
        }


        updaterInstalling =
            true;


        setUpdaterState({
            status:
                "installing",

            error:
                null
        });


        setImmediate(
            () => {

                autoUpdater.quitAndInstall(
                    false,
                    true
                );
            }
        );


        return {
            success:
                true,

            state:
                getUpdaterState()
        };
    }
);


// ======================================================
// HELPER DE ÁUDIO
// ======================================================

function getAudioHelperPath() {

    if (
        app.isPackaged
    ) {

        return path.join(
            process.resourcesPath,
            "native",
            "process-audio-capture.exe"
        );
    }


    return path.join(
        __dirname,
        "native",
        "process-audio-capture.exe"
    );
}


// ======================================================
// HWND
// ======================================================

function parseWindowHandle(
    sourceId
) {

    const match =
        /^window:(\d+):/
            .exec(
                String(
                    sourceId ||
                    ""
                )
            );


    if (
        !match
    ) {

        throw new Error(
            "Não foi possível identificar a janela selecionada."
        );
    }


    return match[1];
}


// ======================================================
// ERRO PROCESS AUDIO
// ======================================================

function emitProcessAudioError(
    message
) {

    console.error(
        "[Process Audio]",
        message
    );


    if (
        mainWindow &&
        !mainWindow.isDestroyed()
    ) {

        mainWindow
            .webContents
            .send(
                "process-audio:error",
                message
            );
    }
}


// ======================================================
// PARAR PROCESS AUDIO
// ======================================================

function stopProcessAudio(
    requestedCaptureId = null
) {

    const state =
        processAudioState;


    if (
        !state
    ) {

        console.log(
            "[Process Audio] nenhum helper ativo."
        );


        return false;
    }


    if (
        requestedCaptureId !==
        null &&
        requestedCaptureId !==
        undefined &&
        Number(
            requestedCaptureId
        ) !==
        state.captureId
    ) {

        console.log(
            "[Process Audio] stop antigo ignorado:",
            {
                solicitado:
                requestedCaptureId,

                atual:
                state.captureId
            }
        );


        return false;
    }


    console.log(
        "[Process Audio] encerrando captura:",
        state.captureId
    );


    processAudioState =
        null;


    try {

        clearTimeout(
            state.timeout
        );

    } catch {}


    try {

        state.child
            .stdout
            ?.removeAllListeners(
                "data"
            );

    } catch {}


    try {

        state.child
            .stderr
            ?.removeAllListeners(
                "data"
            );

    } catch {}


    if (
        !state.started &&
        !state.settled
    ) {

        state.settled =
            true;


        state.rejectStart(
            new Error(
                "Captura de áudio interrompida."
            )
        );
    }


    try {

        state.child.kill();

    } catch {}


    return true;
}


// ======================================================
// PROCESSAR PCM
// ======================================================

function handleProcessAudioData(
    state,
    chunk
) {

    if (
        processAudioState !==
        state
    ) {

        return;
    }


    state.parserBuffer =
        Buffer.concat([
            state.parserBuffer,
            chunk
        ]);


    if (
        !state.headerRead
    ) {

        const HEADER_SIZE =
            16;


        if (
            state.parserBuffer.length <
            HEADER_SIZE
        ) {

            return;
        }


        const magic =
            state.parserBuffer
                .subarray(
                    0,
                    8
                )
                .toString(
                    "ascii"
                );


        if (
            magic !==
            "SHKAUD01"
        ) {

            const message =
                "Cabeçalho inválido recebido do helper.";


            emitProcessAudioError(
                message
            );


            if (
                !state.settled
            ) {

                state.settled =
                    true;


                state.rejectStart(
                    new Error(
                        message
                    )
                );
            }


            stopProcessAudio(
                state.captureId
            );


            return;
        }


        state.format = {

            sampleRate:
                state.parserBuffer
                    .readUInt32LE(
                        8
                    ),

            channels:
                state.parserBuffer
                    .readUInt16LE(
                        12
                    ),

            bitsPerSample:
                state.parserBuffer
                    .readUInt16LE(
                        14
                    )
        };


        state.parserBuffer =
            state.parserBuffer
                .subarray(
                    HEADER_SIZE
                );


        state.headerRead =
            true;


        state.started =
            true;


        console.log(
            "[Process Audio] Formato:",
            state.format
        );


        console.log(
            "[Process Audio] Capture ID:",
            state.captureId
        );


        if (
            !state.settled
        ) {

            state.settled =
                true;


            state.resolveStart({
                captureId:
                state.captureId,

                ...state.format
            });
        }
    }


    while (
        state.parserBuffer.length >=
        4
        ) {

        const bytes =
            state.parserBuffer
                .readUInt32LE(
                    0
                );


        if (
            bytes >
            4 *
            1024 *
            1024
        ) {

            emitProcessAudioError(
                "Pacote de áudio inválido."
            );


            stopProcessAudio(
                state.captureId
            );


            return;
        }


        if (
            state.parserBuffer.length <
            4 +
            bytes
        ) {

            return;
        }


        const pcm =
            Buffer.from(
                state.parserBuffer
                    .subarray(
                        4,
                        4 +
                        bytes
                    )
            );


        state.parserBuffer =
            state.parserBuffer
                .subarray(
                    4 +
                    bytes
                );


        if (
            processAudioState !==
            state
        ) {

            return;
        }


        if (
            mainWindow &&
            !mainWindow.isDestroyed()
        ) {

            mainWindow
                .webContents
                .send(
                    "process-audio:chunk",
                    {
                        captureId:
                        state.captureId,

                        pcm
                    }
                );
        }
    }
}


// ======================================================
// INICIAR PROCESS AUDIO
// ======================================================

async function startProcessAudio(
    sourceId
) {

    stopProcessAudio();


    if (
        process.platform !==
        "win32"
    ) {

        throw new Error(
            "Process Loopback está disponível apenas no Windows."
        );
    }


    const hwnd =
        parseWindowHandle(
            sourceId
        );


    const helper =
        getAudioHelperPath();


    if (
        !fs.existsSync(
            helper
        )
    ) {

        throw new Error(
            `process-audio-capture.exe não encontrado: ${helper}`
        );
    }


    const captureId =
        nextProcessAudioCaptureId++;


    console.log(
        "[Process Audio] Source:",
        sourceId
    );


    console.log(
        "[Process Audio] HWND:",
        hwnd
    );


    console.log(
        "[Process Audio] Helper:",
        helper
    );


    console.log(
        "[Process Audio] Novo Capture ID:",
        captureId
    );


    const child =
        spawn(
            helper,
            [
                hwnd
            ],
            {
                windowsHide:
                    true,

                stdio: [
                    "ignore",
                    "pipe",
                    "pipe"
                ]
            }
        );


    let resolveStart;
    let rejectStart;


    const startPromise =
        new Promise(
            (
                resolve,
                reject
            ) => {

                resolveStart =
                    resolve;


                rejectStart =
                    reject;
            }
        );


    const state = {

        captureId,

        sourceId,

        hwnd,

        child,

        parserBuffer:
            Buffer.alloc(
                0
            ),

        headerRead:
            false,

        started:
            false,

        settled:
            false,

        format:
            null,

        resolveStart,

        rejectStart,

        timeout:
            null
    };


    processAudioState =
        state;


    state.timeout =
        setTimeout(
            () => {

                if (
                    processAudioState !==
                    state
                ) {

                    return;
                }


                if (
                    state.started
                ) {

                    return;
                }


                if (
                    !state.settled
                ) {

                    state.settled =
                        true;


                    state.rejectStart(
                        new Error(
                            "O helper de áudio demorou demais para iniciar."
                        )
                    );
                }


                stopProcessAudio(
                    state.captureId
                );

            },
            10000
        );


    child.stdout.on(
        "data",
        chunk => {

            handleProcessAudioData(
                state,
                chunk
            );
        }
    );


    child.stderr.on(
        "data",
        data => {

            if (
                processAudioState !==
                state
            ) {

                return;
            }


            const message =
                data
                    .toString()
                    .trim();


            if (
                message
            ) {

                console.error(
                    "[Process Audio stderr]",
                    message
                );
            }
        }
    );


    child.on(
        "error",
        error => {

            if (
                processAudioState !==
                state
            ) {

                console.log(
                    "[Process Audio] erro de helper antigo ignorado:",
                    {
                        captureId,

                        message:
                        error.message
                    }
                );


                return;
            }


            clearTimeout(
                state.timeout
            );


            if (
                !state.settled
            ) {

                state.settled =
                    true;


                state.rejectStart(
                    error
                );
            }


            processAudioState =
                null;


            emitProcessAudioError(
                error.message
            );
        }
    );


    child.on(
        "exit",
        (
            code,
            signal
        ) => {

            clearTimeout(
                state.timeout
            );


            if (
                processAudioState !==
                state
            ) {

                console.log(
                    "[Process Audio] helper antigo encerrado:",
                    {
                        captureId,
                        code,
                        signal
                    }
                );


                return;
            }


            console.log(
                "[Process Audio] Helper encerrou:",
                {
                    captureId,
                    code,
                    signal
                }
            );


            processAudioState =
                null;


            if (
                !state.started &&
                !state.settled
            ) {

                state.settled =
                    true;


                state.rejectStart(
                    new Error(
                        `Helper encerrou antes de iniciar. Código: ${code ?? "?"}, sinal: ${signal ?? "?"}`
                    )
                );
            }
        }
    );


    const result =
        await startPromise;


    clearTimeout(
        state.timeout
    );


    if (
        processAudioState !==
        state
    ) {

        throw new Error(
            "A captura de áudio foi substituída durante a inicialização."
        );
    }


    console.log(
        "[Process Audio] Captura iniciada:",
        captureId
    );


    return result;
}


// ======================================================
// IPC PROCESS AUDIO
// ======================================================

ipcMain.handle(
    "process-audio:start",
    async (
        _event,
        sourceId
    ) => {

        console.log(
            "[Process Audio] start solicitado:",
            sourceId
        );


        return startProcessAudio(
            sourceId
        );
    }
);


ipcMain.handle(
    "process-audio:stop",
    async (
        _event,
        captureId
    ) => {

        console.log(
            "[Process Audio] stop solicitado:",
            captureId
        );


        return stopProcessAudio(
            captureId
        );
    }
);


// ======================================================
// ÍCONE
// ======================================================

function getAppIconPath() {

    return path.join(
        __dirname,
        "assets",
        "sharkord.ico"
    );
}


function getAppIcon() {

    const iconPath =
        getAppIconPath();


    if (
        !fs.existsSync(
            iconPath
        )
    ) {

        console.warn(
            "[App Icon] arquivo não encontrado:",
            iconPath
        );


        return null;
    }


    const icon =
        nativeImage.createFromPath(
            iconPath
        );


    if (
        icon.isEmpty()
    ) {

        console.warn(
            "[App Icon] Electron não conseguiu ler:",
            iconPath
        );


        return null;
    }


    return icon;
}


function applyWindowIcon(
    win
) {

    if (
        !win ||
        win.isDestroyed()
    ) {

        return;
    }


    const icon =
        getAppIcon();


    if (!icon) {

        return;
    }


    try {

        win.setIcon(
            icon
        );

    } catch (error) {

        console.error(
            "[App Icon] erro aplicando ícone:",
            error
        );
    }


    win.once(
        "ready-to-show",
        () => {

            if (
                win.isDestroyed()
            ) {

                return;
            }


            try {

                win.setIcon(
                    icon
                );


                console.log(
                    "[App Icon] aplicado:",
                    win.getTitle()
                );

            } catch (error) {

                console.error(
                    "[App Icon] erro no ready-to-show:",
                    error
                );
            }
        }
    );
}


// ======================================================
// CONFIG DO SERVIDOR
// ======================================================

function getConfigFile() {

    return path.join(
        app.getPath(
            "userData"
        ),
        "server.json"
    );
}


function readServerConfig() {

    try {

        const file =
            getConfigFile();


        if (
            !fs.existsSync(
                file
            )
        ) {

            return {
                server:
                    null,

                servers:
                    {}
            };
        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );


        return {
            server:
                data.server ||
                null,

            servers:
                data.servers &&
                typeof data.servers ===
                "object"
                    ? data.servers
                    : {}
        };

    } catch (error) {

        console.error(
            "Erro lendo configuração:",
            error
        );


        return {
            server:
                null,

            servers:
                {}
        };
    }
}


function writeServerConfig(
    config
) {

    try {

        fs.writeFileSync(
            getConfigFile(),

            JSON.stringify(
                config,
                null,
                2
            ),

            "utf8"
        );


        return true;

    } catch (error) {

        console.error(
            "Erro salvando configuração:",
            error
        );


        return false;
    }
}


function normalizeServerUrl(
    input
) {

    let value =
        String(
            input ||
            ""
        ).trim();


    if (
        !value
    ) {

        throw new Error(
            "Servidor não informado."
        );
    }


    if (
        !value.startsWith(
            "http://"
        ) &&
        !value.startsWith(
            "https://"
        )
    ) {

        value =
            "https://" +
            value;
    }


    const parsed =
        new URL(
            value
        );


    if (
        parsed.protocol !==
        "http:" &&
        parsed.protocol !==
        "https:"
    ) {

        throw new Error(
            "Protocolo inválido."
        );
    }


    return parsed.origin;
}


function guessServerNameFromUrl(
    serverUrl
) {

    try {

        const hostname =
            new URL(
                serverUrl
            ).hostname;


        const labels =
            hostname
                .split(".")
                .filter(Boolean);


        const ignored =
            new Set([
                "www",
                "sharkord",
                "app",
                "chat"
            ]);


        const candidate =
            labels.find(
                label =>
                    !ignored.has(
                        label.toLowerCase()
                    )
            ) ||
            labels[0] ||
            "Servidor";


        return candidate
            .replace(
                /[-_]+/g,
                " "
            )
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );

    } catch {

        return "Servidor";
    }
}


function buildPublicServerFileUrl(
    serverUrl,
    fileName
) {

    if (
        !serverUrl ||
        !fileName
    ) {

        return null;
    }


    return (
        normalizeServerUrl(
            serverUrl
        ) +
        "/public/" +
        encodeURIComponent(
            String(
                fileName
            )
        )
    );
}


function saveServerBrandingSnapshot(
    input,
    settings
) {

    if (
        !input ||
        !settings ||
        typeof settings !==
        "object"
    ) {

        return false;
    }


    let serverUrl;


    try {

        serverUrl =
            normalizeServerUrl(
                input
            );

    } catch {

        return false;
    }


    const config =
        readServerConfig();


    const stored =
        config.servers[
            serverUrl
            ] ||
        {};


    config.servers[
        serverUrl
        ] = {

        ...stored,

        name:
            settings.name ||
            stored.name ||
            guessServerNameFromUrl(
                serverUrl
            ),

        logoName:
            settings.logo?.name ||
            null,

        bannerName:
            settings.banner?.name ||
            null
    };


    return writeServerConfig(
        config
    );
}


function getServerProfile(
    input
) {

    const serverUrl =
        normalizeServerUrl(
            input
        );


    const config =
        readServerConfig();


    const stored =
        config.servers[
            serverUrl
            ] ||
        {};


    return {
        url:
        serverUrl,

        name:
            stored.name ||
            guessServerNameFromUrl(
                serverUrl
            ),

        avatarDataUrl:
            buildPublicServerFileUrl(
                serverUrl,
                stored.logoName
            ),

        bannerDataUrl:
            buildPublicServerFileUrl(
                serverUrl,
                stored.bannerName
            )
    };
}


function sanitizeUploadFileName(
    value
) {

    return path
        .basename(
            String(
                value ||
                "image"
            )
        )
        .trim()
        .normalize(
            "NFKD"
        )
        .replace(
            /[^\x00-\x7F]/g,
            "_"
        )
        .replace(
            /[\r\n]/g,
            "_"
        );
}


function getImageMimeType(
    filePath
) {

    const extension =
        path.extname(
            filePath
        )
            .toLowerCase();


    const mimeTypes = {
        ".png":
            "image/png",

        ".jpg":
            "image/jpeg",

        ".jpeg":
            "image/jpeg",

        ".webp":
            "image/webp"
    };


    return mimeTypes[
            extension
            ] ||
        null;
}


function uploadBrandingFileToServer(
    serverUrl,
    token,
    filePath
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const mimeType =
                getImageMimeType(
                    filePath
                );


            if (
                !mimeType
            ) {

                reject(
                    new Error(
                        "Formato não suportado. Use PNG, JPG, JPEG ou WEBP."
                    )
                );


                return;
            }


            const stats =
                fs.statSync(
                    filePath
                );


            const originalName =
                sanitizeUploadFileName(
                    path.basename(
                        filePath
                    )
                );


            const uploadUrl =
                new URL(
                    "/upload",
                    serverUrl
                );


            const requestModule =
                uploadUrl.protocol ===
                "https:"
                    ? https
                    : http;


            /*
             * O Sharkord valida UploadHeaders.TOKEN,
             * UploadHeaders.ORIGINAL_NAME e CONTENT_LENGTH.
             * As instalações atuais usam os nomes abaixo.
             * Content-Length é enviado explicitamente aqui,
             * pois este request roda no processo principal.
             */
            // O cliente oficial do Sharkord envia o arquivo como octet-stream e
            // usa headers próprios para token/nome/tipo. Como builds diferentes
            // do Sharkord já usaram nomes ligeiramente diferentes para esses
            // headers, enviamos os aliases compatíveis; o servidor ignora os
            // desconhecidos e lê somente os que pertencem ao seu UploadHeaders.
            const safeOriginalName = String(originalName || "upload")
                .trim()
                .normalize("NFKD")
                .replace(/[^\x00-\x7F]/g, "_");

            const contentLength = String(stats.size);

            const headers = {
                "Content-Type": "application/octet-stream",
                "Content-Length": contentLength,

                // MIME/type aliases
                "type": mimeType,
                "x-type": mimeType,
                "file-type": mimeType,
                "x-file-type": mimeType,
                "sharkord-type": mimeType,
                "x-sharkord-type": mimeType,

                // Original filename aliases
                "original-name": safeOriginalName,
                "x-original-name": safeOriginalName,
                "x-file-name": safeOriginalName,
                "sharkord-original-name": safeOriginalName,
                "x-sharkord-original-name": safeOriginalName,

                // Authentication token aliases
                "token": token,
                "x-token": token,
                "sharkord-token": token,
                "x-sharkord-token": token
            };


            const request =
                requestModule.request(
                    uploadUrl,
                    {
                        method:
                            "POST",

                        headers
                    },
                    response => {

                        const chunks =
                            [];


                        response.on(
                            "data",
                            chunk => {

                                chunks.push(
                                    Buffer.from(
                                        chunk
                                    )
                                );
                            }
                        );


                        response.on(
                            "end",
                            () => {

                                const body =
                                    Buffer.concat(
                                        chunks
                                    )
                                        .toString(
                                            "utf8"
                                        );


                                let data =
                                    null;


                                try {

                                    data =
                                        body
                                            ? JSON.parse(
                                                body
                                            )
                                            : null;

                                } catch {}


                                if (
                                    response.statusCode >=
                                    200 &&
                                    response.statusCode <
                                    300 &&
                                    data
                                ) {

                                    resolve(
                                        data
                                    );


                                    return;
                                }


                                const serverMessage =
                                    data?.error ||
                                    data?.message ||
                                    (body && body.trim()) ||
                                    null;

                                reject(
                                    new Error(
                                        serverMessage
                                            ? `Falha no upload do Sharkord (${response.statusCode || "?"}): ${serverMessage}`
                                            : `Falha no upload do Sharkord (${response.statusCode || "?"}).`
                                    )
                                );
                            }
                        );
                    }
                );


            request.on(
                "error",
                reject
            );


            fs.createReadStream(
                filePath
            )
                .on(
                    "error",
                    reject
                )
                .pipe(
                    request
                );
        }
    );
}


function readLastServer() {

    return (
        readServerConfig()
            .server ||
        null
    );
}


function saveServer(
    serverUrl
) {

    const config =
        readServerConfig();


    config.server =
        serverUrl;


    if (
        !config.servers[
            serverUrl
            ]
    ) {

        config.servers[
            serverUrl
            ] = {

            name:
                guessServerNameFromUrl(
                    serverUrl
                )
        };
    }


    writeServerConfig(
        config
    );
}


// ======================================================
// SERVER WINDOW
// ======================================================

function createServerWindow() {

    if (
        serverWindow &&
        !serverWindow.isDestroyed()
    ) {

        serverWindow.focus();


        return;
    }


    const appIcon =
        getAppIcon();


    serverWindow =
        new BrowserWindow({
            width:
                520,

            height:
                520,

            minWidth:
                460,

            minHeight:
                440,

            title:
                "Sharkord Desktop",

            icon:
                appIcon ||
                undefined,

            autoHideMenuBar:
                true,

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "server-preload.js"
                    ),

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true
            }
        });


    applyWindowIcon(
        serverWindow
    );


    serverWindow.loadFile(
        path.join(
            __dirname,
            "server-picker.html"
        )
    );


    serverWindow.on(
        "closed",
        () => {

            serverWindow =
                null;


            if (
                !mainWindow ||
                mainWindow.isDestroyed()
            ) {

                app.quit();
            }
        }
    );
}


// ======================================================
// MAIN WINDOW
// ======================================================

function createMainWindow() {

    if (
        mainWindow &&
        !mainWindow.isDestroyed()
    ) {

        mainWindow.focus();


        return;
    }


    const appIcon =
        getAppIcon();


    mainWindow =
        new BrowserWindow({
            width:
                1400,

            height:
                900,

            minWidth:
                900,

            minHeight:
                600,

            title:
                "Sharkord",

            icon:
                appIcon ||
                undefined,

            autoHideMenuBar:
                true,

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "main-preload.js"
                    ),

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true
            }
        });


    applyWindowIcon(
        mainWindow
    );


    attachSharkordWebSocketLogger(
        mainWindow
    );


    mainWindow.webContents.on(
        "console-message",
        event => {

            console.log(
                `[Renderer:${event.level}]`,
                event.message,
                `(${event.sourceId}:${event.lineNumber})`
            );
        }
    );


    mainWindow.on(
        "close",
        event => {

            if (
                updaterInstalling
            ) {

                console.log(
                    "[Updater] fechamento autorizado para instalar atualização."
                );


                return;
            }


            event.preventDefault();


            cancelPicker();


            stopProcessAudio();


            if (
                mainWindow &&
                !mainWindow.isDestroyed()
            ) {

                mainWindow.destroy();
            }


            mainWindow =
                null;


            app.quit();
        }
    );


    mainWindow.on(
        "closed",
        () => {

            stopProcessAudio();


            mainWindow =
                null;
        }
    );
}


// ======================================================
// SERVER IPC
// ======================================================

ipcMain.handle(
    "server:get-last",
    async () => {

        return readLastServer();
    }
);


ipcMain.handle(
    "server:get-last-profile",
    async () => {

        const lastServer =
            readLastServer();


        if (
            !lastServer
        ) {

            return null;
        }


        return getServerProfile(
            lastServer
        );
    }
);


ipcMain.handle(
    "server:branding:get",
    async (
        _event,
        serverUrl
    ) => {

        return getServerProfile(
            serverUrl
        );
    }
);


ipcMain.handle(
    "server:branding:choose-image",
    async (
        event,
        options
    ) => {

        const serverUrl =
            normalizeServerUrl(
                options?.serverUrl
            );


        const type =
            options?.type ===
            "banner"
                ? "banner"
                : "avatar";


        const token =
            String(
                options?.token ||
                ""
            )
                .trim();


        if (
            !token
        ) {

            throw new Error(
                "Token de autenticação do Sharkord não encontrado."
            );
        }


        const ownerWindow =
            BrowserWindow
                .fromWebContents(
                    event.sender
                ) ||
            mainWindow ||
            serverWindow;


        const dialogOptions = {

            title:
                type ===
                "banner"
                    ? "Escolher banner do servidor"
                    : "Escolher logo do servidor",

            properties: [
                "openFile"
            ],

            filters: [
                {
                    name:
                        "Imagens",

                    extensions: [
                        "png",
                        "jpg",
                        "jpeg",
                        "webp"
                    ]
                }
            ]
        };


        const result =
            ownerWindow &&
            !ownerWindow.isDestroyed()
                ? await dialog.showOpenDialog(
                    ownerWindow,
                    dialogOptions
                )
                : await dialog.showOpenDialog(
                    dialogOptions
                );


        if (
            result.canceled ||
            !result.filePaths[0]
        ) {

            return {
                cancelled:
                    true
            };
        }


        const selectedPath =
            result.filePaths[0];


        const stats =
            fs.statSync(
                selectedPath
            );


        const maxBytes =
            type ===
            "banner"
                ? 100 * 1024 * 1024
                : 50 * 1024 * 1024;


        if (
            stats.size >
            maxBytes
        ) {

            throw new Error(
                type ===
                "banner"
                    ? "O banner deve ter no máximo 100 MB."
                    : "O logo deve ter no máximo 50 MB."
            );
        }


        const uploadedFile =
            await uploadBrandingFileToServer(
                serverUrl,
                token,
                selectedPath
            );


        if (
            !uploadedFile?.id
        ) {

            throw new Error(
                "O Sharkord não retornou o ID do arquivo enviado."
            );
        }


        console.log(
            "[Server Branding] upload concluído:",
            {
                type,
                fileId:
                uploadedFile.id,
                name:
                    uploadedFile.originalName ||
                    path.basename(
                        selectedPath
                    ),
                size:
                stats.size
            }
        );


        return {
            cancelled:
                false,

            type,

            file:
            uploadedFile
        };
    }
);


ipcMain.handle(
    "server:connect",
    async (
        _event,
        input
    ) => {

        const serverUrl =
            normalizeServerUrl(
                input
            );


        console.log(
            "Carregando servidor:",
            serverUrl
        );


        createMainWindow();


        try {

            await mainWindow.loadURL(
                serverUrl
            );

        } catch (error) {

            console.error(
                "Erro no loadURL:",
                error
            );


            if (
                mainWindow &&
                !mainWindow.isDestroyed()
            ) {

                mainWindow.destroy();
            }


            mainWindow =
                null;


            throw error;
        }


        saveServer(
            serverUrl
        );


        if (
            serverWindow &&
            !serverWindow.isDestroyed()
        ) {

            serverWindow.destroy();
        }


        serverWindow =
            null;


        return {
            success:
                true
        };
    }
);


// ======================================================
// PICKER
// ======================================================

function createPickerWindow() {

    if (
        pickerWindow &&
        !pickerWindow.isDestroyed()
    ) {

        pickerWindow.focus();


        return;
    }


    const appIcon =
        getAppIcon();


    pickerWindow =
        new BrowserWindow({
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
                true,

            parent:
            mainWindow,

            autoHideMenuBar:
                true,

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "preload.js"
                    ),

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true
            }
        });


    applyWindowIcon(
        pickerWindow
    );


    const pickerPath =
        path.join(
            __dirname,
            "picker.html"
        );


    console.log(
        "Picker carregado de:",
        pickerPath
    );


    pickerWindow.loadFile(
        pickerPath
    );


    pickerWindow.on(
        "closed",
        () => {

            pickerWindow =
                null;


            if (
                pickerReject
            ) {

                const reject =
                    pickerReject;


                pickerResolve =
                    null;


                pickerReject =
                    null;


                selectedShareOptions =
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
        pickerReject;


    pickerResolve =
        null;


    pickerReject =
        null;


    selectedShareOptions =
        null;


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
        pickerWindow &&
        !pickerWindow.isDestroyed()
    ) {

        pickerWindow.destroy();
    }


    pickerWindow =
        null;
}


// ======================================================
// ABRIR PICKER
// ======================================================

ipcMain.handle(
    "screenshare:choose-source",
    async () => {

        if (
            pickerResolve ||
            pickerReject
        ) {

            cancelPicker();
        }


        return new Promise(
            (
                resolve,
                reject
            ) => {

                pickerResolve =
                    resolve;


                pickerReject =
                    reject;


                createPickerWindow();
            }
        );
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


        selectedShareOptions = {
            sourceId,
            audioMode
        };


        const result = {
            sourceId,
            audioMode
        };


        const resolve =
            pickerResolve;


        pickerResolve =
            null;


        pickerReject =
            null;


        if (
            pickerWindow &&
            !pickerWindow.isDestroyed()
        ) {

            pickerWindow.destroy();
        }


        pickerWindow =
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


                if (
                    !selectedShareOptions
                ) {

                    console.error(
                        "getDisplayMedia sem fonte pré-selecionada."
                    );


                    return;
                }


                const selection =
                    selectedShareOptions;


                selectedShareOptions =
                    null;


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
                }
            }
        );
}


// ======================================================
// SHARKORD API LOGGER
// ======================================================

function configureSharkordApiLogger() {

    const interestingWords = [
        "api",
        "trpc",
        "user",
        "users",
        "member",
        "members",
        "role",
        "roles",
        "permission",
        "permissions"
    ];


    const shouldLogRequest = details => {

        try {

            const resourceType =
                String(
                    details.resourceType ||
                    ""
                ).toLowerCase();


            const url =
                String(
                    details.url ||
                    ""
                );


            const lowerUrl =
                url.toLowerCase();


            const isNetworkDataRequest =
                resourceType === "xhr" ||
                resourceType === "fetch" ||
                resourceType === "websocket" ||
                resourceType === "websocket";


            const hasInterestingWord =
                interestingWords.some(
                    word =>
                        lowerUrl.includes(
                            word
                        )
                );


            /*
             * Alguns frameworks, especialmente tRPC,
             * usam um único endpoint genérico. Por isso
             * logamos todas as chamadas XHR/fetch/ws da
             * origem Sharkord, mesmo sem "role" na URL.
             */
            let isSharkordOrigin =
                false;


            try {

                const parsed =
                    new URL(
                        url
                    );


                isSharkordOrigin =
                    parsed.hostname
                        .toLowerCase()
                        .includes(
                            "sharkord"
                        ) ||
                    parsed.hostname
                        .toLowerCase()
                        .includes(
                            "erebaran"
                        );

            } catch {}


            return (
                hasInterestingWord ||
                (
                    isNetworkDataRequest &&
                    isSharkordOrigin
                )
            );

        } catch {

            return false;
        }
    };


    try {

        session.defaultSession
            .webRequest
            .onBeforeRequest(
                {
                    urls: [
                        "http://*/*",
                        "https://*/*",
                        "ws://*/*",
                        "wss://*/*"
                    ]
                },
                (
                    details,
                    callback
                ) => {

                    if (
                        shouldLogRequest(
                            details
                        )
                    ) {

                        console.log(
                            "[Sharkord API]",
                            String(
                                details.method ||
                                "GET"
                            ),
                            `[${details.resourceType || "?"}]`,
                            details.url
                        );


                        if (
                            details.uploadData &&
                            details.uploadData.length
                        ) {

                            const bodies = [];


                            for (
                                const item
                                of details.uploadData
                                ) {

                                if (
                                    item.bytes
                                ) {

                                    try {

                                        const body =
                                            Buffer
                                                .from(
                                                    item.bytes
                                                )
                                                .toString(
                                                    "utf8"
                                                );


                                        if (
                                            body.trim()
                                        ) {

                                            bodies.push(
                                                body
                                            );
                                        }

                                    } catch {}
                                }
                            }


                            if (
                                bodies.length
                            ) {

                                console.log(
                                    "[Sharkord API BODY]",
                                    bodies.join(
                                        "\n"
                                    )
                                );
                            }
                        }
                    }


                    callback({});
                }
            );


        console.log(
            "[Sharkord API] logger de rede ativado."
        );

    } catch (error) {

        console.error(
            "[Sharkord API] erro ativando logger:",
            error
        );
    }
}


// ======================================================
// WEBSOCKET FRAME LOGGER
// ======================================================

function redactSensitiveWebSocketData(
    input
) {

    let text =
        String(
            input ||
            ""
        );


    /*
     * Evita jogar credenciais no PowerShell.
     */
    text = text.replace(
        /(\"?(?:token|accessToken|access_token|authorization|password|secret)\"?\s*[:=]\s*\")([^\"]+)(\")/gi,
        "$1<REDACTED>$3"
    );


    text = text.replace(
        /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
        "Bearer <REDACTED>"
    );


    return text;
}


function isInterestingWebSocketPayload(
    payload
) {

    const value =
        String(
            payload ||
            ""
        )
            .toLowerCase();


    return (
        value.includes(
            "role"
        ) ||
        value.includes(
            "member"
        ) ||
        value.includes(
            "user"
        ) ||
        value.includes(
            "permission"
        ) ||
        value.includes(
            "publicsettings"
        ) ||
        value.includes(
            "banner"
        ) ||
        value.includes(
            "logo"
        )
    );
}


function attachSharkordWebSocketLogger(win) {

    if (
        !win ||
        win.isDestroyed()
    ) {

        return;
    }


    const debuggerClient =
        win.webContents.debugger;


    const subscriptionPathsById =
        new Map();


    const liveUsers =
        new Map();


    const liveRoles =
        new Map();


    let livePublicSettings =
        null;


    // ==================================================
    // SERVER BRANDING
    // ==================================================

    function compactBrandFile(
        file
    ) {

        if (
            !file ||
            typeof file !==
            "object"
        ) {

            return null;
        }


        return {

            id:
                file.id ??
                null,

            name:
                file.name ??
                null,

            originalName:
                file.originalName ??
                null,

            mimeType:
                file.mimeType ??
                null,

            extension:
                file.extension ??
                null,

            size:
                file.size ??
                null
        };
    }


    function compactPublicSettings(
        settings
    ) {

        if (
            !settings ||
            typeof settings !==
            "object"
        ) {

            return null;
        }


        return {

            name:
                settings.name ||
                null,

            serverId:
                settings.serverId ||
                null,

            logo:
                compactBrandFile(
                    settings.logo
                ),

            banner:
                compactBrandFile(
                    settings.banner
                )
        };
    }


    function sendBrandingSnapshot(
        reason
    ) {

        if (
            !win ||
            win.isDestroyed() ||
            !livePublicSettings
        ) {

            return;
        }


        win.webContents.send(
            "server-branding:server-data",
            livePublicSettings
        );


        console.log(
            "[Server Branding] dados server-side enviados:",
            {
                reason,

                name:
                livePublicSettings.name,

                logo:
                    livePublicSettings.logo
                        ?.name ||
                    null,

                banner:
                    livePublicSettings.banner
                        ?.name ||
                    null
            }
        );
    }


    function findPublicSettings(
        value,
        depth = 0
    ) {

        if (
            depth >
            12 ||
            !value ||
            typeof value !==
            "object"
        ) {

            return null;
        }


        if (
            value.publicSettings &&
            typeof value.publicSettings ===
            "object"
        ) {

            return value.publicSettings;
        }


        /*
         * Também aceita publicSettings quando
         * ele aparece diretamente como objeto,
         * sem a chave "publicSettings".
         */
        if (
            typeof value.name ===
            "string" &&

            value.serverId !=
            null &&

            (
                Object.prototype
                    .hasOwnProperty.call(
                    value,
                    "logo"
                ) ||

                Object.prototype
                    .hasOwnProperty.call(
                    value,
                    "banner"
                )
            )
        ) {

            return value;
        }


        const children =
            Array.isArray(
                value
            )
                ? value
                : Object.values(
                    value
                );


        for (
            const child
            of children
            ) {

            const found =
                findPublicSettings(
                    child,
                    depth +
                    1
                );


            if (
                found
            ) {

                return found;
            }
        }


        return null;
    }


    function updatePublicSettings(
        value,
        reason
    ) {

        const found =
            findPublicSettings(
                value
            );


        if (
            !found
        ) {

            return false;
        }


        const compact =
            compactPublicSettings(
                found
            );


        if (
            !compact
        ) {

            return false;
        }


        const nextSignature =
            JSON.stringify(
                compact
            );


        const previousSignature =
            JSON.stringify(
                livePublicSettings
            );


        /*
         * Evita mandar a mesma informação
         * repetidamente para o preload.
         */
        if (
            nextSignature ===
            previousSignature
        ) {

            return true;
        }


        livePublicSettings =
            compact;


        /*
         * Mantém apenas os metadados do branding no server.json.
         * A imagem continua server-side; salvamos somente nome/filename
         * para que a tela "Último servidor" consiga montar /public/<arquivo>.
         */
        try {

            const currentUrl =
                win.webContents
                    .getURL();


            if (
                currentUrl
            ) {

                saveServerBrandingSnapshot(
                    currentUrl,
                    compact
                );
            }

        } catch (error) {

            console.warn(
                "[Server Branding] não foi possível salvar snapshot para o launcher:",
                error?.message ||
                error
            );
        }


        sendBrandingSnapshot(
            reason
        );


        return true;
    }


    // ==================================================
    // MEMBER ROLES
    // ==================================================

    function compactUser(
        user
    ) {

        if (
            !user ||
            user.id ==
            null
        ) {

            return null;
        }


        return {

            id:
            user.id,

            name:
            user.name,

            roleIds:
                Array.isArray(
                    user.roleIds
                )
                    ? user.roleIds
                    : []
        };
    }


    function compactRole(
        role
    ) {

        if (
            !role ||
            role.id ==
            null
        ) {

            return null;
        }


        return {

            id:
            role.id,

            name:
            role.name,

            color:
                role.color ||
                null,

            isDefault:
                Boolean(
                    role.isDefault
                )
        };
    }


    function sendSnapshot(
        reason
    ) {

        if (
            !win ||
            win.isDestroyed()
        ) {

            return;
        }


        const compactData = {

            users:
                Array
                    .from(
                        liveUsers.values()
                    )
                    .filter(
                        user =>
                            user &&
                            user.name !==
                            "__deleted_user__"
                    ),

            roles:
                Array.from(
                    liveRoles.values()
                )
        };


        win.webContents.send(
            "member-roles:server-data",
            compactData
        );


        console.log(
            "[Member Roles] dados enviados ao preload:",
            {
                reason,

                users:
                compactData.users.length,

                roles:
                compactData.roles.length
            }
        );
    }


    function findServerData(
        value,
        depth = 0
    ) {

        if (
            depth >
            10 ||
            !value ||
            typeof value !==
            "object"
        ) {

            return null;
        }


        if (
            Array.isArray(
                value.users
            ) &&
            Array.isArray(
                value.roles
            )
        ) {

            return value;
        }


        const children =
            Array.isArray(
                value
            )
                ? value
                : Object.values(
                    value
                );


        for (
            const child
            of children
            ) {

            const found =
                findServerData(
                    child,
                    depth +
                    1
                );


            if (
                found
            ) {

                return found;
            }
        }


        return null;
    }


    function replaceInitialState(
        serverData
    ) {

        liveUsers.clear();


        liveRoles.clear();


        for (
            const rawUser
            of serverData.users ||
        []
            ) {

            const user =
                compactUser(
                    rawUser
                );


            if (
                user &&
                user.name !==
                "__deleted_user__"
            ) {

                liveUsers.set(
                    Number(
                        user.id
                    ),
                    user
                );
            }
        }


        for (
            const rawRole
            of serverData.roles ||
        []
            ) {

            const role =
                compactRole(
                    rawRole
                );


            if (
                role
            ) {

                liveRoles.set(
                    Number(
                        role.id
                    ),
                    role
                );
            }
        }


        sendSnapshot(
            "initial-state"
        );
    }


    // ==================================================
    // SUBSCRIPTIONS
    // ==================================================

    function learnSubscriptions(
        parsed
    ) {

        const list =
            Array.isArray(
                parsed
            )
                ? parsed
                : [
                    parsed
                ];


        for (
            const item
            of list
            ) {

            if (
                item?.method ===
                "subscription" &&

                item?.id !=
                null &&

                item?.params?.path
            ) {

                subscriptionPathsById.set(
                    Number(
                        item.id
                    ),

                    String(
                        item.params.path
                    )
                );
            }
        }
    }


    function unwrapData(
        message
    ) {

        return (
            message?.result?.data ??
            message?.result ??
            message?.data ??
            null
        );
    }


    function findEntity(
        value,
        depth = 0
    ) {

        if (
            depth >
            8 ||
            value ==
            null
        ) {

            return null;
        }


        if (
            typeof value ===
            "number" ||
            typeof value ===
            "string"
        ) {

            return {
                id:
                value
            };
        }


        if (
            typeof value !==
            "object"
        ) {

            return null;
        }


        if (
            value.id !=
            null
        ) {

            return value;
        }


        for (
            const key
            of [
            "user",
            "member",
            "role",
            "data"
        ]
            ) {

            if (
                value[
                    key
                    ] !==
                undefined
            ) {

                const found =
                    findEntity(
                        value[
                            key
                            ],
                        depth +
                        1
                    );


                if (
                    found
                ) {

                    return found;
                }
            }
        }


        const children =
            Array.isArray(
                value
            )
                ? value
                : Object.values(
                    value
                );


        for (
            const child
            of children
            ) {

            const found =
                findEntity(
                    child,
                    depth +
                    1
                );


            if (
                found
            ) {

                return found;
            }
        }


        return null;
    }


    function applyLiveMessage(
        message
    ) {

        if (
            !message ||
            message.id ==
            null
        ) {

            return false;
        }


        const path =
            subscriptionPathsById.get(
                Number(
                    message.id
                )
            );


        if (
            !path
        ) {

            return false;
        }


        const raw =
            findEntity(
                unwrapData(
                    message
                )
            );


        if (
            !raw ||
            raw.id ==
            null
        ) {

            return false;
        }


        // ==============================================
        // USERS
        // ==============================================

        if (
            [
                "users.onUpdate",
                "users.onCreate",
                "users.onJoin"
            ].includes(
                path
            )
        ) {

            const previous =
                liveUsers.get(
                    Number(
                        raw.id
                    )
                ) ||
                {};


            const user =
                compactUser({
                    ...previous,
                    ...raw
                });


            if (
                !user
            ) {

                return false;
            }


            liveUsers.set(
                Number(
                    user.id
                ),
                user
            );


            sendSnapshot(
                path
            );


            return true;
        }


        if (
            [
                "users.onDelete",
                "users.onLeave"
            ].includes(
                path
            )
        ) {

            liveUsers.delete(
                Number(
                    raw.id
                )
            );


            sendSnapshot(
                path
            );


            return true;
        }


        // ==============================================
        // ROLES
        // ==============================================

        if (
            [
                "roles.onUpdate",
                "roles.onCreate"
            ].includes(
                path
            )
        ) {

            const previous =
                liveRoles.get(
                    Number(
                        raw.id
                    )
                ) ||
                {};


            const role =
                compactRole({
                    ...previous,
                    ...raw
                });


            if (
                !role
            ) {

                return false;
            }


            liveRoles.set(
                Number(
                    role.id
                ),
                role
            );


            sendSnapshot(
                path
            );


            return true;
        }


        if (
            path ===
            "roles.onDelete"
        ) {

            const deletedId =
                Number(
                    raw.id
                );


            liveRoles.delete(
                deletedId
            );


            for (
                const [
                    id,
                    user
                ]
                of liveUsers
                ) {

                liveUsers.set(
                    id,
                    {
                        ...user,

                        roleIds:
                            (
                                user.roleIds ||
                                []
                            ).filter(
                                roleId =>
                                    Number(
                                        roleId
                                    ) !==
                                    deletedId
                            )
                    }
                );
            }


            sendSnapshot(
                path
            );


            return true;
        }


        return false;
    }


    // ==================================================
    // DEBUGGER / WEBSOCKET
    // ==================================================

    try {

        if (
            !debuggerClient
                .isAttached()
        ) {

            debuggerClient.attach(
                "1.3"
            );
        }


        debuggerClient
            .sendCommand(
                "Network.enable"
            )
            .catch(
                error => {

                    console.error(
                        "[Sharkord WS] erro habilitando Network:",
                        error
                    );
                }
            );


        debuggerClient.on(
            "message",
            (
                _event,
                method,
                params
            ) => {

                const received =
                    method ===
                    "Network.webSocketFrameReceived";


                const sent =
                    method ===
                    "Network.webSocketFrameSent";


                if (
                    !received &&
                    !sent
                ) {

                    return;
                }


                const frame =
                    params
                        ?.response;


                if (
                    !frame ||
                    Number(
                        frame.opcode
                    ) !==
                    1
                ) {

                    return;
                }


                const payload =
                    String(
                        frame.payloadData ||
                        ""
                    );


                try {

                    const parsed =
                        JSON.parse(
                            payload
                        );


                    if (
                        sent
                    ) {

                        learnSubscriptions(
                            parsed
                        );
                    }


                    if (
                        received
                    ) {

                        const list =
                            Array.isArray(
                                parsed
                            )
                                ? parsed
                                : [
                                    parsed
                                ];


                        for (
                            const message
                            of list
                            ) {

                            /*
                             * Primeiro tenta encontrar
                             * publicSettings.
                             *
                             * Isso alimenta:
                             *
                             * branding-preload.js
                             */
                            updatePublicSettings(
                                message,
                                "websocket"
                            );


                            /*
                             * Depois mantém a lógica
                             * existente de usuários/roles.
                             */
                            const serverData =
                                findServerData(
                                    message
                                );


                            if (
                                serverData
                            ) {

                                replaceInitialState(
                                    serverData
                                );

                            } else {

                                applyLiveMessage(
                                    message
                                );
                            }
                        }
                    }

                } catch {}


                if (
                    !isInterestingWebSocketPayload(
                        payload
                    )
                ) {

                    return;
                }


                const safePayload =
                    redactSensitiveWebSocketData(
                        payload
                    );


                const MAX_LOG_LENGTH =
                    20000;


                const output =
                    safePayload.length >
                    MAX_LOG_LENGTH
                        ? (
                            safePayload.slice(
                                0,
                                MAX_LOG_LENGTH
                            ) +
                            " ... <TRUNCATED>"
                        )
                        : safePayload;


                console.log(
                    received
                        ? "[Sharkord WS RECEIVED]"
                        : "[Sharkord WS SENT]",
                    output
                );
            }
        );


        debuggerClient.on(
            "detach",
            (
                _event,
                reason
            ) => {

                console.log(
                    "[Sharkord WS] debugger desconectado:",
                    reason
                );
            }
        );


        console.log(
            "[Sharkord WS] logger de frames ativado."
        );

    } catch (error) {

        console.error(
            "[Sharkord WS] erro ativando logger:",
            error
        );
    }
}


// ======================================================
// BRANDING PRELOAD
// ======================================================

function registerBrandingPreload() {

    const brandingPreloadPath =
        path.join(
            __dirname,
            "branding-preload.js"
        );


    if (
        !fs.existsSync(
            brandingPreloadPath
        )
    ) {

        console.warn(
            "[Server Branding] branding-preload.js não encontrado:",
            brandingPreloadPath
        );


        return;
    }


    try {

        session.defaultSession
            .registerPreloadScript({
                type:
                    "frame",

                id:
                    "sharkord-server-branding",

                filePath:
                brandingPreloadPath
            });


        console.log(
            "[Server Branding] preload registrado."
        );

    } catch (error) {

        console.error(
            "[Server Branding] erro registrando preload:",
            error
        );
    }
}


// ======================================================
// MEMBER ROLES PRELOAD
// ======================================================

function registerMemberRolesPreload() {

    const memberRolesPreloadPath =
        path.join(
            __dirname,
            "member-roles-preload.js"
        );


    if (
        !fs.existsSync(
            memberRolesPreloadPath
        )
    ) {

        console.warn(
            "[Member Roles] member-roles-preload.js não encontrado:",
            memberRolesPreloadPath
        );


        return;
    }


    try {

        session.defaultSession
            .registerPreloadScript({
                type:
                    "frame",

                id:
                    "sharkord-member-roles",

                filePath:
                memberRolesPreloadPath
            });


        console.log(
            "[Member Roles] preload registrado."
        );

    } catch (error) {

        console.error(
            "[Member Roles] erro registrando preload:",
            error
        );
    }
}


// ======================================================
// UPDATER UI PRELOAD
// ======================================================

function registerUpdaterPreload() {

    const updaterPreloadPath =
        path.join(
            __dirname,
            "updater-preload.js"
        );


    if (
        !fs.existsSync(
            updaterPreloadPath
        )
    ) {

        console.warn(
            "[Updater UI] updater-preload.js não encontrado:",
            updaterPreloadPath
        );


        return;
    }


    try {

        session.defaultSession
            .registerPreloadScript({
                type:
                    "frame",

                id:
                    "sharkord-updater-ui",

                filePath:
                updaterPreloadPath
            });


        console.log(
            "[Updater UI] preload registrado."
        );

    } catch (error) {

        console.error(
            "[Updater UI] erro registrando preload:",
            error
        );
    }
}


// ======================================================
// ELECTRON READY
// ======================================================

app.whenReady().then(
    () => {

        if (
            process.platform ===
            "win32"
        ) {

            app.setAppUserModelId(
                "com.sharkord.desktop"
            );
        }


        registerBrandingPreload();


        registerMemberRolesPreload();


        registerUpdaterPreload();


        configureSharkordApiLogger();


        configureDisplayMediaHandler();


        createServerWindow();


        /*
         * Só funciona de verdade quando o
         * aplicativo está empacotado/instalado.
         */
        configureAutoUpdater();


        app.on(
            "activate",
            () => {

                if (
                    BrowserWindow
                        .getAllWindows()
                        .length ===
                    0
                ) {

                    createServerWindow();
                }
            }
        );
    }
);


// ======================================================
// SAÍDA
// ======================================================

app.on(
    "will-quit",
    () => {

        stopProcessAudio();
    }
);


app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !==
            "darwin"
        ) {

            app.quit();
        }
    }
);
