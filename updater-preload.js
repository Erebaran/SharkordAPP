const {
    ipcRenderer
} = require("electron");


// ======================================================
// SHARKORD UPDATER UI
// ======================================================

(() => {

    const BUTTON_ID =
        "sharkord-desktop-update-button";


    const STYLE_ID =
        "sharkord-desktop-update-style";


    let updaterState =
        null;


    let creating =
        false;


    // ==================================================
    // CSS
    // ==================================================

    function installStyle() {

        if (
            document.getElementById(
                STYLE_ID
            )
        ) {

            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            STYLE_ID;


        style.textContent = `
            #${BUTTON_ID} {
                position: fixed;

                /*
                 * Barra superior do Sharkord.
                 *
                 * Ajustaremos automaticamente a posição
                 * horizontal para o centro da janela.
                 */
                top: 48px;
                left: 50%;

                transform: translateX(-50%);

                z-index: 2147483647;

                height: 32px;
                min-width: 32px;

                padding: 0 10px;

                border: 0;
                border-radius: 7px;

                display: flex;
                align-items: center;
                justify-content: center;
                gap: 7px;

                font-family:
                    Inter,
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                font-size: 13px;
                font-weight: 500;

                color: #c9c9c9;

                background:
                    rgba(
                        28,
                        28,
                        28,
                        0.88
                    );

                cursor: pointer;

                user-select: none;

                box-sizing: border-box;

                transition:
                    background 120ms ease,
                    color 120ms ease,
                    opacity 120ms ease;
            }


            #${BUTTON_ID}:hover {
                background:
                    rgba(
                        48,
                        48,
                        48,
                        0.95
                    );

                color: #ffffff;
            }


            #${BUTTON_ID}:active {
                transform:
                    translateX(-50%)
                    scale(0.96);
            }


            #${BUTTON_ID}[data-disabled="true"] {
                cursor: default;
                opacity: 0.75;
            }


            #${BUTTON_ID}
            .sharkord-update-icon {
                width: 17px;
                height: 17px;

                display: flex;
                align-items: center;
                justify-content: center;

                font-size: 19px;
                line-height: 17px;
            }


            #${BUTTON_ID}
            .sharkord-update-text {
                white-space: nowrap;
            }


            #${BUTTON_ID}[data-compact="true"]
            .sharkord-update-text {
                display: none;
            }


            #${BUTTON_ID}[data-spinning="true"]
            .sharkord-update-icon {
                animation:
                    sharkord-update-spin
                    900ms
                    linear
                    infinite;
            }


            @keyframes sharkord-update-spin {

                from {
                    transform:
                        rotate(0deg);
                }

                to {
                    transform:
                        rotate(360deg);
                }
            }
        `;


        document.head.appendChild(
            style
        );
    }


    // ==================================================
    // ESTADO VISUAL
    // ==================================================

    function setButtonContent(
        button,
        {
            icon = "↻",
            text = "",
            spinning = false,
            disabled = false,
            compact = false,
            title = ""
        }
    ) {

        button.dataset.spinning =
            spinning
                ? "true"
                : "false";


        button.dataset.disabled =
            disabled
                ? "true"
                : "false";


        button.dataset.compact =
            compact
                ? "true"
                : "false";


        button.title =
            title ||
            text ||
            "Atualizações";


        button.innerHTML = `
            <span
                class="sharkord-update-icon"
            >${icon}</span>

            <span
                class="sharkord-update-text"
            >${text}</span>
        `;
    }


    function renderState(
        state
    ) {

        updaterState =
            state;


        const button =
            document.getElementById(
                BUTTON_ID
            );


        if (
            !button
        ) {

            return;
        }


        const status =
            state?.status ||
            "idle";


        switch (
            status
            ) {

            // ==========================================
            // DESENVOLVIMENTO
            // ==========================================

            case "development":

                setButtonContent(
                    button,
                    {
                        icon:
                            "↻",

                        text:
                            "",

                        compact:
                            true,

                        title:
                            "Atualizações disponíveis apenas no aplicativo instalado."
                    }
                );

                break;


            // ==========================================
            // VERIFICANDO
            // ==========================================

            case "checking":

                setButtonContent(
                    button,
                    {
                        icon:
                            "↻",

                        text:
                            "Verificando...",

                        spinning:
                            true,

                        disabled:
                            true,

                        title:
                            "Verificando atualizações..."
                    }
                );

                break;


            // ==========================================
            // ATUALIZAÇÃO DISPONÍVEL
            // ==========================================

            case "available":

                setButtonContent(
                    button,
                    {
                        icon:
                            "↓",

                        text:
                            state.availableVersion
                                ? `Baixar v${state.availableVersion}`
                                : "Baixar atualização",

                        title:
                            "Nova atualização disponível."
                    }
                );

                break;


            // ==========================================
            // DOWNLOAD
            // ==========================================

            case "downloading": {

                const percent =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            Number(
                                state.percent ||
                                0
                            )
                        )
                    );


                setButtonContent(
                    button,
                    {
                        icon:
                            "↓",

                        text:
                            `${percent.toFixed(0)}%`,

                        disabled:
                            true,

                        title:
                            `Baixando atualização: ${percent.toFixed(1)}%`
                    }
                );

                break;
            }


            // ==========================================
            // PRONTO
            // ==========================================

            case "downloaded":

                setButtonContent(
                    button,
                    {
                        icon:
                            "↻",

                        text:
                            "Reiniciar",

                        title:
                            "Atualização pronta. Clique para reiniciar e instalar."
                    }
                );

                break;


            // ==========================================
            // INSTALANDO
            // ==========================================

            case "installing":

                setButtonContent(
                    button,
                    {
                        icon:
                            "↻",

                        text:
                            "Instalando...",

                        spinning:
                            true,

                        disabled:
                            true,

                        title:
                            "Instalando atualização..."
                    }
                );

                break;


            // ==========================================
            // ATUALIZADO
            // ==========================================

            case "up-to-date":

                setButtonContent(
                    button,
                    {
                        icon:
                            "✓",

                        text:
                            "",

                        compact:
                            true,

                        title:
                            `Sharkord está atualizado${
                                state.currentVersion
                                    ? ` — v${state.currentVersion}`
                                    : ""
                            }`
                    }
                );


                /*
                 * Depois de alguns segundos volta
                 * para o ícone normal.
                 */

                setTimeout(
                    () => {

                        if (
                            updaterState?.status ===
                            "up-to-date"
                        ) {

                            updaterState = {
                                ...updaterState,
                                status:
                                    "idle"
                            };


                            renderState(
                                updaterState
                            );
                        }

                    },
                    3500
                );

                break;


            // ==========================================
            // ERRO
            // ==========================================

            case "error":

                setButtonContent(
                    button,
                    {
                        icon:
                            "!",

                        text:
                            "",

                        compact:
                            true,

                        title:
                            state.error
                                ? `Erro ao atualizar: ${state.error}`
                                : "Erro verificando atualização."
                    }
                );

                break;


            // ==========================================
            // IDLE
            // ==========================================

            case "idle":
            default:

                setButtonContent(
                    button,
                    {
                        icon:
                            "↻",

                        text:
                            "",

                        compact:
                            true,

                        title:
                            state?.currentVersion
                                ? `Verificar atualizações — v${state.currentVersion}`
                                : "Verificar atualizações"
                    }
                );

                break;
        }
    }


    // ==================================================
    // CLICK
    // ==================================================

    async function handleClick() {

        const button =
            document.getElementById(
                BUTTON_ID
            );


        if (
            !button
        ) {

            return;
        }


        if (
            button.dataset.disabled ===
            "true"
        ) {

            return;
        }


        const status =
            updaterState?.status ||
            "idle";


        try {

            // ==========================================
            // BAIXAR
            // ==========================================

            if (
                status ===
                "available"
            ) {

                console.log(
                    "[Updater UI] baixando atualização..."
                );


                await ipcRenderer.invoke(
                    "updater:download"
                );


                return;
            }


            // ==========================================
            // INSTALAR
            // ==========================================

            if (
                status ===
                "downloaded"
            ) {

                console.log(
                    "[Updater UI] reiniciando para instalar..."
                );


                await ipcRenderer.invoke(
                    "updater:install"
                );


                return;
            }


            // ==========================================
            // IGNORAR ENQUANTO OCUPADO
            // ==========================================

            if (
                status ===
                "checking" ||

                status ===
                "downloading" ||

                status ===
                "installing"
            ) {

                return;
            }


            // ==========================================
            // VERIFICAR
            // ==========================================

            console.log(
                "[Updater UI] verificando atualização..."
            );


            const result =
                await ipcRenderer.invoke(
                    "updater:check"
                );


            if (
                result?.state
            ) {

                renderState(
                    result.state
                );
            }

        } catch (error) {

            console.error(
                "[Updater UI] erro:",
                error
            );


            renderState({
                ...updaterState,

                status:
                    "error",

                error:
                    error?.message ||
                    String(
                        error
                    )
            });
        }
    }


    // ==================================================
    // CRIAR BOTÃO
    // ==================================================

    function createButton() {

        if (
            creating
        ) {

            return;
        }


        if (
            document.getElementById(
                BUTTON_ID
            )
        ) {

            return;
        }


        if (
            !document.body
        ) {

            return;
        }


        creating =
            true;


        try {

            installStyle();


            const button =
                document.createElement(
                    "button"
                );


            button.id =
                BUTTON_ID;


            button.type =
                "button";


            button.setAttribute(
                "aria-label",
                "Atualizar Sharkord"
            );


            setButtonContent(
                button,
                {
                    icon:
                        "↻",

                    compact:
                        true,

                    title:
                        "Verificar atualizações"
                }
            );


            button.addEventListener(
                "click",
                handleClick
            );


            document.body.appendChild(
                button
            );


            console.log(
                "[Updater UI] botão criado."
            );


            loadInitialState();

        } finally {

            creating =
                false;
        }
    }


    // ==================================================
    // ESTADO INICIAL
    // ==================================================

    async function loadInitialState() {

        try {

            const state =
                await ipcRenderer.invoke(
                    "updater:get-state"
                );


            renderState(
                state
            );

        } catch (error) {

            console.error(
                "[Updater UI] erro lendo estado:",
                error
            );
        }
    }


    // ==================================================
    // EVENTOS DO MAIN
    // ==================================================

    ipcRenderer.on(
        "updater:state",
        (
            _event,
            state
        ) => {

            renderState(
                state
            );
        }
    );


    // ==================================================
    // INICIALIZAÇÃO
    // ==================================================

    function init() {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                createButton,
                {
                    once:
                        true
                }
            );

        } else {

            createButton();
        }
    }


    init();


    /*
     * O Sharkord é SPA.
     *
     * Caso algum rerender da aplicação remova
     * nosso botão, colocamos novamente.
     */
    const observer =
        new MutationObserver(
            () => {

                if (
                    !document.getElementById(
                        BUTTON_ID
                    )
                ) {

                    createButton();
                }
            }
        );


    function startObserver() {

        if (
            !document.documentElement
        ) {

            setTimeout(
                startObserver,
                100
            );


            return;
        }


        observer.observe(
            document.documentElement,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    startObserver();

})();