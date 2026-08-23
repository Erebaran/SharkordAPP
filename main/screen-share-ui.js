function installScreenShareUi(
    mainWindow
) {

    if (
        !mainWindow ||
        mainWindow.isDestroyed()
    ) {
        return;
    }


    const inject = async () => {

        if (
            mainWindow.isDestroyed()
        ) {
            return;
        }


        const code = String.raw`
(() => {

    const PATCH_FLAG =
        "__sharkordScreenSwitchButtonStateV2";


    if (
        window[
            PATCH_FLAG
        ]
    ) {
        return;
    }


    window[
        PATCH_FLAG
    ] =
        true;


    const VOICE_BUTTON_ID =
        "__sharkord_switch_voice_state_v2";


    const CALL_BUTTON_ID =
        "__sharkord_switch_call_state_v2";


    const LEGACY_IDS = [
        "__sharkord_voice_panel_switch_button",
        "__sharkord_call_bar_switch_button",
        "__sharkord_switch_voice_stable_v1",
        "__sharkord_switch_call_stable_v1",
        "__sharkord_switch_voice_v3",
        "__sharkord_switch_call_v3",
        "__sharkord_switch_voice_v4",
        "__sharkord_switch_call_v4",
        "__sharkord_switch_voice_v5",
        "__sharkord_switch_call_v5",
        "__sharkord_switch_voice_v6",
        "__sharkord_switch_call_v6",
        "__sharkord_switch_voice_v7",
        "__sharkord_switch_call_v7",
        "__sharkord_simple_switch_source",
        "__sharkord_switch_voice_clean_v1",
        "__sharkord_switch_call_clean_v1"
    ];


    const SWITCH_ICON =
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M8.5 20H15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M12 17V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M12.5 12.5L17.5 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M14 7.5H17.5V11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';


    let switching =
        false;


    let refreshTimer =
        null;


    let lastKnownSharing =
        null;


    let missingCallSince =
        0;


    const SHARE_STATE_EVENT =
        "__sharkordLocalScreenShareState";


    function getLocalSharingState() {

        return (
            window
                .__sharkordLocalScreenShareActive ===
            true
        );
    }


    function setLocalSharingState(
        active,
        reason =
            "renderer"
    ) {

        const value =
            Boolean(
                active
            );


        if (
            window
                .__sharkordLocalScreenShareActive ===
            value
        ) {
            return;
        }


        window
            .__sharkordLocalScreenShareActive =
            value;


        console.log(
            "[ScreenShare Button V2] estado local:",
            {
                active:
                    value,
                reason
            }
        );


        window.dispatchEvent(
            new CustomEvent(
                SHARE_STATE_EVENT,
                {
                    detail: {
                        active:
                            value,
                        reason
                    }
                }
            )
        );
    }


    function delay(
        ms
    ) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    }


    function normalizeText(
        value
    ) {

        return String(
            value ||
            ""
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


    function isVisible(
        element
    ) {

        if (!element) {
            return false;
        }


        const rect =
            element
                .getBoundingClientRect();


        if (
            rect.width <=
            0 ||
            rect.height <=
            0
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
            "hidden" &&
            Number(
                style.opacity ||
                1
            ) >
            0
        );
    }


    function description(
        element
    ) {

        if (!element) {
            return "";
        }


        return normalizeText(
            [
                element.getAttribute?.(
                    "aria-label"
                ),
                element.getAttribute?.(
                    "title"
                ),
                element.getAttribute?.(
                    "data-tooltip-content"
                ),
                element.textContent
            ]
                .filter(Boolean)
                .join(" ")
        );
    }


    function isOurButton(
        element
    ) {

        if (!element) {
            return false;
        }


        const id =
            String(
                element.id ||
                ""
            );


        return (
            id ===
            VOICE_BUTTON_ID ||
            id ===
            CALL_BUTTON_ID ||
            id.startsWith(
                "__sharkord_switch_"
            ) ||
            id ===
            "__sharkord_voice_panel_switch_button" ||
            id ===
            "__sharkord_call_bar_switch_button"
        );
    }


    function parseRgb(
        value
    ) {

        const match =
            String(
                value ||
                ""
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


    function backgroundRgb(
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
            backgroundRgb(
                element
            );


        if (!rgb) {
            return false;
        }


        return (
            rgb.r >=
            145 &&
            rgb.r >
            rgb.g *
            1.30 &&
            rgb.r >
            rgb.b *
            1.15
        );
    }


    function looksActiveBlue(
        element
    ) {

        const rgb =
            backgroundRgb(
                element
            );


        if (!rgb) {
            return false;
        }


        return (
            rgb.b >=
            70 &&
            rgb.b >
            rgb.r +
            20 &&
            rgb.b >
            rgb.g +
            12
        );
    }


    function isActiveShareButton(
        button
    ) {

        if (
            !button ||
            !isVisible(
                button
            )
        ) {
            return false;
        }


        const text =
            description(
                button
            );


        const pressed =
            normalizeText(
                button.getAttribute?.(
                    "aria-pressed"
                )
            );


        const state =
            normalizeText(
                button.getAttribute?.(
                    "data-state"
                )
            );


        if (
            pressed ===
            "true"
        ) {
            return true;
        }


        if (
            [
                "active",
                "on",
                "checked"
            ].includes(
                state
            )
        ) {
            return true;
        }


        if (
            [
                "stop sharing",
                "stop share",
                "stop screen",
                "stop screenshare",
                "disable screen share",
                "turn off screen share",
                "parar compartilhamento",
                "parar transmissao",
                "encerrar compartilhamento",
                "desativar compartilhamento",
                "desligar compartilhamento"
            ].some(
                term =>
                    text.includes(
                        term
                    )
            )
        ) {
            return true;
        }


        return looksActiveBlue(
            button
        );
    }


    // ==================================================
    // CALL BAR — ÚNICA FONTE DE VERDADE
    // ==================================================

    function findDisconnectButton() {

        const candidates =
            Array.from(
                document.querySelectorAll(
                    "button, [role='button']"
                )
            );


        let winner =
            null;


        let winnerScore =
            -Infinity;


        for (
            const element
            of candidates
        ) {

            if (
                isOurButton(
                    element
                ) ||
                !isVisible(
                    element
                )
            ) {
                continue;
            }


            const rect =
                element
                    .getBoundingClientRect();


            if (
                rect.width <
                30 ||
                rect.height <
                30 ||
                rect.bottom <
                window.innerHeight *
                0.45
            ) {
                continue;
            }


            const text =
                description(
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
                    250;
            }


            if (
                [
                    "disconnect",
                    "leave",
                    "hang up",
                    "end call",
                    "desconectar",
                    "sair",
                    "encerrar chamada"
                ].some(
                    term =>
                        text.includes(
                            term
                        )
                )
            ) {
                score +=
                    150;
            }


            /*
             * A call bar real fica na metade inferior.
             */
            score +=
                rect.top /
                window.innerHeight *
                40;


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
            130
                ? winner
                : null;
    }


    function findCallBarControls() {

        const disconnect =
            findDisconnectButton();


        if (!disconnect) {
            return null;
        }


        let root =
            disconnect.parentElement;


        for (
            let depth =
                0;
            root &&
            depth <
            7;
            depth++,
            root =
                root.parentElement
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
                            isVisible(
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
                        disconnect
                );


            if (
                disconnectIndex >=
                2
            ) {

                const screen =
                    buttons[
                        disconnectIndex -
                        1
                    ].button;


                const template =
                    buttons[
                        disconnectIndex -
                        2
                    ].button;


                const screenRect =
                    screen
                        .getBoundingClientRect();


                const templateRect =
                    template
                        .getBoundingClientRect();


                /*
                 * Os controles da call bar precisam estar
                 * aproximadamente na mesma linha.
                 * Isso impede pegar botões da sidebar quando
                 * subimos demais na árvore do DOM.
                 */
                if (
                    Math.abs(
                        screenRect.top -
                        templateRect.top
                    ) <=
                    12 &&
                    Math.abs(
                        screenRect.top -
                        disconnect
                            .getBoundingClientRect()
                            .top
                    ) <=
                    18
                ) {

                    return {
                        root,
                        disconnect,
                        screen,
                        template
                    };
                }
            }
        }


        return null;
    }


    // ==================================================
    // VOICE CONNECTED — SOMENTE POSICIONAMENTO
    // ==================================================

    function findVoiceConnectedCard() {

        const elements =
            Array.from(
                document.querySelectorAll(
                    "div, section, aside"
                )
            );


        let winner =
            null;


        let winnerScore =
            -Infinity;


        for (
            const element
            of elements
        ) {

            if (
                !isVisible(
                    element
                )
            ) {
                continue;
            }


            const text =
                normalizeText(
                    element.textContent
                );


            if (
                !text.includes(
                    "voice connected"
                ) &&
                !text.includes(
                    "voz conectada"
                ) &&
                !text.includes(
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
                520 ||
                rect.height >
                220
            ) {
                continue;
            }


            const buttons =
                Array.from(
                    element.querySelectorAll(
                        "button, [role='button']"
                    )
                )
                    .filter(
                        button =>
                            !isOurButton(
                                button
                            ) &&
                            isVisible(
                                button
                            )
                    );


            if (
                buttons.length <
                2
            ) {
                continue;
            }


            let score =
                200;


            if (
                text.includes(
                    "disconnect"
                ) ||
                text.includes(
                    "desconectar"
                )
            ) {
                score +=
                    80;
            }


            /*
             * Prefere o menor container que contém o card.
             */
            score -=
                rect.width /
                15;


            score -=
                rect.height /
                10;


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


        return winner;
    }


    function findVoiceControls() {

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
                        isVisible(
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
                .filter(
                    item =>
                        item.rect.width >=
                        24 &&
                        item.rect.width <=
                        64 &&
                        item.rect.height >=
                        24 &&
                        item.rect.height <=
                        64
                )
                .sort(
                    (a, b) =>
                        a.rect.left -
                        b.rect.left
                );


        if (
            buttons.length <
            2
        ) {
            return null;
        }


        return {
            card,
            screen:
                buttons
                    .at(-1)
                    .button,
            template:
                buttons
                    .at(-2)
                    .button
        };
    }


    // ==================================================
    // ÍCONE DO SCREEN SHARE DA LATERAL ESQUERDA
    // ==================================================

    const MONITOR_ON_CONTENT =
        '<rect width="20" height="14" x="2" y="3" rx="2" ry="2"></rect>' +
        '<line x1="8" x2="16" y1="21" y2="21"></line>' +
        '<line x1="12" x2="12" y1="17" y2="21"></line>';


    function forceVoiceScreenOpenIcon() {

        const voice =
            findVoiceControls();


        const button =
            voice?.screen;


        const svg =
            button?.querySelector(
                "svg"
            );


        if (!svg) {
            return;
        }


        /*
         * Preserva o SVG nativo do Sharkord:
         * classes, width/height, stroke, linecap, etc.
         *
         * Trocamos APENAS os elementos internos do MonitorOff
         * pelos elementos do Monitor normal.
         */
        if (
            svg.getAttribute(
                "data-sharkord-monitor-on"
            ) ===
            "true" &&
            !svg.querySelector(
                'path[d*="2 2"]'
            )
        ) {
            return;
        }


        svg.innerHTML =
            MONITOR_ON_CONTENT;


        svg.setAttribute(
            "data-sharkord-monitor-on",
            "true"
        );


        /*
         * Se uma versão anterior deixou visibility:hidden,
         * revelamos imediatamente o ícone já corrigido.
         */
        svg.style.visibility =
            "";


        button.removeAttribute(
            "data-sharkord-screen-icon-pending"
        );
    }


    function setVoiceScreenIconPending(
        voiceControls,
        pending
    ) {

        const button =
            voiceControls?.screen;


        const svg =
            button?.querySelector(
                "svg"
            );


        if (!svg) {
            return;
        }


        if (pending) {

            svg.style.visibility =
                "hidden";


            button.setAttribute(
                "data-sharkord-screen-icon-pending",
                "true"
            );


            return;
        }


        svg.style.visibility =
            "";


        button.removeAttribute(
            "data-sharkord-screen-icon-pending"
        );
    }


    function syncVoiceScreenIcon(
        callControls,
        voiceControls
    ) {

        const sourceButton =
            callControls?.screen;


        const targetButton =
            voiceControls?.screen;


        if (
            !sourceButton ||
            !targetButton ||
            sourceButton ===
            targetButton
        ) {
            return;
        }


        const sourceSvg =
            sourceButton.querySelector(
                "svg"
            );


        const targetSvg =
            targetButton.querySelector(
                "svg"
            );


        if (
            !sourceSvg ||
            !targetSvg
        ) {
            return;
        }


        /*
         * O botão da lateral esquerda estava mostrando o estado
         * visual inverso. O botão da call bar é a referência
         * correta; copiamos SOMENTE o SVG dele.
         *
         * Nenhum handler, classe, estado React ou comportamento
         * do botão esquerdo é alterado.
         */
        const sourceMarkup =
            sourceSvg.outerHTML;


        /*
         * Comparamos o SVG que está REALMENTE renderizado.
         *
         * O React pode reconstruir o botão esquerdo depois que
         * fazemos a troca. A versão anterior guardava uma flag
         * no botão e, quando isso acontecia, acreditava que o
         * ícone ainda estava correto.
         *
         * Agora, se o React recolocar o ícone invertido, o
         * MutationObserver chama refreshButtons() e corrigimos
         * novamente.
         */
        if (
            targetSvg.outerHTML ===
            sourceMarkup
        ) {
            return;
        }


        const clone =
            sourceSvg.cloneNode(
                true
            );


        clone.style.visibility =
            "";


        targetSvg.replaceWith(
            clone
        );


        targetButton.removeAttribute(
            "data-sharkord-screen-icon-pending"
        );
    }


    // ==================================================
    // CLONE VISUAL EXATO, SEM CLONAR DOM NATIVO
    // ==================================================

    function copyComputedStyle(
        source,
        target
    ) {

        const style =
            getComputedStyle(
                source
            );


        for (
            const property
            of style
        ) {

            try {

                target.style.setProperty(
                    property,
                    style.getPropertyValue(
                        property
                    ),
                    style.getPropertyPriority(
                        property
                    )
                );

            } catch {}
        }
    }


    function getNativeIconSize(
        template
    ) {

        const graphic =
            template.querySelector(
                "svg"
            );


        if (!graphic) {

            return {
                width:
                    18,
                height:
                    18
            };
        }


        const rect =
            graphic
                .getBoundingClientRect();


        const width =
            rect.width >=
            12 &&
            rect.width <=
            28
                ? rect.width
                : 18;


        const height =
            rect.height >=
            12 &&
            rect.height <=
            28
                ? rect.height
                : 18;


        return {
            width,
            height
        };
    }


    function buildSwitchButton(
        template,
        id,
        locationName
    ) {

        /*
         * Elemento NOVO.
         * Nada de cloneNode(), classes internas, masks ou
         * pseudo-elementos do botão de câmera/screen share.
         */
        const button =
            document.createElement(
                "button"
            );


        copyComputedStyle(
            template,
            button
        );


        const templateRect =
            template
                .getBoundingClientRect();


        /*
         * getComputedStyle já traz as dimensões computadas,
         * mas fixamos o border-box observado para evitar que
         * flex-shrink altere o botão depois da inserção.
         */
        button.style.width =
            templateRect.width +
            "px";


        button.style.height =
            templateRect.height +
            "px";


        button.style.minWidth =
            templateRect.width +
            "px";


        button.style.minHeight =
            templateRect.height +
            "px";


        button.style.maxWidth =
            templateRect.width +
            "px";


        button.style.maxHeight =
            templateRect.height +
            "px";


        button.style.flexShrink =
            "0";


        button.style.boxSizing =
            "border-box";


        button.style.display =
            "inline-flex";


        button.style.alignItems =
            "center";


        button.style.justifyContent =
            "center";


        button.style.lineHeight =
            "0";


        button.style.cursor =
            "pointer";


        button.style.pointerEvents =
            "auto";


        button.style.transform =
            "none";


        button.id =
            id;


        button.type =
            "button";


        button.disabled =
            false;


        button.setAttribute(
            "aria-label",
            "Trocar tela"
        );


        button.setAttribute(
            "title",
            "Trocar tela"
        );


        button.setAttribute(
            "data-sharkord-screen-switch",
            locationName
        );


        const holder =
            document.createElement(
                "div"
            );


        holder.innerHTML =
            SWITCH_ICON;


        const svg =
            holder.firstElementChild;


        const iconSize =
            getNativeIconSize(
                template
            );


        if (svg) {

            svg.setAttribute(
                "width",
                String(
                    iconSize.width
                )
            );


            svg.setAttribute(
                "height",
                String(
                    iconSize.height
                )
            );


            svg.style.width =
                iconSize.width +
                "px";


            svg.style.height =
                iconSize.height +
                "px";


            svg.style.display =
                "block";


            svg.style.flex =
                "0 0 auto";


            svg.style.pointerEvents =
                "none";


            button.appendChild(
                svg
            );
        }


        button.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();


                void switchSource();
            },
            true
        );


        console.log(
            "[ScreenShare Button V2] criado:",
            {
                location:
                    locationName,
                button:
                    {
                        width:
                            Math.round(
                                templateRect.width
                            ),
                        height:
                            Math.round(
                                templateRect.height
                            )
                    },
                icon:
                    {
                        width:
                            Math.round(
                                iconSize.width
                            ),
                        height:
                            Math.round(
                                iconSize.height
                            )
                    }
            }
        );


        return button;
    }


    function removeButton(
        id
    ) {

        document
            .getElementById(
                id
            )
            ?.remove();
    }


    function removeButtons() {

        removeButton(
            VOICE_BUTTON_ID
        );


        removeButton(
            CALL_BUTTON_ID
        );
    }


    function installAt(
        controls,
        id,
        locationName
    ) {

        if (
            !controls ||
            !controls.screen ||
            !controls.template
        ) {

            removeButton(
                id
            );


            return false;
        }


        const parent =
            controls.screen
                .parentElement;


        if (!parent) {

            removeButton(
                id
            );


            return false;
        }


        const existing =
            document
                .getElementById(
                    id
                );


        if (
            existing?.isConnected &&
            existing.parentElement ===
            parent &&
            existing.nextElementSibling ===
            controls.screen
        ) {

            const existingRect =
                existing
                    .getBoundingClientRect();


            const templateRect =
                controls.template
                    .getBoundingClientRect();


            if (
                Math.abs(
                    existingRect.width -
                    templateRect.width
                ) <
                0.6 &&
                Math.abs(
                    existingRect.height -
                    templateRect.height
                ) <
                0.6
            ) {
                return true;
            }
        }


        existing?.remove();


        const button =
            buildSwitchButton(
                controls.template,
                id,
                locationName
            );


        parent.insertBefore(
            button,
            controls.screen
        );


        return true;
    }


    function bindNativeScreenButton(
        controls
    ) {

        const button =
            controls?.screen;


        if (
            !button ||
            button
                .__sharkordShareStateTrackingV2
        ) {
            return;
        }


        button
            .__sharkordShareStateTrackingV2 =
            true;


        button.addEventListener(
            "click",
            () => {

                /*
                 * Se já estávamos compartilhando, um clique no
                 * controle nativo é STOP. Quando não estamos,
                 * o mesmo botão é START; nesse caso quem confirma
                 * o início é o main/screen-share.js após a captura.
                 */
                if (
                    getLocalSharingState()
                ) {

                    setLocalSharingState(
                        false,
                        switching
                            ? "switch-stop"
                            : "native-stop"
                    );


                    queueRefresh();
                }
            },
            true
        );
    }


    function refreshButtons() {

        refreshTimer =
            null;


        if (switching) {
            return;
        }


        const call =
            findCallBarControls();


        let sharing =
            getLocalSharingState();


        /*
         * Se a call bar some por tempo suficiente (leave/disconnect),
         * encerra também nosso estado local. Um pequeno grace period
         * evita falso STOP durante uma reconstrução rápida do React.
         */
        if (
            sharing &&
            !call
        ) {

            if (!missingCallSince) {

                missingCallSince =
                    Date.now();
            }


            if (
                Date.now() -
                missingCallSince >=
                1200
            ) {

                setLocalSharingState(
                    false,
                    "call-bar-disappeared"
                );


                sharing =
                    false;


                missingCallSince =
                    0;
            }

        } else {

            missingCallSince =
                0;
        }


        if (
            call
        ) {

            bindNativeScreenButton(
                call
            );
        }


        /*
         * CORREÇÃO VISUAL INDEPENDENTE DO ESTADO DE SHARE:
         *
         * O botão nativo da lateral esquerda estava mostrando
         * o ícone inverso. A call bar é a referência visual.
         *
         * Isso precisa rodar ANTES do return abaixo, porque o
         * estado interno do botão custom pode estar false mesmo
         * enquanto a call bar continua renderizada.
         */
        const voice =
            findVoiceControls();


        if (
            voice &&
            !call
        ) {

            /*
             * A lateral esquerda monta antes da call bar.
             * Corrigimos o MonitorOff imediatamente, sem esperar
             * a referência da direita.
             */
            forceVoiceScreenOpenIcon();
        }


        if (
            call &&
            voice
        ) {

            syncVoiceScreenIcon(
                call,
                voice
            );


            setVoiceScreenIconPending(
                voice,
                false
            );
        }


        if (
            sharing !==
            lastKnownSharing
        ) {

            lastKnownSharing =
                sharing;


            console.log(
                "[ScreenShare Button V2] sharingScreen real:",
                sharing
            );
        }


        if (
            !sharing ||
            !call
        ) {

            removeButtons();


            return;
        }


        installAt(
            call,
            CALL_BUTTON_ID,
            "call-bar"
        );


        installAt(
            voice,
            VOICE_BUTTON_ID,
            "voice-connected"
        );
    }


    function queueRefresh() {

        if (
            refreshTimer
        ) {
            return;
        }


        refreshTimer =
            setTimeout(
                refreshButtons,
                40
            );
    }


    // ==================================================
    // TROCA — SEM USAR O BOTÃO DA SIDEBAR PARA ESTADO
    // ==================================================

    async function chooseNextSource() {

        const api =
            window
                .electronScreenShare;


        if (
            !api ||
            typeof api.chooseSource !==
            "function"
        ) {

            throw new Error(
                "electronScreenShare.chooseSource indisponível"
            );
        }


        try {

            return await api
                .chooseSource();

        } catch (error) {

            const message =
                error?.message ||
                String(
                    error
                );


            if (
                message.includes(
                    "SCREEN_SHARE_CANCELLED"
                )
            ) {
                return null;
            }


            throw error;
        }
    }


    async function waitForScreenControlRebuild(
        previousButton,
        timeoutMs
    ) {

        const deadline =
            Date.now() +
            timeoutMs;


        while (
            Date.now() <
            deadline
        ) {

            const controls =
                findCallBarControls();


            if (
                controls?.screen &&
                (
                    controls.screen !==
                    previousButton ||
                    !previousButton?.isConnected
                )
            ) {

                return controls;
            }


            await delay(
                100
            );
        }


        /*
         * Alguns builds do React reaproveitam o mesmo nó.
         * Depois do timeout curto, aceitamos o controle atual.
         */
        const fallback =
            findCallBarControls();


        if (
            fallback?.screen
        ) {
            return fallback;
        }


        throw new Error(
            "controle de screen share não reapareceu"
        );
    }


    async function waitForRealSharing(
        active,
        timeoutMs
    ) {

        const deadline =
            Date.now() +
            timeoutMs;


        while (
            Date.now() <
            deadline
        ) {

            if (
                getLocalSharingState() ===
                active
            ) {
                return true;
            }


            await delay(
                100
            );
        }


        throw new Error(
            active
                ? "main não confirmou início do screen share"
                : "screen share não confirmou parada"
        );
    }


    async function switchSource() {

        if (switching) {
            return;
        }


        const initial =
            findCallBarControls();


        if (
            !initial ||
            !getLocalSharingState()
        ) {

            console.warn(
                "[ScreenShare Button V2] troca ignorada: share local não está ativo."
            );


            queueRefresh();


            return;
        }


        switching =
            true;


        try {

            console.log(
                "[ScreenShare Button V2] abrindo picker antes do stop."
            );


            const selection =
                await chooseNextSource();


            if (
                !selection ||
                !selection.sourceId
            ) {

                console.log(
                    "[ScreenShare Button V2] troca cancelada; share atual mantido."
                );


                return;
            }


            console.log(
                "[ScreenShare Button V2] fonte preparada:",
                selection
            );


            const beforeStop =
                findCallBarControls();


            if (
                !beforeStop ||
                !getLocalSharingState()
            ) {

                throw new Error(
                    "controle da call bar desapareceu antes do stop"
                );
            }


            /*
             * Remove o custom antes do React reconstruir a barra.
             * Assim não deixamos um filho estranho no meio da
             * reconciliação do componente nativo.
             */
            removeButtons();


            const oldScreenButton =
                beforeStop.screen;


            oldScreenButton
                .click();


            /*
             * O listener do próprio botão marca nosso estado como
             * false imediatamente. O que precisamos esperar aqui é
             * o React terminar de reconstruir/habilitar o controle.
             */
            await waitForRealSharing(
                false,
                1200
            );


            const inactive =
                await waitForScreenControlRebuild(
                    oldScreenButton,
                    1800
                );


            await delay(
                250
            );


            console.log(
                "[ScreenShare Button V2] reiniciando pelo controle nativo da call bar."
            );


            inactive
                .screen
                .click();


            /*
             * O main só publica TRUE depois que o Chromium aceitou
             * a fonte pré-selecionada no getDisplayMedia.
             */
            await waitForRealSharing(
                true,
                6500
            );


            console.log(
                "[ScreenShare Button V2] troca concluída."
            );

        } catch (error) {

            console.error(
                "[ScreenShare Button V2] troca falhou:",
                error
            );

        } finally {

            switching =
                false;


            queueRefresh();
        }
    }


    // ==================================================
    // START
    // ==================================================

    for (
        const id
        of LEGACY_IDS
    ) {

        document
            .getElementById(
                id
            )
            ?.remove();
    }


    window.addEventListener(
        SHARE_STATE_EVENT,
        event => {

            console.log(
                "[ScreenShare Button V2] evento de estado recebido:",
                event?.detail ||
                {}
            );


            queueRefresh();
        }
    );


    const observer =
        new MutationObserver(
            () => {

                /*
                 * MutationObserver roda antes do próximo paint.
                 * A correção visual não passa pelo debounce de 40ms,
                 * evitando o frame inicial com MonitorOff.
                 */
                forceVoiceScreenOpenIcon();


                queueRefresh();
            }
        );


    observer.observe(
        document.documentElement,
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


    setInterval(
        queueRefresh,
        650
    );


    forceVoiceScreenOpenIcon();


    queueRefresh();


    console.log(
        "[ScreenShare Button V2] módulo instalado — MonitorOff esquerdo corrigido antes do paint."
    );

})();
`;


        try {

            await mainWindow
                .webContents
                .executeJavaScript(
                    code,
                    true
                );

        } catch (error) {

            console.error(
                "[ScreenShare Button V2] falha ao injetar:",
                error
            );
        }
    };


    mainWindow
        .webContents
        .on(
            "did-finish-load",
            () => {

                void inject();
            }
        );


    mainWindow
        .webContents
        .on(
            "did-navigate-in-page",
            () => {

                setTimeout(
                    () => {

                        void inject();
                    },
                    150
                );
            }
        );


    if (
        !mainWindow
            .webContents
            .isLoading()
    ) {

        void inject();
    }
}


module.exports = {
    installScreenShareUi
};
