const {
    ipcRenderer
} = require("electron");


// ======================================================
// SHARKORD DESKTOP — UPDATE TAB
// ======================================================

(() => {

    // ==================================================
    // SOMENTE NA INTERFACE WEB
    // ==================================================

    if (
        window.location.protocol !== "http:" &&
        window.location.protocol !== "https:"
    ) {

        return;
    }


    // ==================================================
    // IDS / ESTADO
    // ==================================================

    const TAB_ID =
        "sharkord-desktop-update-tab";


    const PANEL_ID =
        "sharkord-desktop-update-panel";


    const STYLE_ID =
        "sharkord-desktop-update-settings-style";


    const OLD_BUTTON_ID =
        "sharkord-desktop-update-button";


    let updaterState =
        null;


    let updateTab =
        null;


    let updatePanel =
        null;


    let settingsTabsContainer =
        null;


    let settingsContentContainer =
        null;


    let settingsContentWidth =
        null;


    let settingsContentOffsetLeft =
        0;


    let hiddenNativeContent =
        [];


    let observerTimer =
        null;


    let panelVisible =
        false;


    // ==================================================
    // REMOVER BOTÃO ANTIGO
    // ==================================================

    function removeOldUpdateButton() {

        const oldButton =
            document.getElementById(
                OLD_BUTTON_ID
            );


        if (
            oldButton
        ) {

            oldButton.remove();
        }
    }


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

            /* =========================================
               UPDATE TAB
               ========================================= */

            #${TAB_ID} {
                cursor:
                    pointer;

                user-select:
                    none;
            }


            #${TAB_ID}[data-update-active="true"] {
                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.075
                    ) !important;

                color:
                    #ffffff !important;

                box-shadow:
                    inset 0 0 0 1px
                    rgba(
                        255,
                        255,
                        255,
                        0.13
                    );
            }


            /* =========================================
               UPDATE PAGE
               ========================================= */

            #${PANEL_ID} {
                width:
                    100%;

                box-sizing:
                    border-box;

                color:
                    inherit;

                font-family:
                    inherit;
            }


            #${PANEL_ID}[hidden] {
                display:
                    none !important;
            }


            /* =========================================
               CARDS NO PADRÃO DO SHARKORD
               ========================================= */

            #${PANEL_ID}
            .shk-update-card {
                width:
                    100%;

                box-sizing:
                    border-box;

                margin-top:
                    0;

                padding:
                    24px;

                border:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.10
                    );

                border-radius:
                    12px;

                background:
                    #171717;
            }


            #${PANEL_ID}
            .shk-update-card + .shk-update-card {
                margin-top:
                    24px;
            }


            #${PANEL_ID}
            .shk-update-card-title {
                margin:
                    0 0 4px 0;

                color:
                    #f2f2f2;

                font-size:
                    15px;

                font-weight:
                    700;
            }


            #${PANEL_ID}
            .shk-update-card-description {
                margin:
                    0 0 20px 0;

                color:
                    #a5a5a5;

                font-size:
                    13px;

                line-height:
                    1.45;
            }


            /* =========================================
               INFO ROWS
               ========================================= */

            #${PANEL_ID}
            .shk-update-info-list {
                display:
                    flex;

                flex-direction:
                    column;

                width:
                    100%;
            }


            #${PANEL_ID}
            .shk-update-info-row {
                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    space-between;

                gap:
                    24px;

                min-height:
                    42px;

                padding:
                    10px 0;

                border-top:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.075
                    );
            }


            #${PANEL_ID}
            .shk-update-info-row:first-child {
                border-top:
                    none;

                padding-top:
                    0;
            }


            #${PANEL_ID}
            .shk-update-info-row:last-child {
                padding-bottom:
                    0;
            }


            #${PANEL_ID}
            .shk-update-info-label {
                min-width:
                    0;

                color:
                    #b2b2b2;

                font-size:
                    13px;

                font-weight:
                    500;
            }


            #${PANEL_ID}
            .shk-update-info-value {
                min-width:
                    0;

                overflow:
                    hidden;

                color:
                    #ededed;

                font-size:
                    13px;

                font-weight:
                    600;

                text-align:
                    right;

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;
            }


            /* =========================================
               STATUS
               ========================================= */

            #${PANEL_ID}
            .shk-update-status-row {
                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    space-between;

                gap:
                    24px;
            }


            #${PANEL_ID}
            .shk-update-status-copy {
                min-width:
                    0;

                flex:
                    1 1 auto;
            }


            #${PANEL_ID}
            .shk-update-status-title {
                color:
                    #eeeeee;

                font-size:
                    13px;

                font-weight:
                    650;

                line-height:
                    1.35;
            }


            #${PANEL_ID}
            .shk-update-status-detail {
                margin-top:
                    4px;

                color:
                    #9e9e9e;

                font-size:
                    12px;

                line-height:
                    1.45;
            }


            #${PANEL_ID}
            .shk-update-action {
                flex:
                    0 0 auto;

                height:
                    36px;

                padding:
                    0 14px;

                border:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.12
                    );

                border-radius:
                    7px;

                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.07
                    );

                color:
                    #ffffff;

                cursor:
                    pointer;

                font:
                    inherit;

                font-size:
                    12px;

                font-weight:
                    650;

                transition:
                    background 120ms ease,
                    opacity 120ms ease;
            }


            #${PANEL_ID}
            .shk-update-action:hover:not(:disabled) {
                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.12
                    );
            }


            #${PANEL_ID}
            .shk-update-action:disabled {
                cursor:
                    default;

                opacity:
                    0.55;
            }


            #${PANEL_ID}
            .shk-update-progress {
                display:
                    none;

                height:
                    5px;

                margin-top:
                    16px;

                overflow:
                    hidden;

                border-radius:
                    999px;

                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.08
                    );
            }


            #${PANEL_ID}
            .shk-update-progress[data-visible="true"] {
                display:
                    block;
            }


            #${PANEL_ID}
            .shk-update-progress-bar {
                width:
                    0%;

                height:
                    100%;

                border-radius:
                    inherit;

                background:
                    #f3f3f3;

                transition:
                    width 180ms ease;
            }


            @media (
                max-width:
                760px
            ) {

                #${PANEL_ID}
                .shk-update-card {
                    padding:
                        18px;
                }


                #${PANEL_ID}
                .shk-update-status-row {
                    align-items:
                        stretch;

                    flex-direction:
                        column;
                }


                #${PANEL_ID}
                .shk-update-action {
                    width:
                        100%;
                }
            }

        `;


        document.head.appendChild(
            style
        );
    }


    // ==================================================
    // HELPERS
    // ==================================================

    function normalizeText(
        value
    ) {

        return String(
            value ||
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    function findExactTextElement(
        text
    ) {

        const expected =
            text.toLowerCase();


        const candidates =
            document.querySelectorAll(
                "button, [role='tab'], [role='button'], a, div, span, h1, h2, h3, p"
            );


        for (
            const element
            of candidates
            ) {

            const currentText =
                normalizeText(
                    element.textContent
                )
                    .toLowerCase();


            if (
                currentText ===
                expected
            ) {

                return element;
            }
        }


        return null;
    }


    function findTabButton(
        element
    ) {

        let current =
            element;


        for (
            let i = 0;
            i < 5 && current;
            i++
        ) {

            const tag =
                current.tagName
                    ?.toLowerCase();


            const role =
                current.getAttribute
                    ?.(
                        "role"
                    );


            if (
                tag ===
                "button" ||

                tag ===
                "a" ||

                role ===
                "tab" ||

                role ===
                "button"
            ) {

                return current;
            }


            current =
                current.parentElement;
        }


        return element;
    }


    function setFieldText(
        panel,
        field,
        value
    ) {

        const element =
            panel.querySelector(
                `[data-field="${field}"]`
            );


        if (
            element
        ) {

            element.textContent =
                String(
                    value ??
                    "—"
                );
        }
    }


    // ==================================================
    // LOCALIZAR BARRA DE SETTINGS
    // ==================================================

    function findSettingsTabs() {

        const othersText =
            findExactTextElement(
                "Others"
            );


        if (
            !othersText
        ) {

            return null;
        }


        const othersTab =
            findTabButton(
                othersText
            );


        if (
            !othersTab
        ) {

            return null;
        }


        let current =
            othersTab.parentElement;


        for (
            let i = 0;
            i < 4 && current;
            i++
        ) {

            const text =
                normalizeText(
                    current.textContent
                )
                    .toLowerCase();


            if (
                text.includes(
                    "profile"
                ) &&
                text.includes(
                    "devices"
                ) &&
                text.includes(
                    "password"
                ) &&
                text.includes(
                    "notifications"
                ) &&
                text.includes(
                    "others"
                )
            ) {

                return {
                    container:
                    current,

                    othersTab
                };
            }


            current =
                current.parentElement;
        }


        return null;
    }


    // ==================================================
    // LOCALIZAR CONTEÚDO NATIVO DA PÁGINA
    // ==================================================

    function findSettingsContentContainer(
        info = null
    ) {

        /*
         * Não dependemos mais do texto "Your Profile".
         * O Sharkord pode rerenderizar/trocar a estrutura
         * interna e esse texto não é uma âncora confiável.
         *
         * Em vez disso, usamos a barra real de tabs como
         * referência e procuramos o primeiro container de
         * conteúdo grande imediatamente abaixo dela.
         */
        const tabsInfo =
            info ||
            findSettingsTabs();


        if (
            !tabsInfo?.container
        ) {

            return null;
        }


        const tabs =
            tabsInfo.container;


        const tabsRect =
            tabs.getBoundingClientRect();


        if (
            tabsRect.width <= 0 ||
            tabsRect.height <= 0
        ) {

            return null;
        }


        let ancestor =
            tabs.parentElement;


        let best =
            null;


        let bestScore =
            Number.POSITIVE_INFINITY;


        for (
            let level = 0;
            level < 7 && ancestor;
            level++
        ) {

            const candidates =
                ancestor.querySelectorAll(
                    "div, main, section, form"
                );


            for (
                const candidate
                of candidates
                ) {

                if (
                    candidate === tabs ||
                    candidate.contains(tabs) ||
                    tabs.contains(candidate) ||
                    candidate.id === PANEL_ID
                ) {

                    continue;
                }


                const rect =
                    candidate.getBoundingClientRect();


                if (
                    rect.width < 420 ||
                    rect.height < 80 ||
                    rect.top < tabsRect.bottom + 8 ||
                    rect.left < tabsRect.left - 120 ||
                    rect.left > tabsRect.right + 120
                ) {

                    continue;
                }


                const topDistance =
                    Math.abs(
                        rect.top -
                        tabsRect.bottom
                    );


                const leftDistance =
                    Math.abs(
                        rect.left -
                        tabsRect.left
                    );


                const widthDistance =
                    Math.abs(
                        rect.width -
                        tabsRect.width
                    );


                /*
                 * Topo é o fator principal. Largura e
                 * alinhamento servem para desempatar.
                 */
                const score =
                    topDistance * 4 +
                    leftDistance +
                    widthDistance * 0.20;


                if (
                    score < bestScore
                ) {

                    best =
                        candidate;


                    bestScore =
                        score;
                }
            }


            if (
                best &&
                bestScore < 180
            ) {

                break;
            }


            ancestor =
                ancestor.parentElement;
        }


        if (
            best
        ) {

            /*
             * Guardamos a geometria do bloco nativo antes
             * de ocultá-lo. Assim a página Update ocupa
             * exatamente a mesma largura e começa no mesmo
             * X de Profile / Devices, mesmo quando o pai é
             * um wrapper bem mais largo.
             */
            const bestRect =
                best.getBoundingClientRect();


            const parent =
                best.parentElement;


            if (
                parent &&
                !parent.contains(tabs)
            ) {

                const parentRect =
                    parent.getBoundingClientRect();


                settingsContentWidth =
                    bestRect.width;


                settingsContentOffsetLeft =
                    Math.max(
                        0,
                        bestRect.left -
                        parentRect.left
                    );


                return parent;
            }


            settingsContentWidth =
                bestRect.width;


            settingsContentOffsetLeft =
                0;


            return best;
        }


        settingsContentWidth =
            null;


        settingsContentOffsetLeft =
            0;


        return null;
    }


    // ==================================================
    // CLIENT INFO
    // ==================================================

    function getClientInfo() {

        return {
            electron:
                process?.versions
                    ?.electron ||
                "—",

            chromium:
                process?.versions
                    ?.chrome ||
                "—",

            node:
                process?.versions
                    ?.node ||
                "—",

            platform:
                process?.platform ||
                "—",

            arch:
                process?.arch ||
                "—"
        };
    }


    // ==================================================
    // CRIAR PAINEL
    // ==================================================

    function createPanel() {

        let panel =
            document.getElementById(
                PANEL_ID
            );


        if (
            panel
        ) {

            updatePanel =
                panel;

            return panel;
        }


        panel =
            document.createElement(
                "section"
            );


        panel.id =
            PANEL_ID;


        panel.hidden =
            true;


        panel.innerHTML = `

            <div
                class="shk-update-card"
            >

                <h3
                    class="shk-update-card-title"
                >
                    Informações do cliente
                </h3>


                <p
                    class="shk-update-card-description"
                >
                    Detalhes da versão instalada e do ambiente do Sharkord Desktop.
                </p>


                <div
                    class="shk-update-info-list"
                >

                    <div
                        class="shk-update-info-row"
                    >
                        <div
                            class="shk-update-info-label"
                        >
                            Versão do cliente
                        </div>

                        <div
                            class="shk-update-info-value"
                            data-field="app-version"
                        >
                            —
                        </div>
                    </div>


                    <div
                        class="shk-update-info-row"
                    >
                        <div
                            class="shk-update-info-label"
                        >
                            Electron
                        </div>

                        <div
                            class="shk-update-info-value"
                            data-field="electron-version"
                        >
                            —
                        </div>
                    </div>


                    <div
                        class="shk-update-info-row"
                    >
                        <div
                            class="shk-update-info-label"
                        >
                            Chromium
                        </div>

                        <div
                            class="shk-update-info-value"
                            data-field="chromium-version"
                        >
                            —
                        </div>
                    </div>


                    <div
                        class="shk-update-info-row"
                    >
                        <div
                            class="shk-update-info-label"
                        >
                            Node.js
                        </div>

                        <div
                            class="shk-update-info-value"
                            data-field="node-version"
                        >
                            —
                        </div>
                    </div>


                    <div
                        class="shk-update-info-row"
                    >
                        <div
                            class="shk-update-info-label"
                        >
                            Sistema
                        </div>

                        <div
                            class="shk-update-info-value"
                            data-field="platform"
                        >
                            —
                        </div>
                    </div>


                    <div
                        class="shk-update-info-row"
                    >
                        <div
                            class="shk-update-info-label"
                        >
                            Arquitetura
                        </div>

                        <div
                            class="shk-update-info-value"
                            data-field="arch"
                        >
                            —
                        </div>
                    </div>

                </div>

            </div>


            <div
                class="shk-update-card"
            >

                <h3
                    class="shk-update-card-title"
                >
                    Atualizações
                </h3>


                <p
                    class="shk-update-card-description"
                >
                    Verifique, baixe e instale novas versões do Sharkord Desktop.
                </p>


                <div
                    class="shk-update-status-row"
                >

                    <div
                        class="shk-update-status-copy"
                    >

                        <div
                            class="shk-update-status-title"
                            data-field="status-title"
                        >
                            Atualizações
                        </div>


                        <div
                            class="shk-update-status-detail"
                            data-field="status-detail"
                        >
                            Verificando estado do cliente...
                        </div>

                    </div>


                    <button
                        type="button"
                        class="shk-update-action"
                        data-field="action"
                    >
                        Verificar
                    </button>

                </div>


                <div
                    class="shk-update-progress"
                    data-field="progress"
                >

                    <div
                        class="shk-update-progress-bar"
                        data-field="progress-bar"
                    ></div>

                </div>

            </div>

        `;


        const clientInfo =
            getClientInfo();


        setFieldText(
            panel,
            "electron-version",
            clientInfo.electron
        );


        setFieldText(
            panel,
            "chromium-version",
            clientInfo.chromium
        );


        setFieldText(
            panel,
            "node-version",
            clientInfo.node
        );


        setFieldText(
            panel,
            "platform",
            clientInfo.platform
        );


        setFieldText(
            panel,
            "arch",
            clientInfo.arch
        );


        const action =
            panel.querySelector(
                '[data-field="action"]'
            );


        action?.addEventListener(
            "click",
            handleUpdateAction
        );


        updatePanel =
            panel;


        return panel;
    }


    // ==================================================
    // ESTADO VISUAL
    // ==================================================

    function renderUpdaterState(
        state
    ) {

        updaterState =
            state ||
            {
                status:
                    "idle"
            };


        if (
            !updatePanel
        ) {

            return;
        }


        setFieldText(
            updatePanel,
            "app-version",
            updaterState.currentVersion ||
            "—"
        );


        const title =
            updatePanel.querySelector(
                '[data-field="status-title"]'
            );


        const detail =
            updatePanel.querySelector(
                '[data-field="status-detail"]'
            );


        const action =
            updatePanel.querySelector(
                '[data-field="action"]'
            );


        const progress =
            updatePanel.querySelector(
                '[data-field="progress"]'
            );


        const progressBar =
            updatePanel.querySelector(
                '[data-field="progress-bar"]'
            );


        if (
            !title ||
            !detail ||
            !action ||
            !progress ||
            !progressBar
        ) {

            return;
        }


        const status =
            updaterState.status ||
            "idle";


        progress.dataset.visible =
            "false";


        progressBar.style.width =
            "0%";


        action.disabled =
            false;


        switch (
            status
            ) {

            case "development":

                title.textContent =
                    "Modo de desenvolvimento";


                detail.textContent =
                    "O atualizador funciona na versão instalada do Sharkord Desktop.";


                action.textContent =
                    "Indisponível";


                action.disabled =
                    true;


                break;


            case "checking":

                title.textContent =
                    "Verificando atualizações";


                detail.textContent =
                    "Procurando uma versão mais recente do Sharkord Desktop...";


                action.textContent =
                    "Verificando...";


                action.disabled =
                    true;


                break;


            case "available":

                title.textContent =
                    "Atualização disponível";


                detail.textContent =
                    updaterState.availableVersion
                        ? `A versão ${updaterState.availableVersion} está disponível para download.`
                        : "Uma nova versão está disponível para download.";


                action.textContent =
                    "Baixar";


                break;


            case "downloading": {

                const percent =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            Number(
                                updaterState.percent ||
                                0
                            )
                        )
                    );


                title.textContent =
                    "Baixando atualização";


                detail.textContent =
                    `${percent.toFixed(1)}% concluído`;


                action.textContent =
                    `${percent.toFixed(0)}%`;


                action.disabled =
                    true;


                progress.dataset.visible =
                    "true";


                progressBar.style.width =
                    `${percent}%`;


                break;
            }


            case "downloaded":

                title.textContent =
                    "Atualização pronta";


                detail.textContent =
                    updaterState.availableVersion
                        ? `A versão ${updaterState.availableVersion} está pronta para instalar.`
                        : "A atualização está pronta para instalar.";


                action.textContent =
                    "Reiniciar e instalar";


                break;


            case "installing":

                title.textContent =
                    "Instalando atualização";


                detail.textContent =
                    "O Sharkord Desktop será reiniciado.";


                action.textContent =
                    "Instalando...";


                action.disabled =
                    true;


                break;


            case "up-to-date":

                title.textContent =
                    "Você está atualizado";


                detail.textContent =
                    updaterState.currentVersion
                        ? `A versão ${updaterState.currentVersion} é a mais recente.`
                        : "Você já está usando a versão mais recente.";


                action.textContent =
                    "Verificar novamente";


                break;


            case "error":

                title.textContent =
                    "Falha ao verificar atualização";


                detail.textContent =
                    updaterState.error ||
                    "Ocorreu um erro ao acessar o serviço de atualização.";


                action.textContent =
                    "Tentar novamente";


                break;


            case "idle":

            default:

                title.textContent =
                    "Atualizações";


                detail.textContent =
                    "Verifique se existe uma versão mais recente do Sharkord Desktop.";


                action.textContent =
                    "Verificar";


                break;
        }
    }


    // ==================================================
    // AÇÃO DO UPDATER
    // ==================================================

    async function handleUpdateAction() {

        const status =
            updaterState?.status ||
            "idle";


        try {

            if (
                status ===
                "available"
            ) {

                const result =
                    await ipcRenderer.invoke(
                        "updater:download"
                    );


                if (
                    result?.state
                ) {

                    renderUpdaterState(
                        result.state
                    );
                }


                return;
            }


            if (
                status ===
                "downloaded"
            ) {

                await ipcRenderer.invoke(
                    "updater:install"
                );


                return;
            }


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


            const result =
                await ipcRenderer.invoke(
                    "updater:check"
                );


            if (
                result?.state
            ) {

                renderUpdaterState(
                    result.state
                );
            }

        } catch (error) {

            renderUpdaterState({
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
    // OCULTAR / RESTAURAR CONTEÚDO NATIVO
    // ==================================================

    function hideNativeSettingsContent() {

        hiddenNativeContent =
            [];


        if (
            !settingsContentContainer
        ) {

            return;
        }


        const panel =
            createPanel();


        for (
            const child
            of Array.from(
            settingsContentContainer.children
        )
            ) {

            if (
                child ===
                panel
            ) {

                continue;
            }


            hiddenNativeContent.push({
                element:
                child,

                display:
                child.style.display
            });


            child.style.display =
                "none";
        }
    }


    function restoreNativeSettingsContent() {

        for (
            const item
            of hiddenNativeContent
            ) {

            if (
                !item.element
            ) {

                continue;
            }


            item.element.style.display =
                item.display;
        }


        hiddenNativeContent =
            [];
    }


    // ==================================================
    // MOSTRAR / ESCONDER UPDATE PAGE
    // ==================================================

    async function showUpdatePanel() {

        if (
            !settingsContentContainer ||
            !settingsContentContainer.isConnected
        ) {

            settingsContentContainer =
                findSettingsContentContainer();
        }


        if (
            !settingsContentContainer
        ) {

            console.warn(
                "[Updater Settings] conteúdo nativo não encontrado."
            );


            return;
        }


        const panel =
            createPanel();


        if (
            panel.parentElement !==
            settingsContentContainer
        ) {

            panel.remove();


            settingsContentContainer.appendChild(
                panel
            );
        }


        /*
         * Replica a largura e o alinhamento horizontal
         * do conteúdo nativo detectado antes de ocultá-lo.
         */
        if (
            settingsContentWidth &&
            settingsContentWidth >
            0
        ) {

            panel.style.width =
                `${Math.round(settingsContentWidth)}px`;

        } else {

            panel.style.width =
                "100%";
        }


        panel.style.marginLeft =
            `${Math.round(settingsContentOffsetLeft)}px`;


        panel.style.marginRight =
            "0";


        hideNativeSettingsContent();


        panelVisible =
            true;


        panel.hidden =
            false;


        if (
            updateTab
        ) {

            updateTab.dataset.updateActive =
                "true";


            updateTab.setAttribute(
                "aria-selected",
                "true"
            );
        }


        try {

            const state =
                await ipcRenderer.invoke(
                    "updater:get-state"
                );


            renderUpdaterState(
                state
            );

        } catch (error) {

            renderUpdaterState({
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


    function hideUpdatePanel() {

        if (
            !panelVisible
        ) {

            return;
        }


        panelVisible =
            false;


        if (
            updatePanel
        ) {

            updatePanel.hidden =
                true;
        }


        restoreNativeSettingsContent();


        if (
            updateTab
        ) {

            updateTab.dataset.updateActive =
                "false";


            updateTab.setAttribute(
                "aria-selected",
                "false"
            );
        }
    }


    // ==================================================
    // CRIAR ABA UPDATE
    // ==================================================

    function createUpdateTab(
        info
    ) {

        if (
            !info?.container ||
            !info?.othersTab
        ) {

            return false;
        }


        settingsTabsContainer =
            info.container;


        let existing =
            document.getElementById(
                TAB_ID
            );


        if (
            existing
        ) {

            updateTab =
                existing;


            return true;
        }


        /*
         * Clona a aba Others para herdar o estilo real
         * do Sharkord.
         */
        const tab =
            info.othersTab.cloneNode(
                true
            );


        tab.id =
            TAB_ID;


        tab.textContent =
            "Update";


        tab.removeAttribute(
            "data-state"
        );


        tab.setAttribute(
            "aria-selected",
            "false"
        );


        tab.dataset.updateActive =
            "false";


        /*
         * Remove listeners herdados por comportamento
         * usando substituição pelo clone recém-criado.
         * cloneNode já não copia addEventListener.
         */
        tab.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();

                showUpdatePanel();
            }
        );


        info.othersTab.insertAdjacentElement(
            "afterend",
            tab
        );


        updateTab =
            tab;


        console.log(
            "[Updater Settings] aba Update criada."
        );


        /*
         * Clique em qualquer aba nativa fecha Update.
         */
        const nativeTabs =
            settingsTabsContainer
                .querySelectorAll(
                    "button, [role='tab'], [role='button'], a"
                );


        for (
            const nativeTab
            of nativeTabs
            ) {

            if (
                nativeTab ===
                tab
            ) {

                continue;
            }


            nativeTab.addEventListener(
                "click",
                hideUpdatePanel
            );
        }


        return true;
    }


    // ==================================================
    // PROCURAR USER SETTINGS
    // ==================================================

    function scanUserSettings() {

        removeOldUpdateButton();


        const info =
            findSettingsTabs();


        if (
            !info
        ) {

            if (
                panelVisible
            ) {

                hideUpdatePanel();
            }


            updateTab =
                null;


            settingsTabsContainer =
                null;


            settingsContentContainer =
                null;


            settingsContentWidth =
                null;


            settingsContentOffsetLeft =
                0;


            return;
        }


        /*
         * Guardamos o container enquanto uma aba nativa
         * ainda está visível. Isso deixa o clique em
         * Update independente de qualquer rerender.
         */
        const detectedContent =
            findSettingsContentContainer(
                info
            );


        if (
            detectedContent
        ) {

            settingsContentContainer =
                detectedContent;
        }


        createUpdateTab(
            info
        );
    }


    function scheduleScan() {

        if (
            observerTimer
        ) {

            clearTimeout(
                observerTimer
            );
        }


        observerTimer =
            setTimeout(
                () => {

                    observerTimer =
                        null;


                    scanUserSettings();

                },
                60
            );
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

            renderUpdaterState(
                state
            );
        }
    );


    // ==================================================
    // INIT
    // ==================================================

    function init() {

        installStyle();

        removeOldUpdateButton();

        scanUserSettings();


        const observer =
            new MutationObserver(
                scheduleScan
            );


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


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();
    }

})();
