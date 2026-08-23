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

    if (
        window.__sharkordScreenSwitchV6
    ) {
        return;
    }


    window.__sharkordScreenSwitchV6 =
        true;


    const VOICE_BUTTON_ID =
        "__sharkord_switch_voice_v6";


    const CALL_BUTTON_ID =
        "__sharkord_switch_call_v6";


    /*
     * Remove resíduos de versões anteriores caso o renderer
     * tenha sido recarregado sem encerrar o processo inteiro.
     */
    document
        .getElementById(
            "__sharkord_switch_voice_v3"
        )
        ?.remove();


    document
        .getElementById(
            "__sharkord_switch_call_v3"
        )
        ?.remove();


    document
        .getElementById(
            "__sharkord_switch_voice_v4"
        )
        ?.remove();


    document
        .getElementById(
            "__sharkord_switch_call_v4"
        )
        ?.remove();


    document
        .getElementById(
            "__sharkord_switch_voice_v5"
        )
        ?.remove();


    document
        .getElementById(
            "__sharkord_switch_call_v5"
        )
        ?.remove();


    const SWITCH_ICON =
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect x="2.75" y="4" width="12.5" height="9.25" rx="1.6" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M6.5 16H11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M9 13.5V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<rect x="10.25" y="10.25" width="11" height="8.25" rx="1.5" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M13 14.35H18.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M16.2 12.45L18.35 14.35L16.2 16.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>;


    let switching =
        false;


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


    function isOurButton(
        element
    ) {

        return Boolean(
            element &&
            (
                element.id ===
                VOICE_BUTTON_ID ||
                element.id ===
                CALL_BUTTON_ID
            )
        );
    }


    function isVisible(
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
            "hidden" &&
            Number(style.opacity || 1) >
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


    function getBackgroundRgb(
        element
    ) {

        try {

            const value =
                getComputedStyle(
                    element
                ).backgroundColor;


            const match =
                String(value).match(
                    /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/
                );


            if (!match) {
                return null;
            }


            return {
                r:
                    Number(match[1]),

                g:
                    Number(match[2]),

                b:
                    Number(match[3])
            };

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


    function looksBlue(
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
            rgb.b >= 90 &&
            rgb.b >
            rgb.r + 30 &&
            rgb.b >
            rgb.g + 18
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


        const ariaPressed =
            button.getAttribute?.(
                "aria-pressed"
            );


        const dataState =
            normalizeText(
                button.getAttribute?.(
                    "data-state"
                )
            );


        if (
            ariaPressed ===
            "true"
        ) {
            return true;
        }


        if (
            [
                "on",
                "active",
                "checked",
                "open"
            ].includes(
                dataState
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
                "parar compartilhamento",
                "parar transmissao",
                "encerrar compartilhamento",
                "interromper compartilhamento"
            ].some(
                term =>
                    text.includes(
                        term
                    )
            )
        ) {
            return true;
        }


        /*
         * No Sharkord o controle ativo de screen share recebe
         * fundo azul. O controle inativo é cinza.
         */
        return looksBlue(
            button
        );
    }


    function findNeutralTemplate(
        parent,
        activeButton
    ) {

        if (
            !parent ||
            !activeButton
        ) {
            return null;
        }


        const activeRect =
            activeButton.getBoundingClientRect();


        const candidates =
            Array.from(
                parent.querySelectorAll(
                    "button, [role='button']"
                )
            )
                .filter(
                    candidate => {

                        if (
                            candidate ===
                            activeButton ||
                            isOurButton(
                                candidate
                            ) ||
                            !isVisible(
                                candidate
                            ) ||
                            looksRed(
                                candidate
                            ) ||
                            looksBlue(
                                candidate
                            )
                        ) {
                            return false;
                        }


                        const rect =
                            candidate.getBoundingClientRect();


                        return (
                            rect.width >=
                            26 &&
                            rect.width <=
                            64 &&
                            rect.height >=
                            26 &&
                            rect.height <=
                            64
                        );
                    }
                )
                .map(
                    candidate => {

                        const rect =
                            candidate.getBoundingClientRect();


                        return {
                            candidate,

                            distance:
                                Math.abs(
                                    rect.width -
                                    activeRect.width
                                ) +
                                Math.abs(
                                    rect.height -
                                    activeRect.height
                                )
                        };
                    }
                )
                .sort(
                    (a, b) =>
                        a.distance -
                        b.distance
                );


        return candidates[0]
            ?.candidate ||
            null;
    }


    // ==================================================
    // CALL BAR
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
                !isVisible(
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
                    200;
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


    function findCallBarShareButton() {

        const disconnect =
            findCallBarDisconnectButton();


        if (!disconnect) {
            return null;
        }


        let root =
            disconnect.parentElement;


        for (
            let depth = 0;
            root &&
            depth < 7;
            depth++,
            root = root.parentElement
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
                                button.getBoundingClientRect()
                        })
                    )
                    .sort(
                        (a, b) =>
                            a.rect.left -
                            b.rect.left
                    );


            const index =
                buttons.findIndex(
                    item =>
                        item.button ===
                        disconnect
                );


            if (
                index >
                0
            ) {

                return buttons[
                    index - 1
                ].button;
            }
        }


        return null;
    }


    // ==================================================
    // VOICE CONNECTED
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
                element.getBoundingClientRect();


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


            let score =
                100;


            if (
                buttons.length >=
                2
            ) {
                score +=
                    50;
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


    function findVoiceShareButton() {

        const card =
            findVoiceConnectedCard();


        if (!card) {
            return null;
        }


        const smallButtons =
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
                            button.getBoundingClientRect()
                    })
                )
                .filter(
                    item =>
                        item.rect.width <=
                        64 &&
                        item.rect.height <=
                        64
                )
                .sort(
                    (a, b) =>
                        a.rect.left -
                        b.rect.left
                );


        return smallButtons
            .at(-1)
            ?.button ||
            null;
    }


    // ==================================================
    // BOTÃO VISUAL
    // ==================================================

    function copyExactGeometry(
        button,
        template
    ) {

        const rect =
            template.getBoundingClientRect();


        const style =
            getComputedStyle(
                template
            );


        button.style.width =
            rect.width + "px";


        button.style.height =
            rect.height + "px";


        button.style.minWidth =
            rect.width + "px";


        button.style.minHeight =
            rect.height + "px";


        button.style.maxWidth =
            rect.width + "px";


        button.style.maxHeight =
            rect.height + "px";


        button.style.flex =
            "0 0 " +
            rect.width +
            "px";


        button.style.padding =
            style.padding;


        button.style.margin =
            style.margin;


        button.style.borderRadius =
            style.borderRadius;


        button.style.display =
            "inline-flex";


        button.style.alignItems =
            "center";


        button.style.justifyContent =
            "center";


        button.style.lineHeight =
            "0";


        button.style.boxSizing =
            "border-box";


        button.style.cursor =
            "pointer";


        /*
         * Evita que classes de estado/animação alterem a escala
         * do botão clonado.
         */
        button.style.transform =
            "none";


        button.style.scale =
            "1";


        button.style.position =
            style.position ===
            "absolute"
                ? "relative"
                : style.position;


        button.style.inset =
            "auto";
    }


    function replaceNativeIcon(
        button,
        source
    ) {

        const sourceSvg =
            source.querySelector?.(
                "svg"
            );


        const clonedSvg =
            button.querySelector?.(
                "svg"
            );


        const holder =
            document.createElement(
                "div"
            );


        holder.innerHTML =
            SWITCH_ICON;


        const switchSvg =
            holder.firstElementChild;


        if (!switchSvg) {
            return;
        }


        if (sourceSvg) {

            const sourceSvgStyle =
                getComputedStyle(
                    sourceSvg
                );


            const sourceClass =
                sourceSvg.getAttribute(
                    "class"
                );


            if (sourceClass) {

                switchSvg.setAttribute(
                    "class",
                    sourceClass
                );
            }


            const nativeWidth =
                sourceSvg.getAttribute(
                    "width"
                );


            const nativeHeight =
                sourceSvg.getAttribute(
                    "height"
                );


            if (nativeWidth) {

                switchSvg.setAttribute(
                    "width",
                    nativeWidth
                );
            }


            if (nativeHeight) {

                switchSvg.setAttribute(
                    "height",
                    nativeHeight
                );
            }


            switchSvg.style.width =
                sourceSvgStyle.width;


            switchSvg.style.height =
                sourceSvgStyle.height;


            switchSvg.style.display =
                sourceSvgStyle.display ===
                "none"
                    ? "block"
                    : sourceSvgStyle.display;


            switchSvg.style.flexShrink =
                "0";


            switchSvg.style.transform =
                "none";
        }


        if (clonedSvg) {

            clonedSvg.replaceWith(
                switchSvg
            );


            return;
        }


        /*
         * Fallback raro: se o botão nativo não usar SVG,
         * mantemos o próprio container e colocamos o ícone nele.
         */
        const content =
            button.firstElementChild ||
            button;


        content.replaceChildren(
            switchSvg
        );
    }


    function makeSwitchButton({
        id,
        stopButton,
        template,
        locator,
        locationName
    }) {

        const source =
            template ||
            stopButton;


        const button =
            source.cloneNode(
                true
            );


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
            "true"
        );


        button.classList.add(
            "__sharkord-screen-switch-button"
        );


        replaceNativeIcon(
            button,
            source
        );


        /*
         * Alguns botões nativos carregam texto auxiliar oculto
         * ("desativar tela", etc.). Removemos apenas nós de texto
         * do clone para o botão custom não herdar semântica errada.
         */
        const walker =
            document.createTreeWalker(
                button,
                NodeFilter.SHOW_TEXT
            );


        const textNodes =
            [];


        while (
            walker.nextNode()
        ) {

            textNodes.push(
                walker.currentNode
            );
        }


        for (
            const textNode
            of textNodes
        ) {

            if (
                textNode.textContent?.trim()
            ) {

                textNode.textContent =
                    "";
            }
        }


        copyExactGeometry(
            button,
            source
        );


        const sourceStyle =
            getComputedStyle(
                source
            );


        button.style.background =
            sourceStyle.background;


        button.style.backgroundColor =
            sourceStyle.backgroundColor;


        button.style.color =
            sourceStyle.color;


        button.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();


                void switchSource(
                    locator,
                    locationName
                );
            },
            true
        );


        return button;
    }


    function setButtonsBusy(
        busy
    ) {

        for (
            const id
            of [
                VOICE_BUTTON_ID,
                CALL_BUTTON_ID
            ]
        ) {

            const button =
                document.getElementById(
                    id
                );


            if (button) {

                button.disabled =
                    busy;


                button.style.opacity =
                    busy
                        ? "0.55"
                        : "";
            }
        }
    }


    // ==================================================
    // TROCA — PICKER PRIMEIRO
    // ==================================================

    async function switchSource(
        locator,
        locationName
    ) {

        if (switching) {
            return;
        }


        const api =
            window.electronScreenShare;


        if (
            !api ||
            typeof api.chooseSource !==
            "function"
        ) {

            console.error(
                "[ScreenShare UI V6] electronScreenShare.chooseSource indisponível."
            );


            return;
        }


        switching =
            true;


        setButtonsBusy(
            true
        );


        try {

            console.log(
                "[ScreenShare UI V6] abrindo picker ANTES de parar:",
                locationName
            );


            let selection =
                null;


            try {

                selection =
                    await api.chooseSource();

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

                    console.log(
                        "[ScreenShare UI V6] troca cancelada; share atual mantido."
                    );


                    return;
                }


                throw error;
            }


            if (
                !selection ||
                !selection.sourceId
            ) {

                console.log(
                    "[ScreenShare UI V6] picker não retornou fonte; share atual mantido."
                );


                return;
            }


            console.log(
                "[ScreenShare UI V6] fonte preparada:",
                selection
            );


            const stopButton =
                locator();


            if (!stopButton) {

                throw new Error(
                    "controle nativo de screen share não encontrado após o picker"
                );
            }


            /*
             * Agora sim encerramos a transmissão atual.
             * O picker já terminou, então a desmontagem do React
             * não consegue cancelar a seleção.
             */
            stopButton.click();


            const oldButton =
                stopButton;


            const startedAt =
                Date.now();


            let startButton =
                null;


            /*
             * Espera o React concluir a transição para sharingScreen=false.
             * Não usamos apenas um delay curto: esperamos o nó mudar,
             * desaparecer/reaparecer, ou pelo menos 850ms.
             */
            while (
                Date.now() -
                startedAt <
                3500
            ) {

                await delay(
                    100
                );


                const candidate =
                    locator();


                if (!candidate) {
                    continue;
                }


                const elapsed =
                    Date.now() -
                    startedAt;


                if (
                    (
                        candidate !==
                        oldButton ||
                        !oldButton.isConnected
                    ) &&
                    elapsed >=
                    350
                ) {

                    startButton =
                        candidate;

                    break;
                }


                if (
                    elapsed >=
                    850
                ) {

                    startButton =
                        candidate;

                    break;
                }
            }


            if (!startButton) {

                throw new Error(
                    "controle nativo não ficou pronto para reiniciar"
                );
            }


            /*
             * Pequena margem depois da atualização visual.
             */
            await delay(
                250
            );


            console.log(
                "[ScreenShare UI V6] reiniciando com fonte pré-selecionada."
            );


            startButton.click();

        } catch (error) {

            console.error(
                "[ScreenShare UI V6] troca falhou:",
                error
            );

        } finally {

            await delay(
                350
            );


            switching =
                false;


            setButtonsBusy(
                false
            );


            installButtons();
        }
    }


    // ==================================================
    // INSTALAÇÃO — VOICE CONNECTED
    // ==================================================

    function installVoiceButton() {

        const stopButton =
            findVoiceShareButton();


        if (!stopButton) {

            document
                .getElementById(
                    VOICE_BUTTON_ID
                )
                ?.remove();


            return false;
        }


        if (
            !isActiveShareButton(
                stopButton
            )
        ) {

            document
                .getElementById(
                    VOICE_BUTTON_ID
                )
                ?.remove();


            return false;
        }


        const parent =
            stopButton.parentElement;


        if (!parent) {
            return false;
        }


        const existing =
            document.getElementById(
                VOICE_BUTTON_ID
            );


        if (
            existing?.isConnected &&
            existing.parentElement ===
            parent &&
            existing.nextElementSibling ===
            stopButton
        ) {
            return true;
        }


        existing?.remove();


        const template =
            findNeutralTemplate(
                parent,
                stopButton
            );


        if (!template) {

            console.warn(
                "[ScreenShare UI V6] nenhum botão neutro encontrado no Voice Connected."
            );


            return false;
        }


        const button =
            makeSwitchButton({
                id:
                    VOICE_BUTTON_ID,

                stopButton,

                template,

                locator:
                    findVoiceShareButton,

                locationName:
                    "voice-connected"
            });


        parent.insertBefore(
            button,
            stopButton
        );


        console.log(
            "[ScreenShare UI V6] botão instalado no Voice Connected."
        );


        return true;
    }


    // ==================================================
    // INSTALAÇÃO — CALL BAR
    // ==================================================

    function installCallButton() {

        const stopButton =
            findCallBarShareButton();


        if (!stopButton) {

            document
                .getElementById(
                    CALL_BUTTON_ID
                )
                ?.remove();


            return false;
        }


        if (
            !isActiveShareButton(
                stopButton
            )
        ) {

            document
                .getElementById(
                    CALL_BUTTON_ID
                )
                ?.remove();


            return false;
        }


        const parent =
            stopButton.parentElement;


        if (!parent) {
            return false;
        }


        const existing =
            document.getElementById(
                CALL_BUTTON_ID
            );


        if (
            existing?.isConnected &&
            existing.parentElement ===
            parent &&
            existing.nextElementSibling ===
            stopButton
        ) {
            return true;
        }


        existing?.remove();


        const template =
            findNeutralTemplate(
                parent,
                stopButton
            );


        if (!template) {

            console.warn(
                "[ScreenShare UI V6] nenhum botão neutro encontrado na call bar."
            );


            return false;
        }


        const button =
            makeSwitchButton({
                id:
                    CALL_BUTTON_ID,

                stopButton,

                template,

                locator:
                    findCallBarShareButton,

                locationName:
                    "call-bar"
            });


        parent.insertBefore(
            button,
            stopButton
        );


        console.log(
            "[ScreenShare UI V6] botão instalado na call bar."
        );


        return true;
    }


    function installButtons() {

        if (switching) {
            return;
        }


        installVoiceButton();

        installCallButton();
    }


    const observer =
        new MutationObserver(
            () => {

                installButtons();
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
        installButtons,
        650
    );


    installButtons();


    console.log(
        "[ScreenShare UI V6] módulo instalado — ícone de troca independente do estado nativo."
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
                "[ScreenShare UI V6] falha ao injetar:",
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
