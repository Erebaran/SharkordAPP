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


// ======================================================
// MAIN WORLD
// ======================================================

contextBridge.executeInMainWorld({

    func: () => {

        // ==================================================
        // VERIFICAÇÕES
        // ==================================================

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getDisplayMedia
        ) {

            console.error(
                "[ScreenShare] getDisplayMedia não encontrado."
            );

            return;
        }


        if (
            Reflect.get(
                window,
                "__sharkordScreenSharePatched"
            )
        ) {
            return;
        }


        Reflect.set(
            window,
            "__sharkordScreenSharePatched",
            true
        );


        const electronScreenShare =
            Reflect.get(
                window,
                "electronScreenShare"
            );


        const electronProcessAudio =
            Reflect.get(
                window,
                "electronProcessAudio"
            );


        if (
            !electronScreenShare ||
            !electronProcessAudio
        ) {

            console.error(
                "[ScreenShare] APIs Electron não encontradas."
            );

            return;
        }


        const originalGetDisplayMedia =
            navigator.mediaDevices
                .getDisplayMedia
                .bind(
                    navigator.mediaDevices
                );


        // ==================================================
        // CONSTANTES
        // ==================================================

        const VOICE_PANEL_SWITCH_BUTTON_ID =
            "__sharkord_voice_panel_switch_button";


        const CALL_BAR_SWITCH_BUTTON_ID =
            "__sharkord_call_bar_switch_button";


        const REOPEN_COOLDOWN_MS =
            1500;


        const FIRST_FRAME_TIMEOUT_MS =
            450;


        // ==================================================
        // ESTADO
        // ==================================================

        let currentSession =
            null;


        /*
         * Impede que MutationObserver/watchdog reinstalem o botão
         * "Trocar tela" durante/depois do encerramento da transmissão.
         *
         * Só volta para false quando uma NOVA sessão de screen share
         * é criada com sucesso.
         */
        let screenShareUiStopped =
            false;


        let switching =
            false;


        let observer =
            null;


        let observerStartTimer =
            null;


        let buttonSearchTimer =
            null;


        let explicitStopTimer =
            null;


        let uiCleanupTimer =
            null;


        let lastExplicitStopAt =
            0;


        let nextPeerConnectionId =
            1;


        const boundScreenShareButtons =
            new WeakSet();


        const instrumentedPeerConnections =
            new WeakSet();


        const peerConnectionIds =
            new WeakMap();


        const lastPeerSnapshots =
            new WeakMap();


        const lastHealthyPeerSnapshots =
            new WeakMap();


        const peerStatsTimers =
            new WeakMap();


        // ==================================================
        // HELPERS
        // ==================================================

        function delay(
            ms
        ) {

            return new Promise(
                resolve => {

                    setTimeout(
                        resolve,
                        ms
                    );
                }
            );
        }


        function nextAnimationFrame() {

            return new Promise(
                resolve => {

                    requestAnimationFrame(
                        resolve
                    );
                }
            );
        }


        function safeJson(
            value
        ) {

            try {

                return JSON.stringify(
                    value,
                    (_key, item) => {

                        if (
                            typeof item ===
                            "bigint"
                        ) {

                            return String(
                                item
                            );
                        }


                        if (
                            item instanceof Error
                        ) {

                            return {
                                name:
                                item.name,

                                message:
                                item.message,

                                stack:
                                item.stack
                            };
                        }


                        return item;
                    }
                );

            } catch {

                try {

                    return String(
                        value
                    );

                } catch {

                    return "[unserializable]";
                }
            }
        }


        function logData(
            prefix,
            data
        ) {

            console.log(
                `${prefix} ${safeJson(data)}`
            );
        }


        function warnData(
            prefix,
            data
        ) {

            console.warn(
                `${prefix} ${safeJson(data)}`
            );
        }


        function errorData(
            prefix,
            data
        ) {

            console.error(
                `${prefix} ${safeJson(data)}`
            );
        }


        // ==================================================
        // ÍCONE
        // ==================================================

        const SWITCH_ICON = `
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <rect
                    x="3"
                    y="5"
                    width="13"
                    height="9"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.8"
                />

                <path
                    d="M7 18H12"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M9.5 14V18"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <rect
                    x="12"
                    y="9"
                    width="9"
                    height="7"
                    rx="1.2"
                    fill="currentColor"
                    fill-opacity="0.12"
                    stroke="currentColor"
                    stroke-width="1.8"
                />

                <path
                    d="M14.5 12.5H18"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                />

                <path
                    d="M16.5 10.8L18.3 12.5L16.5 14.2"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        `;


        // ==================================================
        // DOM
        // ==================================================

        function normalizeText(
            value
        ) {

            return String(
                value || ""
            )
                .toLowerCase()
                .normalize(
                    "NFD"
                )
                .replace(
                    /[\u0300-\u036f]/g,
                    ""
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();
        }


        function getElementDescription(
            element
        ) {

            if (!element) {
                return "";
            }


            return normalizeText(
                [
                    element.textContent,

                    element.getAttribute?.(
                        "aria-label"
                    ),

                    element.getAttribute?.(
                        "title"
                    ),

                    element.getAttribute?.(
                        "data-tooltip-content"
                    )
                ]
                    .filter(Boolean)
                    .join(" ")
            );
        }


        function isElementVisible(
            element
        ) {

            if (!element) {
                return false;
            }


            const rect =
                element.getBoundingClientRect();


            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {
                return false;
            }


            const style =
                getComputedStyle(
                    element
                );


            return (
                style.display !==
                "none" &&
                style.visibility !==
                "hidden"
            );
        }


        function parseRgb(
            value
        ) {

            const match =
                String(
                    value || ""
                ).match(
                    /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/
                );


            if (!match) {
                return null;
            }


            return {
                r:
                    Number(
                        match[1]
                    ),

                g:
                    Number(
                        match[2]
                    ),

                b:
                    Number(
                        match[3]
                    )
            };
        }


        function getBackgroundRgb(
            element
        ) {

            try {

                return parseRgb(
                    getComputedStyle(
                        element
                    ).backgroundColor
                );

            } catch {

                return null;
            }
        }


        function looksRed(
            element
        ) {

            const rgb =
                getBackgroundRgb(
                    element
                );


            if (!rgb) {
                return false;
            }


            return (
                rgb.r >= 150 &&
                rgb.r >
                rgb.g * 1.35 &&
                rgb.r >
                rgb.b * 1.20
            );
        }


        function isOurButton(
            element
        ) {

            if (!element) {
                return false;
            }


            return (
                element.id ===
                VOICE_PANEL_SWITCH_BUTTON_ID ||
                element.id ===
                CALL_BAR_SWITCH_BUTTON_ID
            );
        }


        // ==================================================
        // BOTÃO VERMELHO DA CALL BAR
        // ==================================================

        function findCallBarDisconnectButton() {

            const candidates =
                Array.from(
                    document.querySelectorAll(
                        "button, [role='button']"
                    )
                );


            let winner =
                null;


            let winnerScore =
                -1;


            for (
                const element
                of candidates
                ) {

                if (
                    isOurButton(
                        element
                    ) ||
                    !isElementVisible(
                        element
                    )
                ) {
                    continue;
                }


                const rect =
                    element.getBoundingClientRect();


                if (
                    rect.width < 30 ||
                    rect.height < 30 ||
                    rect.bottom <
                    window.innerHeight *
                    0.50
                ) {
                    continue;
                }


                const description =
                    getElementDescription(
                        element
                    );


                let score =
                    0;


                if (
                    looksRed(
                        element
                    )
                ) {

                    score +=
                        200;
                }


                const terms = [
                    "disconnect",
                    "leave",
                    "hang up",
                    "end call",

                    "desconectar",
                    "sair",
                    "encerrar chamada"
                ];


                if (
                    terms.some(
                        term =>
                            description.includes(
                                term
                            )
                    )
                ) {

                    score +=
                        120;
                }


                score +=
                    rect.top /
                    window.innerHeight *
                    30;


                if (
                    score >
                    winnerScore
                ) {

                    winner =
                        element;


                    winnerScore =
                        score;
                }
            }


            return winnerScore >=
            100
                ? winner
                : null;
        }


        // ==================================================
        // BOTÃO NATIVO DE SCREEN SHARE NA CALL BAR
        // ==================================================

        function findActiveScreenShareButton() {

            const disconnectButton =
                findCallBarDisconnectButton();


            if (!disconnectButton) {
                return null;
            }


            let root =
                disconnectButton.parentElement;


            for (
                let depth = 0;
                root && depth < 7;
                depth++
            ) {

                const buttons =
                    Array.from(
                        root.querySelectorAll(
                            "button, [role='button']"
                        )
                    )
                        .filter(
                            button =>
                                !isOurButton(
                                    button
                                ) &&
                                isElementVisible(
                                    button
                                )
                        )
                        .map(
                            button => ({
                                button,

                                rect:
                                    button
                                        .getBoundingClientRect()
                            })
                        )
                        .sort(
                            (a, b) =>
                                a.rect.left -
                                b.rect.left
                        );


                const disconnectIndex =
                    buttons.findIndex(
                        item =>
                            item.button ===
                            disconnectButton
                    );


                if (
                    disconnectIndex >
                    0
                ) {

                    return buttons[
                    disconnectIndex -
                    1
                        ].button;
                }


                root =
                    root.parentElement;
            }


            return null;
        }


        // ==================================================
        // VOICE CONNECTED CARD
        // ==================================================

        function findVoiceConnectedCard() {

            const elements =
                Array.from(
                    document.querySelectorAll(
                        "div, section, aside"
                    )
                );


            let best =
                null;


            let bestScore =
                -Infinity;


            for (
                const element
                of elements
                ) {

                if (
                    !isElementVisible(
                        element
                    )
                ) {
                    continue;
                }


                const description =
                    normalizeText(
                        element.textContent
                    );


                if (
                    !description.includes(
                        "voice connected"
                    ) &&
                    !description.includes(
                        "voz conectada"
                    ) &&
                    !description.includes(
                        "conectado a voz"
                    )
                ) {
                    continue;
                }


                const rect =
                    element
                        .getBoundingClientRect();


                if (
                    rect.width >
                    700 ||
                    rect.height >
                    260
                ) {
                    continue;
                }


                const buttons =
                    Array.from(
                        element.querySelectorAll(
                            "button, [role='button']"
                        )
                    ).filter(
                        button =>
                            !isOurButton(
                                button
                            ) &&
                            isElementVisible(
                                button
                            )
                    );


                let score =
                    100;


                if (
                    buttons.length >=
                    2
                ) {

                    score +=
                        50;
                }


                if (
                    description.includes(
                        "disconnect"
                    ) ||
                    description.includes(
                        "desconectar"
                    )
                ) {

                    score +=
                        40;
                }


                score -=
                    rect.width /
                    30;


                score -=
                    rect.height /
                    20;


                if (
                    score >
                    bestScore
                ) {

                    best =
                        element;


                    bestScore =
                        score;
                }
            }


            return best;
        }


        function findVoicePanelStopShareButton() {

            const card =
                findVoiceConnectedCard();


            if (!card) {
                return null;
            }


            const buttons =
                Array.from(
                    card.querySelectorAll(
                        "button, [role='button']"
                    )
                )
                    .filter(
                        button =>
                            !isOurButton(
                                button
                            ) &&
                            isElementVisible(
                                button
                            )
                    )
                    .map(
                        button => ({
                            button,

                            rect:
                                button
                                    .getBoundingClientRect()
                        })
                    );


            const smallButtons =
                buttons
                    .filter(
                        item =>
                            item.rect.width <=
                            60 &&
                            item.rect.height <=
                            60
                    )
                    .sort(
                        (a, b) =>
                            a.rect.left -
                            b.rect.left
                    );


            if (
                smallButtons.length ===
                0
            ) {
                return null;
            }


            /*
             * No Voice connected:
             *
             * [Disconnect]      [câmera] [PARAR]
             *
             * O mais à direita dos pequenos é o parar.
             */
            return smallButtons
                    .at(-1)
                    ?.button ||
                null;
        }


        // ==================================================
        // WEBRTC
        // ==================================================

        function getPeerConnectionId(
            peerConnection
        ) {

            let id =
                peerConnectionIds.get(
                    peerConnection
                );


            if (id) {
                return id;
            }


            id =
                nextPeerConnectionId++;


            peerConnectionIds.set(
                peerConnection,
                id
            );


            return id;
        }


        function simplifyCandidate(
            candidate
        ) {

            if (!candidate) {
                return null;
            }


            return {
                id:
                candidate.id,

                candidateType:
                candidate.candidateType,

                protocol:
                candidate.protocol,

                address:
                candidate.address,

                ip:
                candidate.ip,

                port:
                candidate.port,

                networkType:
                candidate.networkType,

                relayProtocol:
                candidate.relayProtocol,

                tcpType:
                candidate.tcpType,

                priority:
                candidate.priority,

                foundation:
                candidate.foundation
            };
        }


        function simplifyCandidatePair(
            pair,
            reports
        ) {

            return {
                id:
                pair.id,

                state:
                pair.state,

                nominated:
                pair.nominated,

                writable:
                pair.writable,

                bytesSent:
                pair.bytesSent,

                bytesReceived:
                pair.bytesReceived,

                packetsSent:
                pair.packetsSent,

                packetsReceived:
                pair.packetsReceived,

                requestsSent:
                pair.requestsSent,

                requestsReceived:
                pair.requestsReceived,

                responsesSent:
                pair.responsesSent,

                responsesReceived:
                pair.responsesReceived,

                consentRequestsSent:
                pair.consentRequestsSent,

                currentRoundTripTime:
                pair.currentRoundTripTime,

                totalRoundTripTime:
                pair.totalRoundTripTime,

                availableOutgoingBitrate:
                pair.availableOutgoingBitrate,

                availableIncomingBitrate:
                pair.availableIncomingBitrate,

                local:
                    simplifyCandidate(
                        reports.get(
                            pair.localCandidateId
                        )
                    ),

                remote:
                    simplifyCandidate(
                        reports.get(
                            pair.remoteCandidateId
                        )
                    )
            };
        }


        async function collectPeerSnapshot(
            peerConnection
        ) {

            const stats =
                await peerConnection.getStats();


            const reports =
                new Map();


            stats.forEach(
                report => {

                    reports.set(
                        report.id,
                        report
                    );
                }
            );


            const candidatePairs =
                [];


            const localCandidates =
                [];


            const remoteCandidates =
                [];


            const transports =
                [];


            const outboundVideo =
                [];


            for (
                const report
                of reports.values()
                ) {

                if (
                    report.type ===
                    "candidate-pair"
                ) {

                    candidatePairs.push(
                        simplifyCandidatePair(
                            report,
                            reports
                        )
                    );


                    continue;
                }


                if (
                    report.type ===
                    "local-candidate"
                ) {

                    localCandidates.push(
                        simplifyCandidate(
                            report
                        )
                    );


                    continue;
                }


                if (
                    report.type ===
                    "remote-candidate"
                ) {

                    remoteCandidates.push(
                        simplifyCandidate(
                            report
                        )
                    );


                    continue;
                }


                if (
                    report.type ===
                    "transport"
                ) {

                    transports.push({
                        id:
                        report.id,

                        bytesSent:
                        report.bytesSent,

                        bytesReceived:
                        report.bytesReceived,

                        packetsSent:
                        report.packetsSent,

                        packetsReceived:
                        report.packetsReceived,

                        dtlsState:
                        report.dtlsState,

                        iceRole:
                        report.iceRole,

                        selectedCandidatePairId:
                        report
                            .selectedCandidatePairId
                    });


                    continue;
                }


                if (
                    report.type ===
                    "outbound-rtp" &&
                    (
                        report.kind ===
                        "video" ||
                        report.mediaType ===
                        "video"
                    )
                ) {

                    outboundVideo.push({
                        id:
                        report.id,

                        ssrc:
                        report.ssrc,

                        rid:
                        report.rid,

                        active:
                        report.active,

                        bytesSent:
                        report.bytesSent,

                        packetsSent:
                        report.packetsSent,

                        framesEncoded:
                        report.framesEncoded,

                        framesSent:
                        report.framesSent,

                        keyFramesEncoded:
                        report.keyFramesEncoded,

                        frameWidth:
                        report.frameWidth,

                        frameHeight:
                        report.frameHeight,

                        framesPerSecond:
                        report.framesPerSecond,

                        qualityLimitationReason:
                        report
                            .qualityLimitationReason,

                        encoderImplementation:
                        report
                            .encoderImplementation
                    });
                }
            }


            candidatePairs.sort(
                (a, b) => {

                    const order = {
                        succeeded:
                            0,

                        "in-progress":
                            1,

                        waiting:
                            2,

                        frozen:
                            3,

                        failed:
                            4
                    };


                    return (
                        (
                            order[
                                a.state
                                ] ??
                            99
                        ) -
                        (
                            order[
                                b.state
                                ] ??
                            99
                        )
                    );
                }
            );


            let selectedPair =
                null;


            for (
                const transport
                of transports
                ) {

                if (
                    !transport
                        .selectedCandidatePairId
                ) {
                    continue;
                }


                selectedPair =
                    candidatePairs.find(
                        pair =>
                            pair.id ===
                            transport
                                .selectedCandidatePairId
                    ) ||
                    null;


                if (selectedPair) {
                    break;
                }
            }


            if (!selectedPair) {

                selectedPair =
                    candidatePairs.find(
                        pair =>
                            pair.nominated &&
                            pair.state ===
                            "succeeded"
                    ) ||
                    null;
            }


            return {
                timestamp:
                    Date.now(),

                connectionState:
                peerConnection
                    .connectionState,

                iceConnectionState:
                peerConnection
                    .iceConnectionState,

                iceGatheringState:
                peerConnection
                    .iceGatheringState,

                signalingState:
                peerConnection
                    .signalingState,

                selectedPair,

                candidatePairs,

                localCandidates,

                remoteCandidates,

                transports,

                outboundVideo
            };
        }


        async function capturePeerSnapshot(
            peerConnection,
            reason,
            logToConsole =
            true
        ) {

            const id =
                getPeerConnectionId(
                    peerConnection
                );


            try {

                const snapshot =
                    await collectPeerSnapshot(
                        peerConnection
                    );


                lastPeerSnapshots.set(
                    peerConnection,
                    snapshot
                );


                const healthy =
                    snapshot.connectionState ===
                    "connected" ||
                    snapshot.iceConnectionState ===
                    "connected" ||
                    snapshot.iceConnectionState ===
                    "completed";


                if (healthy) {

                    lastHealthyPeerSnapshots.set(
                        peerConnection,
                        snapshot
                    );
                }


                if (
                    logToConsole
                ) {

                    logData(
                        `[WebRTC PC#${id}] SNAPSHOT`,
                        {
                            reason,
                            ...snapshot
                        }
                    );
                }


                return snapshot;

            } catch (caughtError) {

                warnData(
                    `[WebRTC PC#${id}] SNAPSHOT FALHOU`,
                    {
                        reason,

                        error:
                        caughtError,

                        connectionState:
                        peerConnection
                            .connectionState,

                        iceConnectionState:
                        peerConnection
                            .iceConnectionState
                    }
                );


                return null;
            }
        }


        function dumpStoredSnapshots(
            peerConnection,
            reason
        ) {

            const id =
                getPeerConnectionId(
                    peerConnection
                );


            const last =
                lastPeerSnapshots.get(
                    peerConnection
                );


            const healthy =
                lastHealthyPeerSnapshots.get(
                    peerConnection
                );


            if (last) {

                warnData(
                    `[WebRTC PC#${id}] ÚLTIMO SNAPSHOT ANTES DA QUEDA`,
                    {
                        reason,

                        ageMs:
                            Date.now() -
                            last.timestamp,

                        ...last
                    }
                );

            } else {

                console.warn(
                    `[WebRTC PC#${id}] nenhum snapshot prévio disponível. ${reason}`
                );
            }


            if (healthy) {

                warnData(
                    `[WebRTC PC#${id}] ÚLTIMO SNAPSHOT SAUDÁVEL`,
                    {
                        reason,

                        ageMs:
                            Date.now() -
                            healthy.timestamp,

                        ...healthy
                    }
                );

            } else {

                console.warn(
                    `[WebRTC PC#${id}] conexão nunca chegou a estado saudável. ${reason}`
                );
            }
        }


        function stopPeerStatsTimer(
            peerConnection
        ) {

            const timer =
                peerStatsTimers.get(
                    peerConnection
                );


            if (!timer) {
                return;
            }


            clearInterval(
                timer
            );


            peerStatsTimers.delete(
                peerConnection
            );
        }


        function startPeerStatsTimer(
            peerConnection
        ) {

            if (
                peerStatsTimers.has(
                    peerConnection
                )
            ) {
                return;
            }


            const timer =
                setInterval(
                    () => {

                        if (
                            peerConnection
                                .connectionState ===
                            "closed"
                        ) {

                            stopPeerStatsTimer(
                                peerConnection
                            );


                            return;
                        }


                        void capturePeerSnapshot(
                            peerConnection,
                            "periodic-preconnect",
                            false
                        );

                    },
                    400
                );


            peerStatsTimers.set(
                peerConnection,
                timer
            );
        }


        function instrumentPeerConnection(
            peerConnection
        ) {

            if (
                !peerConnection ||
                instrumentedPeerConnections.has(
                    peerConnection
                )
            ) {
                return;
            }


            instrumentedPeerConnections.add(
                peerConnection
            );


            const id =
                getPeerConnectionId(
                    peerConnection
                );


            let previousConnectionState =
                peerConnection
                    .connectionState;


            let previousIceState =
                peerConnection
                    .iceConnectionState;


            let previousGatheringState =
                peerConnection
                    .iceGatheringState;


            let previousSignalingState =
                peerConnection
                    .signalingState;


            logData(
                `[WebRTC PC#${id}] INSTRUMENTADO`,
                {
                    connectionState:
                    previousConnectionState,

                    iceConnectionState:
                    previousIceState,

                    iceGatheringState:
                    previousGatheringState,

                    signalingState:
                    previousSignalingState
                }
            );


            startPeerStatsTimer(
                peerConnection
            );


            void capturePeerSnapshot(
                peerConnection,
                "instrumentado",
                false
            );


            peerConnection.addEventListener(
                "connectionstatechange",
                () => {

                    const state =
                        peerConnection
                            .connectionState;


                    console.log(
                        `[WebRTC PC#${id}] CONNECTION: ${previousConnectionState} -> ${state}`
                    );


                    previousConnectionState =
                        state;


                    void capturePeerSnapshot(
                        peerConnection,
                        `connectionState=${state}`,
                        true
                    );


                    if (
                        state ===
                        "failed" ||
                        state ===
                        "closed"
                    ) {

                        dumpStoredSnapshots(
                            peerConnection,
                            `connectionState=${state}`
                        );
                    }


                    if (
                        state ===
                        "closed"
                    ) {

                        stopPeerStatsTimer(
                            peerConnection
                        );
                    }
                }
            );


            peerConnection.addEventListener(
                "iceconnectionstatechange",
                () => {

                    const state =
                        peerConnection
                            .iceConnectionState;


                    console.log(
                        `[WebRTC PC#${id}] ICE: ${previousIceState} -> ${state}`
                    );


                    previousIceState =
                        state;


                    void capturePeerSnapshot(
                        peerConnection,
                        `ice=${state}`,
                        true
                    );


                    if (
                        state ===
                        "failed" ||
                        state ===
                        "disconnected"
                    ) {

                        dumpStoredSnapshots(
                            peerConnection,
                            `ice=${state}`
                        );
                    }
                }
            );


            peerConnection.addEventListener(
                "icegatheringstatechange",
                () => {

                    const state =
                        peerConnection
                            .iceGatheringState;


                    console.log(
                        `[WebRTC PC#${id}] ICE GATHERING: ${previousGatheringState} -> ${state}`
                    );


                    previousGatheringState =
                        state;


                    void capturePeerSnapshot(
                        peerConnection,
                        `iceGathering=${state}`,
                        true
                    );
                }
            );


            peerConnection.addEventListener(
                "signalingstatechange",
                () => {

                    const state =
                        peerConnection
                            .signalingState;


                    console.log(
                        `[WebRTC PC#${id}] SIGNALING: ${previousSignalingState} -> ${state}`
                    );


                    previousSignalingState =
                        state;


                    void capturePeerSnapshot(
                        peerConnection,
                        `signaling=${state}`,
                        false
                    );
                }
            );


            peerConnection.addEventListener(
                "icecandidate",
                event => {

                    const candidate =
                        event.candidate;


                    if (!candidate) {

                        console.log(
                            `[WebRTC PC#${id}] ICE candidate gathering terminou.`
                        );


                        return;
                    }


                    logData(
                        `[WebRTC PC#${id}] ICE CANDIDATE LOCAL`,
                        {
                            candidate:
                            candidate.candidate,

                            address:
                            candidate.address,

                            port:
                            candidate.port,

                            protocol:
                            candidate.protocol,

                            type:
                            candidate.type,

                            tcpType:
                            candidate.tcpType
                        }
                    );
                }
            );


            peerConnection.addEventListener(
                "icecandidateerror",
                event => {

                    errorData(
                        `[WebRTC PC#${id}] ICE CANDIDATE ERROR`,
                        {
                            url:
                            event.url,

                            address:
                            event.address,

                            port:
                            event.port,

                            errorCode:
                            event.errorCode,

                            errorText:
                            event.errorText
                        }
                    );
                }
            );
        }


        // ==================================================
        // PATCH WEBRTC
        // ==================================================

        const originalAddTrack =
            RTCPeerConnection
                .prototype
                .addTrack;


        RTCPeerConnection
            .prototype
            .addTrack =
            function (
                track,
                ...streams
            ) {

                instrumentPeerConnection(
                    this
                );


                const id =
                    getPeerConnectionId(
                        this
                    );


                logData(
                    `[WebRTC PC#${id}] addTrack`,
                    {
                        kind:
                        track?.kind,

                        id:
                        track?.id,

                        readyState:
                        track?.readyState,

                        muted:
                        track?.muted
                    }
                );


                return originalAddTrack.call(
                    this,
                    track,
                    ...streams
                );
            };


        const originalAddTransceiver =
            RTCPeerConnection
                .prototype
                .addTransceiver;


        RTCPeerConnection
            .prototype
            .addTransceiver =
            function (
                trackOrKind,
                init
            ) {

                instrumentPeerConnection(
                    this
                );


                const id =
                    getPeerConnectionId(
                        this
                    );


                logData(
                    `[WebRTC PC#${id}] addTransceiver`,
                    {
                        kind:
                            typeof trackOrKind ===
                            "string"
                                ? trackOrKind
                                : trackOrKind
                                    ?.kind,

                        trackId:
                            typeof trackOrKind ===
                            "string"
                                ? null
                                : trackOrKind
                                    ?.id,

                        direction:
                        init
                            ?.direction
                    }
                );


                return originalAddTransceiver.call(
                    this,
                    trackOrKind,
                    init
                );
            };


        const originalSetLocalDescription =
            RTCPeerConnection
                .prototype
                .setLocalDescription;


        RTCPeerConnection
            .prototype
            .setLocalDescription =
            async function (
                ...args
            ) {

                instrumentPeerConnection(
                    this
                );


                const result =
                    await originalSetLocalDescription.apply(
                        this,
                        args
                    );


                const id =
                    getPeerConnectionId(
                        this
                    );


                logData(
                    `[WebRTC PC#${id}] setLocalDescription`,
                    {
                        type:
                        this
                            .localDescription
                            ?.type
                    }
                );


                void capturePeerSnapshot(
                    this,
                    "após setLocalDescription",
                    true
                );


                return result;
            };


        const originalSetRemoteDescription =
            RTCPeerConnection
                .prototype
                .setRemoteDescription;


        RTCPeerConnection
            .prototype
            .setRemoteDescription =
            async function (
                ...args
            ) {

                instrumentPeerConnection(
                    this
                );


                const result =
                    await originalSetRemoteDescription.apply(
                        this,
                        args
                    );


                const id =
                    getPeerConnectionId(
                        this
                    );


                logData(
                    `[WebRTC PC#${id}] setRemoteDescription`,
                    {
                        type:
                        this
                            .remoteDescription
                            ?.type
                    }
                );


                void capturePeerSnapshot(
                    this,
                    "após setRemoteDescription",
                    true
                );


                return result;
            };


        const originalPeerConnectionClose =
            RTCPeerConnection
                .prototype
                .close;


        RTCPeerConnection
            .prototype
            .close =
            function () {

                instrumentPeerConnection(
                    this
                );


                const id =
                    getPeerConnectionId(
                        this
                    );


                const closeStack =
                    new Error(
                        `RTCPeerConnection PC#${id} close()`
                    ).stack;


                warnData(
                    `[WebRTC PC#${id}] close() FOI CHAMADO`,
                    {
                        connectionState:
                        this
                            .connectionState,

                        iceConnectionState:
                        this
                            .iceConnectionState,

                        iceGatheringState:
                        this
                            .iceGatheringState,

                        signalingState:
                        this
                            .signalingState
                    }
                );


                console.warn(
                    `[WebRTC PC#${id}] STACK REAL DO close():\n${closeStack}`
                );


                dumpStoredSnapshots(
                    this,
                    "RTCPeerConnection.close()"
                );


                void capturePeerSnapshot(
                    this,
                    "imediatamente antes do close",
                    true
                );


                stopPeerStatsTimer(
                    this
                );


                return originalPeerConnectionClose.call(
                    this
                );
            };


        // ==================================================
        // TRACK DIAGNOSTICS
        // ==================================================

        function watchTrack(
            track,
            label
        ) {

            if (!track) {
                return;
            }


            logData(
                `[Track] ${label}`,
                {
                    id:
                    track.id,

                    kind:
                    track.kind,

                    readyState:
                    track.readyState,

                    enabled:
                    track.enabled,

                    muted:
                    track.muted,

                    settings:
                        track
                            .getSettings?.()
                }
            );


            track.addEventListener(
                "mute",
                () => {

                    warnData(
                        `[Track] ${label} MUTED`,
                        {
                            id:
                            track.id,

                            readyState:
                            track.readyState
                        }
                    );
                }
            );


            track.addEventListener(
                "unmute",
                () => {

                    logData(
                        `[Track] ${label} UNMUTED`,
                        {
                            id:
                            track.id,

                            readyState:
                            track.readyState
                        }
                    );
                }
            );


            track.addEventListener(
                "ended",
                () => {

                    warnData(
                        `[Track] ${label} ENDED`,
                        {
                            id:
                            track.id,

                            readyState:
                            track.readyState
                        }
                    );

                },
                {
                    once:
                        true
                }
            );
        }


        // ==================================================
        // PROCESS AUDIO
        // ==================================================

        async function createProcessAudioTrack(
            sourceId
        ) {

            /*
             * v12.2:
             * Cada captura mantém os próprios listeners.
             * Não usamos removeAllListeners durante uma troca,
             * porque isso pode desmontar o listener da captura nova.
             */

            let captureId =
                null;


            let sampleRate =
                null;


            let channels =
                null;


            let bitsPerSample =
                null;


            let audioContext =
                null;


            let destination =
                null;


            let nextStart =
                0;


            let stopped =
                false;


            let firstPcmSeen =
                false;


            let resolveFirstPcm =
                null;


            const firstPcmPromise =
                new Promise(
                    resolve => {
                        resolveFirstPcm =
                            resolve;
                    }
                );


            const unsubscribeError =
                electronProcessAudio
                    .onError(
                        message => {

                            if (stopped) {
                                return;
                            }


                            console.error(
                                `[Process Audio] ${String(message)}`
                            );
                        }
                    );


            const unsubscribeChunk =
                electronProcessAudio
                    .onChunk(
                        data => {

                            if (
                                stopped ||
                                !data ||
                                captureId ===
                                null ||
                                data.captureId !==
                                captureId ||
                                !audioContext ||
                                !destination ||
                                !sampleRate ||
                                !channels
                            ) {
                                return;
                            }


                            const bytes =
                                data.pcm instanceof
                                Uint8Array
                                    ? data.pcm
                                    : new Uint8Array(
                                        data.pcm
                                    );


                            if (
                                bytes.byteLength <
                                channels * 2
                            ) {
                                return;
                            }


                            const view =
                                new DataView(
                                    bytes.buffer,
                                    bytes.byteOffset,
                                    bytes.byteLength
                                );


                            const frames =
                                Math.floor(
                                    bytes.byteLength /
                                    (
                                        channels *
                                        2
                                    )
                                );


                            if (
                                frames <=
                                0
                            ) {
                                return;
                            }


                            const buffer =
                                audioContext
                                    .createBuffer(
                                        channels,
                                        frames,
                                        sampleRate
                                    );


                            for (
                                let channel = 0;
                                channel <
                                channels;
                                channel++
                            ) {

                                const target =
                                    buffer
                                        .getChannelData(
                                            channel
                                        );


                                for (
                                    let frame = 0;
                                    frame <
                                    frames;
                                    frame++
                                ) {

                                    const offset =
                                        (
                                            frame *
                                            channels +
                                            channel
                                        ) *
                                        2;


                                    target[
                                        frame
                                        ] =
                                        view
                                            .getInt16(
                                                offset,
                                                true
                                            ) /
                                        32768;
                                }
                            }


                            const source =
                                audioContext
                                    .createBufferSource();


                            source.buffer =
                                buffer;


                            source.connect(
                                destination
                            );


                            const now =
                                audioContext
                                    .currentTime;


                            if (
                                nextStart <
                                now + 0.025
                            ) {

                                nextStart =
                                    now + 0.025;
                            }


                            source.start(
                                nextStart
                            );


                            nextStart +=
                                frames /
                                sampleRate;


                            if (
                                !firstPcmSeen
                            ) {

                                firstPcmSeen =
                                    true;


                                resolveFirstPcm?.(
                                    true
                                );


                                logData(
                                    "[Process Audio] primeiro PCM recebido",
                                    {
                                        captureId,
                                        bytes:
                                        bytes.byteLength,
                                        frames
                                    }
                                );
                            }
                        }
                    );


            async function cleanupProcessAudio(
                stopHelper =
                true
            ) {

                if (stopped) {
                    return;
                }


                stopped =
                    true;


                logData(
                    "[Process Audio] cleanup",
                    {
                        captureId,
                        stopHelper
                    }
                );


                try {
                    unsubscribeChunk?.();
                } catch {}


                try {
                    unsubscribeError?.();
                } catch {}


                if (
                    stopHelper &&
                    captureId !==
                    null
                ) {

                    try {

                        await electronProcessAudio
                            .stop(
                                captureId
                            );

                    } catch {}
                }


                try {

                    await audioContext
                        ?.close?.();

                } catch {}
            }


            let info =
                null;


            try {

                info =
                    await electronProcessAudio
                        .start(
                            sourceId
                        );


                captureId =
                    info.captureId;


                sampleRate =
                    info.sampleRate;


                channels =
                    info.channels;


                bitsPerSample =
                    info.bitsPerSample;


                logData(
                    "[Process Audio] Formato",
                    info
                );


                if (
                    bitsPerSample !==
                    16
                ) {

                    throw new Error(
                        `PCM ${bitsPerSample}-bit não suportado.`
                    );
                }


                audioContext =
                    new AudioContext({
                        sampleRate
                    });


                await audioContext.resume();


                destination =
                    audioContext
                        .createMediaStreamDestination();


                nextStart =
                    audioContext.currentTime +
                    0.06;


                const track =
                    destination
                        .stream
                        .getAudioTracks()[0];


                if (!track) {

                    throw new Error(
                        "Não foi possível criar Process Audio."
                    );
                }


                watchTrack(
                    track,
                    `Process Audio #${captureId}`
                );


                /*
                 * Não devolve a nova fonte imediatamente após
                 * receber apenas o cabeçalho do helper. Esperamos
                 * um PCM real (ou um timeout curto), evitando que
                 * a Stable Audio troque para uma fonte ainda vazia.
                 */
                await Promise.race([
                    firstPcmPromise,
                    delay(
                        500
                    )
                ]);


                logData(
                    "[Process Audio] fonte pronta para bridge",
                    {
                        captureId,
                        firstPcmSeen,
                        trackState:
                        track.readyState
                    }
                );


                return {
                    track,

                    captureId,

                    cleanup:
                    cleanupProcessAudio
                };

            } catch (caughtError) {

                await cleanupProcessAudio(
                    true
                );


                throw caughtError;
            }
        }


        // ==================================================
        // SILENT AUDIO
        // ==================================================

        async function createSilentAudioTrack() {

            const audioContext =
                new AudioContext();


            await audioContext.resume();


            const destination =
                audioContext
                    .createMediaStreamDestination();


            const track =
                destination
                    .stream
                    .getAudioTracks()[0];


            async function cleanupSilentAudio() {

                try {

                    track.stop();

                } catch {}


                try {

                    await audioContext
                        .close();

                } catch {}
            }


            watchTrack(
                track,
                "Silent Audio"
            );


            return {
                track,

                cleanup:
                cleanupSilentAudio
            };
        }


        // ==================================================
        // RAW SHARE
        // ==================================================

        async function acquireRawShare(
            constraints = {}
        ) {

            let selection =
                null;


            try {

                selection =
                    await electronScreenShare
                        .chooseSource();

            } catch {

                selection =
                    null;
            }


            if (!selection) {

                throw new DOMException(
                    "Screen share cancelled",
                    "AbortError"
                );
            }


            logData(
                "[ScreenShare] seleção",
                selection
            );


            const mediaConstraints = {
                ...constraints,

                video:
                    constraints.video ??
                    true,

                audio:
                    selection.audioMode ===
                    "loopback"
            };


            let processAudioPromise =
                null;


            if (
                selection.audioMode ===
                "process"
            ) {

                processAudioPromise =
                    createProcessAudioTrack(
                        selection.sourceId
                    );
            }


            const nativeStreamPromise =
                originalGetDisplayMedia(
                    mediaConstraints
                );


            let nativeStream =
                null;


            let processAudioResult =
                null;


            try {

                if (
                    processAudioPromise
                ) {

                    [
                        nativeStream,
                        processAudioResult
                    ] =
                        await Promise.all([
                            nativeStreamPromise,
                            processAudioPromise
                        ]);

                } else {

                    nativeStream =
                        await nativeStreamPromise;
                }

            } catch (caughtError) {

                if (
                    processAudioPromise
                ) {

                    try {

                        const result =
                            await processAudioPromise;


                        await result.cleanup(
                            true
                        );

                    } catch {}
                }


                throw caughtError;
            }


            const videoTrack =
                nativeStream
                    .getVideoTracks()[0];


            if (!videoTrack) {

                if (
                    processAudioResult
                ) {

                    try {

                        await processAudioResult
                            .cleanup(
                                true
                            );

                    } catch {}
                }


                for (
                    const track
                    of nativeStream
                    .getTracks()
                    ) {

                    try {

                        track.stop();

                    } catch {}
                }


                throw new Error(
                    "Nenhuma track de vídeo foi criada."
                );
            }


            videoTrack.contentHint =
                "detail";


            watchTrack(
                videoTrack,
                `Raw Video ${selection.sourceId}`
            );


            let audioTrack =
                null;


            let audioType =
                selection.audioMode;


            let audioCaptureId =
                null;


            let audioCleanup =
                async () => {};


            if (
                selection.audioMode ===
                "process"
            ) {

                audioTrack =
                    processAudioResult
                        .track;


                audioCaptureId =
                    processAudioResult
                        .captureId;


                audioCleanup =
                    processAudioResult
                        .cleanup;

            } else if (
                selection.audioMode ===
                "loopback"
            ) {

                audioTrack =
                    nativeStream
                        .getAudioTracks()[0] ||
                    null;


                if (
                    audioTrack
                ) {

                    watchTrack(
                        audioTrack,
                        "System Loopback"
                    );

                } else {

                    const silent =
                        await createSilentAudioTrack();


                    audioTrack =
                        silent.track;


                    audioType =
                        "silent";


                    audioCleanup =
                        silent.cleanup;
                }

            } else {

                const silent =
                    await createSilentAudioTrack();


                audioTrack =
                    silent.track;


                audioType =
                    "silent";


                audioCleanup =
                    silent.cleanup;
            }


            return {
                selection,

                nativeStream,

                videoTrack,

                audioTrack,

                audioType,

                audioCaptureId,

                audioCleanup,

                cleaned:
                    false
            };
        }


        // ==================================================
        // CLEANUP RAW
        // ==================================================

        async function cleanupRawShare(
            share,
            options = {}
        ) {

            if (
                !share ||
                share.cleaned
            ) {
                return;
            }


            share.cleaned =
                true;


            const stopProcessHelper =
                options.stopProcessHelper !==
                false;


            try {

                await share.audioCleanup?.(
                    stopProcessHelper
                );

            } catch {}


            try {

                for (
                    const track
                    of (
                    share.nativeStream
                        ?.getTracks?.() ||
                    []
                )
                    ) {

                    if (
                        track.readyState ===
                        "ended"
                    ) {
                        continue;
                    }


                    try {

                        track.stop();

                    } catch {}
                }

            } catch {}


            try {

                if (
                    share.audioTrack &&
                    share.audioTrack
                        .readyState !==
                    "ended"
                ) {

                    share.audioTrack.stop();
                }

            } catch {}
        }


        // ==================================================
        // STABLE CANVAS FAST START
        // ==================================================

        async function createVideoBridge(
            initialTrack
        ) {

            console.log(
                "[ScreenShare] criando Stable Canvas 30 FPS - Fast Start."
            );


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                1920;


            canvas.height =
                1080;


            const context =
                canvas.getContext(
                    "2d",
                    {
                        alpha:
                            false,

                        desynchronized:
                            true
                    }
                );


            if (!context) {

                throw new Error(
                    "Não foi possível criar Canvas."
                );
            }


            const video =
                document.createElement(
                    "video"
                );


            video.muted =
                true;


            video.playsInline =
                true;


            video.autoplay =
                true;


            video.preload =
                "auto";


            const canvasStream =
                canvas.captureStream(
                    30
                );


            const outputTrack =
                canvasStream
                    .getVideoTracks()[0];


            if (!outputTrack) {

                throw new Error(
                    "Canvas não criou video track."
                );
            }


            outputTrack.contentHint =
                "detail";


            watchTrack(
                outputTrack,
                "PUBLIC Stable Canvas Video"
            );


            let closed =
                false;


            let renderToken =
                0;


            let frameCounter =
                0;


            async function waitForUsableFrame(
                token
            ) {

                if (
                    video.readyState >=
                    HTMLMediaElement
                        .HAVE_CURRENT_DATA &&
                    video.videoWidth >
                    0 &&
                    video.videoHeight >
                    0
                ) {

                    return true;
                }


                const started =
                    performance.now();


                return new Promise(
                    resolve => {

                        const check =
                            () => {

                                if (
                                    closed ||
                                    token !==
                                    renderToken
                                ) {

                                    resolve(
                                        false
                                    );


                                    return;
                                }


                                if (
                                    video.readyState >=
                                    HTMLMediaElement
                                        .HAVE_CURRENT_DATA &&
                                    video.videoWidth >
                                    0 &&
                                    video.videoHeight >
                                    0
                                ) {

                                    resolve(
                                        true
                                    );


                                    return;
                                }


                                if (
                                    performance.now() -
                                    started >=
                                    FIRST_FRAME_TIMEOUT_MS
                                ) {

                                    resolve(
                                        false
                                    );


                                    return;
                                }


                                requestAnimationFrame(
                                    check
                                );
                            };


                        check();
                    }
                );
            }


            function drawCurrentFrame() {

                if (
                    closed ||
                    video.readyState <
                    HTMLMediaElement
                        .HAVE_CURRENT_DATA ||
                    video.videoWidth <=
                    0 ||
                    video.videoHeight <=
                    0
                ) {
                    return false;
                }


                const sourceWidth =
                    video.videoWidth;


                const sourceHeight =
                    video.videoHeight;


                const sourceRatio =
                    sourceWidth /
                    sourceHeight;


                const targetRatio =
                    canvas.width /
                    canvas.height;


                let drawWidth =
                    canvas.width;


                let drawHeight =
                    canvas.height;


                let offsetX =
                    0;


                let offsetY =
                    0;


                if (
                    sourceRatio >
                    targetRatio
                ) {

                    drawWidth =
                        canvas.width;


                    drawHeight =
                        Math.round(
                            canvas.width /
                            sourceRatio
                        );


                    offsetY =
                        Math.round(
                            (
                                canvas.height -
                                drawHeight
                            ) /
                            2
                        );

                } else {

                    drawHeight =
                        canvas.height;


                    drawWidth =
                        Math.round(
                            canvas.height *
                            sourceRatio
                        );


                    offsetX =
                        Math.round(
                            (
                                canvas.width -
                                drawWidth
                            ) /
                            2
                        );
                }


                context.fillStyle =
                    "#000";


                context.fillRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


                context.drawImage(
                    video,

                    0,
                    0,
                    sourceWidth,
                    sourceHeight,

                    offsetX,
                    offsetY,
                    drawWidth,
                    drawHeight
                );


                frameCounter++;


                return true;
            }


            async function setVideoSource(
                track
            ) {

                if (
                    closed ||
                    !track
                ) {
                    return;
                }


                renderToken++;


                const token =
                    renderToken;


                logData(
                    "[ScreenShare] Canvas recebendo fonte",
                    {
                        sourceTrack:
                        track.id,

                        readyState:
                        track.readyState,

                        settings:
                            track
                                .getSettings?.()
                    }
                );


                video.srcObject =
                    new MediaStream([
                        track
                    ]);


                const playPromise =
                    video.play()
                        .catch(
                            caughtError => {

                                warnData(
                                    "[ScreenShare] video.play() falhou",
                                    caughtError
                                );
                            }
                        );


                const gotFrame =
                    await waitForUsableFrame(
                        token
                    );


                await playPromise;


                if (
                    closed ||
                    token !==
                    renderToken
                ) {
                    return;
                }


                if (
                    gotFrame
                ) {

                    drawCurrentFrame();

                } else {

                    console.warn(
                        `[ScreenShare] primeiro frame não chegou em ${FIRST_FRAME_TIMEOUT_MS}ms; continuando Fast Start.`
                    );


                    drawCurrentFrame();
                }


                logData(
                    "[ScreenShare] Canvas pronto para envio",
                    {
                        gotInitialFrame:
                        gotFrame,

                        frameCounter,

                        source:
                        track.id,

                        public:
                        outputTrack.id,

                        width:
                        canvas.width,

                        height:
                        canvas.height,

                        readyState:
                        outputTrack
                            .readyState
                    }
                );


                const drawLoop =
                    () => {

                        if (
                            closed ||
                            token !==
                            renderToken
                        ) {
                            return;
                        }


                        try {

                            drawCurrentFrame();

                        } catch {}


                        if (
                            typeof video
                                .requestVideoFrameCallback ===
                            "function"
                        ) {

                            video
                                .requestVideoFrameCallback(
                                    drawLoop
                                );

                        } else {

                            requestAnimationFrame(
                                drawLoop
                            );
                        }
                    };


                if (
                    typeof video
                        .requestVideoFrameCallback ===
                    "function"
                ) {

                    video
                        .requestVideoFrameCallback(
                            drawLoop
                        );

                } else {

                    requestAnimationFrame(
                        drawLoop
                    );
                }


                await nextAnimationFrame();


                logData(
                    "[ScreenShare] Canvas Fast Start concluído",
                    {
                        frameCounter,

                        publicTrack:
                        outputTrack.id,

                        readyState:
                        outputTrack
                            .readyState
                    }
                );
            }


            async function closeVideoBridge() {

                if (closed) {
                    return;
                }


                closed =
                    true;


                renderToken++;


                console.log(
                    "[ScreenShare] fechando Canvas Bridge."
                );


                try {

                    video.pause();

                } catch {}


                video.srcObject =
                    null;


                if (
                    outputTrack
                        .readyState !==
                    "ended"
                ) {

                    try {

                        outputTrack.stop();

                    } catch {}
                }
            }


            await setVideoSource(
                initialTrack
            );


            return {
                track:
                outputTrack,

                setSource:
                setVideoSource,

                close:
                closeVideoBridge
            };
        }


        // ==================================================
        // STABLE AUDIO
        // ==================================================

        async function createAudioBridge(
            initialTrack
        ) {

            const audioContext =
                new AudioContext({
                    sampleRate:
                        48000
                });


            await audioContext.resume();


            const destination =
                audioContext
                    .createMediaStreamDestination();


            const outputTrack =
                destination
                    .stream
                    .getAudioTracks()[0];


            if (!outputTrack) {

                try {

                    await audioContext.close();

                } catch {}


                throw new Error(
                    "Não foi possível criar Audio Bridge."
                );
            }


            watchTrack(
                outputTrack,
                "PUBLIC Stable Audio"
            );


            let currentNode =
                null;


            let currentStream =
                null;


            let closed =
                false;


            async function setAudioSource(
                track
            ) {

                if (closed) {
                    return;
                }


                if (
                    !track ||
                    track.readyState ===
                    "ended"
                ) {

                    console.warn(
                        "[ScreenShare] Audio Bridge recebeu fonte inválida/encerrada."
                    );


                    return;
                }


                if (
                    audioContext.state ===
                    "suspended"
                ) {

                    try {
                        await audioContext.resume();
                    } catch {}
                }


                const nextStream =
                    new MediaStream([
                        track
                    ]);


                const nextNode =
                    audioContext
                        .createMediaStreamSource(
                            nextStream
                        );


                /*
                 * Conecta a fonte nova ANTES de desligar a antiga.
                 * Isso deixa a track pública contínua durante a troca.
                 */
                nextNode.connect(
                    destination
                );


                const previousNode =
                    currentNode;


                currentNode =
                    nextNode;


                currentStream =
                    nextStream;


                await nextAnimationFrame();


                if (
                    previousNode
                ) {

                    try {
                        previousNode.disconnect();
                    } catch {}
                }


                logData(
                    "[ScreenShare] Audio Bridge recebeu nova fonte",
                    {
                        sourceTrack:
                        track.id,

                        sourceState:
                        track.readyState,

                        publicTrack:
                        outputTrack.id,

                        publicState:
                        outputTrack.readyState,

                        contextState:
                        audioContext.state
                    }
                );
            }


            async function closeAudioBridge() {

                if (closed) {
                    return;
                }


                closed =
                    true;


                if (
                    currentNode
                ) {

                    try {

                        currentNode.disconnect();

                    } catch {}


                    currentNode =
                        null;
                }


                currentStream =
                    null;


                if (
                    outputTrack
                        .readyState !==
                    "ended"
                ) {

                    try {

                        outputTrack.stop();

                    } catch {}
                }


                try {

                    await audioContext.close();

                } catch {}
            }


            await setAudioSource(
                initialTrack
            );


            return {
                track:
                outputTrack,

                setSource:
                setAudioSource,

                close:
                closeAudioBridge
            };
        }


        // ==================================================
        // REMOVER BOTÕES
        // ==================================================

        function removeVoicePanelSwitchButton() {

            document
                .getElementById(
                    VOICE_PANEL_SWITCH_BUTTON_ID
                )
                ?.remove();
        }


        function removeCallBarSwitchButton() {

            document
                .getElementById(
                    CALL_BAR_SWITCH_BUTTON_ID
                )
                ?.remove();
        }


        function removeSwitchButtons() {

            if (
                buttonSearchTimer
            ) {

                clearTimeout(
                    buttonSearchTimer
                );


                buttonSearchTimer =
                    null;
            }


            if (
                uiCleanupTimer
            ) {

                clearTimeout(
                    uiCleanupTimer
                );


                uiCleanupTimer =
                    null;
            }


            removeVoicePanelSwitchButton();

            removeCallBarSwitchButton();
        }


        function scheduleDeferredSwitchButtonCleanup(
            delayMs = 350
        ) {

            if (
                buttonSearchTimer
            ) {

                clearTimeout(
                    buttonSearchTimer
                );


                buttonSearchTimer =
                    null;
            }


            if (
                uiCleanupTimer
            ) {

                clearTimeout(
                    uiCleanupTimer
                );
            }


            uiCleanupTimer =
                setTimeout(
                    () => {

                        uiCleanupTimer =
                            null;


                        removeSwitchButtons();

                    },
                    delayMs
                );
        }


        // ==================================================
        // BUSY
        // ==================================================

        function updateButtonBusyState(
            button,
            busy
        ) {

            if (!button) {
                return;
            }


            button.disabled =
                busy;


            button.style.opacity =
                busy
                    ? "0.45"
                    : "1";


            button.style.cursor =
                busy
                    ? "wait"
                    : "pointer";
        }


        function setSwitchButtonState(
            busy
        ) {

            updateButtonBusyState(
                document.getElementById(
                    VOICE_PANEL_SWITCH_BUTTON_ID
                ),
                busy
            );


            updateButtonBusyState(
                document.getElementById(
                    CALL_BAR_SWITCH_BUTTON_ID
                ),
                busy
            );
        }


        // ==================================================
        // FINALIZAR
        // ==================================================

        async function finalizeSession(
            session,
            reason =
            "unknown"
        ) {

            if (
                !session ||
                session.finalized ||
                session.finalizing ||
                currentSession !==
                session
            ) {
                return;
            }


            session.finalizing =
                true;


            session.stopping =
                true;


            screenShareUiStopped =
                true;


            console.log(
                `[ScreenShare] FINALIZANDO: ${reason}`
            );


            if (
                explicitStopTimer
            ) {

                clearTimeout(
                    explicitStopTimer
                );


                explicitStopTimer =
                    null;
            }


            removeSwitchButtons();


            currentSession =
                null;


            try {

                await cleanupRawShare(
                    session.rawShare,
                    {
                        stopProcessHelper:
                            true
                    }
                );

            } catch {}


            try {

                await session
                    .videoBridge
                    .close();

            } catch {}


            try {

                await session
                    .audioBridge
                    .close();

            } catch {}


            session.finalized =
                true;


            session.finalizing =
                false;


            console.log(
                "[ScreenShare] cleanup completo."
            );
        }


        // ==================================================
        // TROCAR FONTE
        // ==================================================

        async function switchShareSource() {

            const session =
                currentSession;


            if (
                !session ||
                session.stopping ||
                switching
            ) {
                return;
            }


            if (
                session
                    .videoBridge
                    .track
                    .readyState ===
                "ended"
            ) {

                console.warn(
                    "[ScreenShare] troca ignorada: track pública já terminou."
                );


                return;
            }


            switching =
                true;


            setSwitchButtonState(
                true
            );


            const oldRawShare =
                session.rawShare;


            let nextRawShare =
                null;


            try {

                console.log(
                    "[ScreenShare] abrindo picker para trocar fonte..."
                );


                nextRawShare =
                    await acquireRawShare({
                        video:
                            true,

                        audio:
                            true
                    });


                if (
                    currentSession !==
                    session ||
                    session
                        .videoBridge
                        .track
                        .readyState ===
                    "ended"
                ) {

                    await cleanupRawShare(
                        nextRawShare,
                        {
                            stopProcessHelper:
                                true
                        }
                    );


                    return;
                }


                await Promise.all([
                    session
                        .videoBridge
                        .setSource(
                            nextRawShare
                                .videoTrack
                        ),

                    session
                        .audioBridge
                        .setSource(
                            nextRawShare
                                .audioTrack
                        )
                ]);


                session.rawShare =
                    nextRawShare;


                const newUsesProcess =
                    nextRawShare
                        .audioType ===
                    "process";


                await cleanupRawShare(
                    oldRawShare,
                    {
                        stopProcessHelper:
                            !newUsesProcess
                    }
                );


                session.switchCount++;


                logData(
                    "[ScreenShare] FONTE TROCADA",
                    {
                        switchCount:
                        session.switchCount,

                        sourceId:
                        nextRawShare
                            .selection
                            .sourceId,

                        audioMode:
                        nextRawShare
                            .selection
                            .audioMode,

                        captureId:
                        nextRawShare
                            .audioCaptureId,

                        publicTrack:
                        session
                            .videoBridge
                            .track
                            .id,

                        publicState:
                        session
                            .videoBridge
                            .track
                            .readyState
                    }
                );


                nextRawShare =
                    null;

            } catch (caughtError) {

                if (
                    caughtError?.name ===
                    "AbortError"
                ) {

                    console.log(
                        "[ScreenShare] troca cancelada pelo usuário."
                    );

                } else {

                    errorData(
                        "[ScreenShare] troca falhou",
                        caughtError
                    );
                }


                try {

                    await cleanupRawShare(
                        nextRawShare,
                        {
                            stopProcessHelper:
                                true
                        }
                    );

                } catch {}


                if (
                    currentSession ===
                    session &&
                    session
                        .videoBridge
                        .track
                        .readyState !==
                    "ended" &&
                    oldRawShare &&
                    !oldRawShare.cleaned
                ) {

                    try {

                        await Promise.all([
                            session
                                .videoBridge
                                .setSource(
                                    oldRawShare
                                        .videoTrack
                                ),

                            session
                                .audioBridge
                                .setSource(
                                    oldRawShare
                                        .audioTrack
                                )
                        ]);

                    } catch {}
                }


            } finally {

                switching =
                    false;


                setSwitchButtonState(
                    false
                );


                scheduleSwitchButtonSearch();
            }
        }


        // ==================================================
        // AÇÃO COMUM
        // ==================================================

        function bindSwitchAction(
            button
        ) {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    event.stopImmediatePropagation();


                    void switchShareSource();

                },
                true
            );
        }


        // ==================================================
        // BOTÃO NATIVO DE STOP
        // ==================================================

        function bindActiveScreenShareButton(
            screenShareButton
        ) {

            if (
                !screenShareButton ||
                boundScreenShareButtons.has(
                    screenShareButton
                )
            ) {
                return;
            }


            boundScreenShareButtons.add(
                screenShareButton
            );


            screenShareButton.addEventListener(
                "click",
                () => {

                    const session =
                        currentSession;


                    if (
                        !session ||
                        switching
                    ) {
                        return;
                    }


                    lastExplicitStopAt =
                        Date.now();


                    console.log(
                        "[ScreenShare] botão nativo de parar transmissão clicado."
                    );


                    session.stopping =
                        true;


                    /*
                     * STOP UI LOCK:
                     *
                     * A barra do Sharkord é desmontada/remontada pelo React
                     * quando o screen share termina. Sem esta trava, o
                     * MutationObserver/watchdog pode encontrar novamente o
                     * controle nativo e recriar o botão "Trocar tela".
                     */
                    screenShareUiStopped =
                        true;


                    removeSwitchButtons();


                    /*
                     * v12.3 UI STOP FIX:
                     *
                     * Não removemos nosso botão durante o mesmo
                     * ciclo do click nativo. O Sharkord/React está
                     * desmontando e remontando a barra nesse exato
                     * momento; alterar os filhos do container no meio
                     * da reconciliação podia fazer os ícones nativos
                     * piscarem/sumirem temporariamente.
                     *
                     * Cancelamos buscas pendentes e limpamos nossos
                     * botões só depois que a UI nativa teve tempo de
                     * estabilizar.
                     */
                    scheduleDeferredSwitchButtonCleanup(
                        350
                    );


                    if (
                        explicitStopTimer
                    ) {

                        clearTimeout(
                            explicitStopTimer
                        );
                    }


                    explicitStopTimer =
                        setTimeout(
                            () => {

                                explicitStopTimer =
                                    null;


                                if (
                                    currentSession !==
                                    session
                                ) {
                                    return;
                                }


                                void finalizeSession(
                                    session,
                                    "encerramento explícito do screen share"
                                );

                            },
                            1200
                        );

                },
                false
            );


            console.log(
                "[ScreenShare UI] controle nativo de parar transmissão monitorado."
            );
        }


        // ==================================================
        // PREPARAR BOTÃO
        // ==================================================

        function prepareSwitchButton(
            button,
            id
        ) {

            button.id =
                id;


            button.type =
                "button";


            button.disabled =
                false;


            button.removeAttribute(
                "aria-describedby"
            );


            button.removeAttribute(
                "aria-pressed"
            );


            button.removeAttribute(
                "data-state"
            );


            button.removeAttribute(
                "data-radix-collection-item"
            );


            button.innerHTML =
                SWITCH_ICON;


            button.setAttribute(
                "aria-label",
                "Trocar tela"
            );


            button.setAttribute(
                "title",
                "Trocar tela"
            );


            button.style.display =
                "inline-flex";


            button.style.alignItems =
                "center";


            button.style.justifyContent =
                "center";


            button.style.cursor =
                "pointer";


            button.style.lineHeight =
                "0";


            bindSwitchAction(
                button
            );


            return button;
        }


        // ==================================================
        // BOTÃO 1 - VOICE CONNECTED
        // [ TROCAR ] [ PARAR ]
        // ==================================================

        function installVoicePanelSwitchButton() {

            const session =
                currentSession;


            if (
                !session ||
                session.stopping
            ) {

                removeVoicePanelSwitchButton();


                return false;
            }


            const stopShareButton =
                findVoicePanelStopShareButton();


            if (!stopShareButton) {
                return false;
            }


            const parent =
                stopShareButton
                    .parentElement;


            if (!parent) {
                return false;
            }


            const existing =
                document.getElementById(
                    VOICE_PANEL_SWITCH_BUTTON_ID
                );


            if (
                existing?.isConnected &&
                existing.parentElement ===
                parent &&
                existing.nextElementSibling ===
                stopShareButton
            ) {

                return true;
            }


            existing?.remove();


            const button =
                prepareSwitchButton(
                    stopShareButton
                        .cloneNode(
                            false
                        ),
                    VOICE_PANEL_SWITCH_BUTTON_ID
                );


            /*
             * Procura um botão neutro pequeno
             * ao lado para copiar o visual.
             */
            const neutralButtons =
                Array.from(
                    parent.querySelectorAll(
                        "button, [role='button']"
                    )
                ).filter(
                    candidate => {

                        if (
                            candidate ===
                            stopShareButton ||
                            isOurButton(
                                candidate
                            ) ||
                            !isElementVisible(
                                candidate
                            )
                        ) {
                            return false;
                        }


                        const rect =
                            candidate
                                .getBoundingClientRect();


                        return (
                            rect.width <=
                            60 &&
                            rect.height <=
                            60
                        );
                    }
                );


            const neutralTemplate =
                neutralButtons.at(
                    -1
                );


            if (
                neutralTemplate
            ) {

                const style =
                    getComputedStyle(
                        neutralTemplate
                    );


                button.style.background =
                    style.backgroundColor;


                button.style.color =
                    style.color;


                button.style.border =
                    style.border;

            } else {

                button.style.background =
                    "rgb(24, 24, 24)";


                button.style.color =
                    "rgb(245, 245, 245)";
            }


            /*
             * POSIÇÃO EXATA:
             *
             * [ TROCAR ] [ PARAR ]
             */
            parent.insertBefore(
                button,
                stopShareButton
            );


            console.log(
                "[ScreenShare UI] TROCAR no Voice connected instalado à esquerda do PARAR."
            );


            return true;
        }


        // ==================================================
        // BOTÃO 2 - CALL BAR
        // MESMA CAIXA:
        //
        // câmera [ TROCAR ] [ PARAR ]
        // ==================================================

        function installCallBarSwitchButton() {

            const session =
                currentSession;


            if (
                !session ||
                session.stopping
            ) {

                removeCallBarSwitchButton();


                return false;
            }


            const stopShareButton =
                findActiveScreenShareButton();


            if (!stopShareButton) {
                return false;
            }


            /*
             * IMPORTANTÍSSIMO:
             *
             * usamos o próprio parent do botão
             * azul de parar.
             *
             * Portanto nosso botão obrigatoriamente
             * entra NA MESMA CAIXA.
             */
            const parent =
                stopShareButton
                    .parentElement;


            if (!parent) {
                return false;
            }


            const existing =
                document.getElementById(
                    CALL_BAR_SWITCH_BUTTON_ID
                );


            if (
                existing?.isConnected &&
                existing.parentElement ===
                parent &&
                existing.nextElementSibling ===
                stopShareButton
            ) {

                return true;
            }


            existing?.remove();


            const button =
                prepareSwitchButton(
                    stopShareButton
                        .cloneNode(
                            false
                        ),
                    CALL_BAR_SWITCH_BUTTON_ID
                );


            /*
             * Copiar visual do botão imediatamente
             * anterior ao stop, normalmente câmera.
             */
            let neutralTemplate =
                stopShareButton
                    .previousElementSibling;


            if (
                neutralTemplate &&
                isOurButton(
                    neutralTemplate
                )
            ) {

                neutralTemplate =
                    neutralTemplate
                        .previousElementSibling;
            }


            if (
                neutralTemplate &&
                neutralTemplate.matches?.(
                    "button, [role='button']"
                )
            ) {

                const style =
                    getComputedStyle(
                        neutralTemplate
                    );


                button.style.background =
                    style.backgroundColor;


                button.style.color =
                    style.color;


                button.style.border =
                    style.border;

            } else {

                button.style.background =
                    "transparent";


                button.style.color =
                    "rgb(245, 245, 245)";
            }


            /*
             * POSIÇÃO DEFINITIVA:
             *
             * ┌───────────────────────────────┐
             * │ câmera [ TROCAR ] [ PARAR ]   │
             * └───────────────────────────────┘
             */
            parent.insertBefore(
                button,
                stopShareButton
            );


            console.log(
                "[ScreenShare UI] TROCAR na call bar instalado NA MESMA CAIXA e à esquerda do PARAR."
            );


            return true;
        }


        // ==================================================
        // INSTALAR AMBOS
        // ==================================================

        function installSwitchButtons() {

            const session =
                currentSession;


            if (
                screenShareUiStopped ||
                !session ||
                session.stopping
            ) {

                removeSwitchButtons();


                return false;
            }


            installVoicePanelSwitchButton();

            installCallBarSwitchButton();


            /*
             * Existem dois controles nativos capazes de encerrar
             * a transmissão:
             *
             * 1. Voice connected
             * 2. Call bar
             *
             * Os dois precisam marcar a sessão como "stopping".
             * Antes, apenas o botão da call bar era monitorado.
             */
            const voiceStopButton =
                findVoicePanelStopShareButton();


            const callStopButton =
                findActiveScreenShareButton();


            if (
                voiceStopButton
            ) {

                bindActiveScreenShareButton(
                    voiceStopButton
                );
            }


            if (
                callStopButton
            ) {

                bindActiveScreenShareButton(
                    callStopButton
                );
            }


            return true;
        }


        function scheduleSwitchButtonSearch() {

            if (
                buttonSearchTimer
            ) {

                clearTimeout(
                    buttonSearchTimer
                );
            }


            if (
                screenShareUiStopped ||
                !currentSession ||
                currentSession.stopping
            ) {

                removeSwitchButtons();


                return;
            }


            buttonSearchTimer =
                setTimeout(
                    installSwitchButtons,
                    80
                );
        }


        // ==================================================
        // MUTATION OBSERVER
        // ==================================================

        function startButtonObserver() {

            if (observer) {
                return;
            }


            const root =
                document.documentElement;


            if (!root) {

                if (
                    observerStartTimer
                ) {
                    return;
                }


                observerStartTimer =
                    setTimeout(
                        () => {

                            observerStartTimer =
                                null;


                            startButtonObserver();

                        },
                        50
                    );


                return;
            }


            observer =
                new MutationObserver(
                    () => {

                        if (
                            screenShareUiStopped ||
                            !currentSession ||
                            currentSession.stopping
                        ) {

                            removeSwitchButtons();


                            return;
                        }


                        scheduleSwitchButtonSearch();
                    }
                );


            observer.observe(
                root,
                {
                    childList:
                        true,

                    subtree:
                        true,

                    attributes:
                        true,

                    attributeFilter: [
                        "class",
                        "style",
                        "aria-label",
                        "aria-pressed",
                        "data-state"
                    ]
                }
            );


            console.log(
                "[ScreenShare UI] MutationObserver iniciado."
            );
        }


        // ==================================================
        // WATCHDOG DOS DOIS BOTÕES
        // ==================================================

        setInterval(
            () => {

                const session =
                    currentSession;


                if (
                    screenShareUiStopped ||
                    !session ||
                    session.stopping
                ) {

                    removeSwitchButtons();


                    return;
                }


                // ------------------------------------------
                // VOICE CONNECTED
                // ------------------------------------------

                const voiceStopButton =
                    findVoicePanelStopShareButton();


                const voiceSwitchButton =
                    document.getElementById(
                        VOICE_PANEL_SWITCH_BUTTON_ID
                    );


                if (
                    voiceStopButton &&
                    (
                        !voiceSwitchButton ||
                        !voiceSwitchButton
                            .isConnected ||
                        voiceSwitchButton
                            .parentElement !==
                        voiceStopButton
                            .parentElement ||
                        voiceSwitchButton
                            .nextElementSibling !==
                        voiceStopButton
                    )
                ) {

                    installVoicePanelSwitchButton();
                }


                // ------------------------------------------
                // CALL BAR
                // ------------------------------------------

                const callStopButton =
                    findActiveScreenShareButton();


                const callSwitchButton =
                    document.getElementById(
                        CALL_BAR_SWITCH_BUTTON_ID
                    );


                if (
                    callStopButton &&
                    (
                        !callSwitchButton ||
                        !callSwitchButton
                            .isConnected ||
                        callSwitchButton
                            .parentElement !==
                        callStopButton
                            .parentElement ||
                        callSwitchButton
                            .nextElementSibling !==
                        callStopButton
                    )
                ) {

                    installCallBarSwitchButton();
                }


                // ------------------------------------------
                // MONITORAR STOP
                // ------------------------------------------

                /*
                 * O botão de parar do Voice connected e o botão
                 * equivalente da call bar podem encerrar o share.
                 * Monitoramos os dois para impedir que a UI custom
                 * reapareça depois do encerramento.
                 */
                if (
                    voiceStopButton
                ) {

                    bindActiveScreenShareButton(
                        voiceStopButton
                    );
                }


                if (
                    callStopButton
                ) {

                    bindActiveScreenShareButton(
                        callStopButton
                    );
                }

            },
            500
        );


        // ==================================================
        // COOLDOWN
        // ==================================================

        async function waitForReopenCooldown() {

            if (
                lastExplicitStopAt <=
                0
            ) {
                return;
            }


            const elapsed =
                Date.now() -
                lastExplicitStopAt;


            const remaining =
                REOPEN_COOLDOWN_MS -
                elapsed;


            if (
                remaining <=
                0
            ) {
                return;
            }


            console.log(
                `[ScreenShare] aguardando ${remaining}ms para reabrir após Stop anterior.`
            );


            await delay(
                remaining
            );


            console.log(
                "[ScreenShare] cooldown concluído."
            );
        }


        // ==================================================
        // GET DISPLAY MEDIA
        // ==================================================

        navigator.mediaDevices.getDisplayMedia =
            async function (
                constraints = {}
            ) {

                const startedAt =
                    performance.now();


                console.log(
                    "[ScreenShare] nova sessão solicitada - FAST START."
                );


                if (
                    currentSession
                ) {

                    console.warn(
                        "[ScreenShare] sessão anterior ainda existe. Limpando."
                    );


                    await finalizeSession(
                        currentSession,
                        "nova sessão solicitada"
                    );
                }


                await waitForReopenCooldown();


                const rawStartedAt =
                    performance.now();


                const rawShare =
                    await acquireRawShare(
                        constraints
                    );


                const rawElapsed =
                    Math.round(
                        performance.now() -
                        rawStartedAt
                    );


                console.log(
                    `[ScreenShare PERF] aquisição raw: ${rawElapsed}ms`
                );


                let videoBridge =
                    null;


                let audioBridge =
                    null;


                try {

                    const bridgeStartedAt =
                        performance.now();


                    [
                        videoBridge,
                        audioBridge
                    ] =
                        await Promise.all([
                            createVideoBridge(
                                rawShare.videoTrack
                            ),

                            createAudioBridge(
                                rawShare.audioTrack
                            )
                        ]);


                    const bridgeElapsed =
                        Math.round(
                            performance.now() -
                            bridgeStartedAt
                        );


                    console.log(
                        `[ScreenShare PERF] bridges: ${bridgeElapsed}ms`
                    );


                    const publicStream =
                        new MediaStream([
                            videoBridge.track,
                            audioBridge.track
                        ]);


                    /*
                     * Uma nova transmissão foi criada com sucesso.
                     * Agora a UI de troca pode voltar a existir.
                     */
                    screenShareUiStopped =
                        false;


                    currentSession = {
                        rawShare,

                        videoBridge,

                        audioBridge,

                        switchCount:
                            0,

                        stopping:
                            false,

                        finalizing:
                            false,

                        finalized:
                            false
                    };


                    startButtonObserver();


                    /*
                     * Interface nunca bloqueia o
                     * retorno do stream ao Sharkord.
                     */
                    setTimeout(
                        installSwitchButtons,
                        0
                    );


                    setTimeout(
                        installSwitchButtons,
                        120
                    );


                    setTimeout(
                        installSwitchButtons,
                        300
                    );


                    setTimeout(
                        installSwitchButtons,
                        650
                    );


                    setTimeout(
                        installSwitchButtons,
                        1200
                    );


                    setTimeout(
                        installSwitchButtons,
                        2000
                    );


                    const totalElapsed =
                        Math.round(
                            performance.now() -
                            startedAt
                        );


                    logData(
                        "[ScreenShare] sessão Stable Canvas pronta",
                        {
                            totalStartMs:
                            totalElapsed,

                            rawStartMs:
                            rawElapsed,

                            bridgeStartMs:
                            bridgeElapsed,

                            sourceVideoTrack:
                            rawShare
                                .videoTrack
                                .id,

                            publicVideoTrack:
                            videoBridge
                                .track
                                .id,

                            publicVideoState:
                            videoBridge
                                .track
                                .readyState,

                            sourceAudioTrack:
                            rawShare
                                .audioTrack
                                ?.id,

                            publicAudioTrack:
                            audioBridge
                                .track
                                .id,

                            audioMode:
                            rawShare
                                .selection
                                .audioMode,

                            captureId:
                            rawShare
                                .audioCaptureId
                        }
                    );


                    console.log(
                        `[ScreenShare PERF] TOTAL até devolver ao Sharkord: ${totalElapsed}ms`
                    );


                    return publicStream;

                } catch (caughtError) {

                    errorData(
                        "[ScreenShare] criação falhou",
                        caughtError
                    );


                    try {

                        await videoBridge
                            ?.close?.();

                    } catch {}


                    try {

                        await audioBridge
                            ?.close?.();

                    } catch {}


                    await cleanupRawShare(
                        rawShare,
                        {
                            stopProcessHelper:
                                true
                        }
                    );


                    throw caughtError;
                }
            };


        // ==================================================
        // MONITOR TRACK PÚBLICA
        // ==================================================

        let lastPublicState =
            null;


        setInterval(
            () => {

                const session =
                    currentSession;


                if (!session) {

                    lastPublicState =
                        null;


                    return;
                }


                const track =
                    session
                        .videoBridge
                        .track;


                const state =
                    track.readyState;


                if (
                    state ===
                    lastPublicState
                ) {
                    return;
                }


                lastPublicState =
                    state;


                logData(
                    "[ScreenShare] estado da track pública",
                    {
                        readyState:
                        state,

                        id:
                        track.id,

                        switchCount:
                        session.switchCount
                    }
                );


                if (
                    state ===
                    "ended"
                ) {

                    console.warn(
                        "[ScreenShare] track pública terminou. DIAGNÓSTICO SOMENTE."
                    );


                    scheduleDeferredSwitchButtonCleanup(
                        350
                    );
                }

            },
            500
        );


        // ==================================================
        // START
        // ==================================================

        startButtonObserver();


        console.log(
            "[ScreenShare] v12.3 UI STOP FIX + FAST START + AUDIO SWITCH FIX + dois botões à esquerda do PARAR + JSON Flight Recorder instalado."
        );
    }
});
