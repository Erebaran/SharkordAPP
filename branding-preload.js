const {
    ipcRenderer
} = require("electron");


// ======================================================
// SOMENTE NAS PÁGINAS DO SERVIDOR
// ======================================================

if (
    location.protocol === "http:" ||
    location.protocol === "https:"
) {

    const SERVER_URL =
        location.origin;


    const BRAND_ROOT_ID =
        "__sharkord_server_branding";


    const BRAND_STYLE_ID =
        "__sharkord_server_branding_style";


    const ORIGINAL_HEADER_CLASS =
        "__sharkord_original_server_header";


    let currentProfile =
        null;


    let installTimer =
        null;


    let observer =
        null;


    let currentSidebar =
        null;


    let currentOriginalHeader =
        null;


    // ==================================================
    // HELPERS
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


    function getInitials(
        name
    ) {

        const parts =
            String(
                name || "Servidor"
            )
                .trim()
                .split(
                    /\s+/
                )
                .filter(Boolean);


        return parts
                .slice(
                    0,
                    2
                )
                .map(
                    part =>
                        part[0]?.toUpperCase() ||
                        ""
                )
                .join("") ||
            "S";
    }


    function guessServerName() {

        const labels =
            location.hostname
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
    }


    function buildServerFileUrl(file) {

        if (
            !file ||
            !file.name
        ) {

            return null;
        }


        return (
            SERVER_URL +
            "/public/" +
            encodeURIComponent(
                file.name
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
            "hidden"
        );
    }


    function getButtonDescription(
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


    // ==================================================
    // ENCONTRAR SIDEBAR
    // ==================================================

    function findSidebar() {

        const candidates =
            Array.from(
                document.querySelectorAll(
                    "div, aside, section, nav"
                )
            );


        const anchors =
            candidates.filter(
                element => {

                    if (
                        !isVisible(
                            element
                        )
                    ) {

                        return false;
                    }


                    const text =
                        normalizeText(
                            element.textContent
                        );


                    return (
                        text.includes(
                            "direct messages"
                        ) ||
                        text.includes(
                            "text channels"
                        ) ||
                        text.includes(
                            "voice channels"
                        )
                    );
                }
            );


        let best =
            null;


        let bestScore =
            -Infinity;


        for (
            const anchor
            of anchors
            ) {

            let node =
                anchor;


            for (
                let depth = 0;
                node &&
                depth < 8;
                depth++
            ) {

                const rect =
                    node.getBoundingClientRect();


                if (
                    rect.width >= 180 &&
                    rect.width <= 360 &&
                    rect.height >=
                    window.innerHeight *
                    0.55 &&
                    rect.left <= 420
                ) {

                    let score =
                        500;


                    score -=
                        Math.abs(
                            rect.width -
                            260
                        );


                    score -=
                        rect.left *
                        0.15;


                    score -=
                        depth *
                        5;


                    const text =
                        normalizeText(
                            node.textContent
                        );


                    if (
                        text.includes(
                            "direct messages"
                        )
                    ) {

                        score +=
                            40;
                    }


                    if (
                        score >
                        bestScore
                    ) {

                        best =
                            node;


                        bestScore =
                            score;
                    }
                }


                node =
                    node.parentElement;
            }
        }


        return best;
    }


    // ==================================================
    // ENCONTRAR CABEÇALHO ORIGINAL
    // ==================================================

    function findOriginalServerHeader(
        sidebar,
        serverName
    ) {

        if (!sidebar) {
            return null;
        }


        const normalizedName =
            normalizeText(
                serverName
            );


        const sidebarRect =
            sidebar.getBoundingClientRect();


        const textCandidates =
            Array.from(
                sidebar.querySelectorAll(
                    [
                        "span",
                        "div",
                        "button",
                        "h1",
                        "h2",
                        "h3"
                    ].join(",")
                )
            );


        let bestHeader =
            null;


        let bestScore =
            -Infinity;


        for (
            const element
            of textCandidates
            ) {

            if (
                !isVisible(
                    element
                )
            ) {

                continue;
            }


            if (
                element.closest(
                    `#${BRAND_ROOT_ID}`
                )
            ) {

                continue;
            }


            const text =
                normalizeText(
                    element.textContent
                );


            if (
                text !==
                normalizedName
            ) {

                continue;
            }


            let node =
                element;


            for (
                let depth = 0;
                node &&
                node !== sidebar &&
                depth < 6;
                depth++
            ) {

                const rect =
                    node.getBoundingClientRect();


                const buttons =
                    Array.from(
                        node.querySelectorAll(
                            "button, [role='button']"
                        )
                    );


                const widthRatio =
                    rect.width /
                    sidebarRect.width;


                let score =
                    0;


                if (
                    widthRatio >=
                    0.75
                ) {

                    score +=
                        100;
                }


                if (
                    rect.height >= 35 &&
                    rect.height <= 80
                ) {

                    score +=
                        100;
                }


                if (
                    buttons.length >=
                    1
                ) {

                    score +=
                        160;
                }


                const relativeTop =
                    rect.top -
                    sidebarRect.top;


                if (
                    relativeTop >= -5 &&
                    relativeTop <= 220
                ) {

                    score +=
                        80;
                }


                score -=
                    depth *
                    10;


                if (
                    score >
                    bestScore
                ) {

                    bestScore =
                        score;


                    bestHeader =
                        node;
                }


                node =
                    node.parentElement;
            }
        }


        return bestHeader;
    }


    // ==================================================
    // ENCONTRAR TÍTULO DO SERVIDOR
    // ==================================================

    function findServerTitleElement(
        header
    ) {

        if (!header) {
            return null;
        }


        const serverName =
            normalizeText(
                currentProfile?.name ||
                guessServerName()
            );


        const candidates =
            Array.from(
                header.querySelectorAll(
                    "span, div, h1, h2, h3"
                )
            );


        let best =
            null;


        let bestArea =
            Infinity;


        for (
            const element
            of candidates
            ) {

            if (
                !isVisible(
                    element
                )
            ) {

                continue;
            }


            if (
                normalizeText(
                    element.textContent
                ) !==
                serverName
            ) {

                continue;
            }


            const rect =
                element.getBoundingClientRect();


            const area =
                rect.width *
                rect.height;


            /*
             * Preferimos o menor elemento
             * que contém exatamente o texto.
             *
             * Assim evitamos pegar um container
             * enorme do header.
             */
            if (
                area <
                bestArea
            ) {

                best =
                    element;


                bestArea =
                    area;
            }
        }


        return best;
    }


    // ==================================================
    // ENCONTRAR BOTÃO +
    // ==================================================

    function findChannelPlusButton(
        sidebar
    ) {

        if (!sidebar) {
            return null;
        }


        const sidebarRect =
            sidebar.getBoundingClientRect();


        const candidates =
            Array.from(
                sidebar.querySelectorAll(
                    "button, [role='button']"
                )
            );


        let best =
            null;


        let bestScore =
            -Infinity;


        for (
            const button
            of candidates
            ) {

            if (
                !isVisible(
                    button
                )
            ) {

                continue;
            }


            /*
             * Ignora qualquer botão dentro
             * do próprio header.
             */
            if (
                currentOriginalHeader &&
                currentOriginalHeader.contains(
                    button
                )
            ) {

                continue;
            }


            const rect =
                button.getBoundingClientRect();


            if (
                rect.width > 55 ||
                rect.height > 55
            ) {

                continue;
            }


            /*
             * Ignora área de usuário,
             * headset, configurações etc.
             */
            if (
                rect.top >
                sidebarRect.top +
                sidebarRect.height *
                0.75
            ) {

                continue;
            }


            const description =
                getButtonDescription(
                    button
                );


            let score =
                0;


            if (
                description === "+"
            ) {

                score +=
                    600;
            }


            const addTerms = [
                "add",
                "create",
                "new channel",
                "new category",
                "add channel",
                "add category",

                "adicionar",
                "criar",
                "novo canal",
                "nova categoria",
                "adicionar canal",
                "adicionar categoria"
            ];


            if (
                addTerms.some(
                    term =>
                        description.includes(
                            term
                        )
                )
            ) {

                score +=
                    350;
            }


            const relativeCenterX =
                (
                    rect.left +
                    rect.width /
                    2
                ) -
                sidebarRect.left;


            /*
             * O botão + esperado fica
             * no lado direito.
             */
            if (
                relativeCenterX >
                sidebarRect.width *
                0.60
            ) {

                score +=
                    150;
            }


            /*
             * Quanto mais à direita,
             * melhor candidato.
             */
            score +=
                relativeCenterX;


            /*
             * Evita pegar itens muito próximos
             * do topo absoluto, como o menu ☰.
             */
            if (
                rect.top <
                sidebarRect.top +
                80
            ) {

                score -=
                    200;
            }


            if (
                score >
                bestScore
            ) {

                best =
                    button;


                bestScore =
                    score;
            }
        }


        return bestScore >=
        100
            ? best
            : null;
    }


    // ==================================================
    // ENCONTRAR BOTÃO ☰
    // ==================================================

    function findHeaderMenuButton(
        header
    ) {

        if (!header) {
            return null;
        }


        const buttons =
            Array.from(
                header.querySelectorAll(
                    "button, [role='button']"
                )
            )
                .filter(
                    button =>
                        isVisible(
                            button
                        )
                );


        if (
            buttons.length ===
            0
        ) {

            return null;
        }


        /*
         * Menu do servidor é o botão
         * mais à direita do header.
         */
        buttons.sort(
            (
                a,
                b
            ) =>
                b.getBoundingClientRect()
                    .left -
                a.getBoundingClientRect()
                    .left
        );


        return buttons[0];
    }


    // ==================================================
    // ALINHAR ☰
    // ==================================================

    function alignHeaderMenuWithPlus(
        sidebar,
        header
    ) {

        if (
            !sidebar ||
            !header
        ) {

            return false;
        }


        const plusButton =
            findChannelPlusButton(
                sidebar
            );


        if (
            !plusButton
        ) {

            console.warn(
                "[Server Branding] botão + ainda não encontrado para alinhamento."
            );


            return false;
        }


        const menuButton =
            findHeaderMenuButton(
                header
            );


        if (
            !menuButton
        ) {

            console.warn(
                "[Server Branding] botão ☰ não encontrado."
            );


            return false;
        }


        const titleElement =
            findServerTitleElement(
                header
            );


        const plusRect =
            plusButton
                .getBoundingClientRect();


        const headerRect =
            header
                .getBoundingClientRect();


        // ==============================================
        // HORIZONTAL
        // ==============================================

        const plusCenterX =
            plusRect.left +
            plusRect.width /
            2;


        const desiredCenterX =
            plusCenterX -
            headerRect.left;


        // ==============================================
        // VERTICAL
        // ==============================================

        let desiredCenterY =
            headerRect.height /
            2;


        /*
         * O Y não vem do header.
         *
         * Ele vem do centro exato do texto
         * "Erebaran".
         */
        if (
            titleElement
        ) {

            const titleRect =
                titleElement
                    .getBoundingClientRect();


            const titleCenterY =
                titleRect.top +
                titleRect.height /
                2;


            desiredCenterY =
                titleCenterY -
                headerRect.top;
        }


        // ==============================================
        // POSICIONAR
        // ==============================================

        menuButton.style.setProperty(
            "position",
            "absolute",
            "important"
        );


        menuButton.style.setProperty(
            "left",
            `${desiredCenterX}px`,
            "important"
        );


        menuButton.style.setProperty(
            "right",
            "auto",
            "important"
        );


        menuButton.style.setProperty(
            "top",
            `${desiredCenterY}px`,
            "important"
        );


        menuButton.style.setProperty(
            "bottom",
            "auto",
            "important"
        );


        menuButton.style.setProperty(
            "margin",
            "0",
            "important"
        );


        /*
         * Mantém exatamente o tamanho
         * original do botão.
         */
        menuButton.style.setProperty(
            "transform",
            "translate(-50%, -50%)",
            "important"
        );


        console.log(
            "[Server Branding] ☰ alinhado.",
            {
                x:
                desiredCenterX,

                y:
                desiredCenterY,

                titleFound:
                    Boolean(
                        titleElement
                    ),

                plusFound:
                    Boolean(
                        plusButton
                    )
            }
        );


        return true;
    }


    // ==================================================
    // CSS
    // ==================================================

    function ensureStyles() {

        if (
            document.getElementById(
                BRAND_STYLE_ID
            )
        ) {

            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            BRAND_STYLE_ID;


        style.textContent = `

            /* ==========================================
               CONTAINER DO BRANDING
               ========================================== */

            #${BRAND_ROOT_ID} {

                position:
                    relative;

                flex:
                    0 0 auto;

                width:
                    100%;

                height:
                    126px;

                margin:
                    0;

                overflow:
                    visible;

                user-select:
                    none;

                z-index:
                    4;
            }


            /* ==========================================
               BANNER
               ========================================== */

            /*
             * V6 Desktop:
             * o banner visual principal é desenhado pelo Server Sidebar
             * em largura total. Mantemos este elemento apenas como alvo
             * funcional para edição/seleção do banner.
             */
            #${BRAND_ROOT_ID}
            .skr-brand-banner-image,
            #${BRAND_ROOT_ID}
            .skr-brand-shade {
                opacity:0;
            }

            #${BRAND_ROOT_ID}
            .skr-brand-avatar-wrap {
                opacity:0;
                pointer-events:none;
            }


            #${BRAND_ROOT_ID}
            .skr-brand-banner {

                position:
                    absolute;

                left:
                    0;

                top:
                    0;

                right:
                    auto;

                /*
                 * V5 Desktop:
                 * o banner nasce na coluna de canais, mas se estende
                 * visualmente por toda a área do servidor.
                 */
                width:
                    calc(
                        100vw -
                        72px
                    );

                max-width:
                    none;

                height:
                    126px;

                overflow:
                    hidden;

                cursor:
                    pointer;

                background:
                    radial-gradient(
                        circle at 18% 0%,
                        rgba(
                            88,
                            101,
                            242,
                            0.34
                        ),
                        transparent 56%
                    ),
                    linear-gradient(
                        135deg,
                        #17181b 0%,
                        #27292f 100%
                    );
            }


            #${BRAND_ROOT_ID}
            .skr-brand-banner-image {

                position:
                    absolute;

                inset:
                    0;

                width:
                    100%;

                height:
                    100%;

                object-fit:
                    cover;

                object-position:
                    center;

                display:
                    none;
            }


            #${BRAND_ROOT_ID}.has-banner
            .skr-brand-banner-image {

                display:
                    block;
            }


            /* ==========================================
               SOMBRA DO BANNER
               ========================================== */

            #${BRAND_ROOT_ID}
            .skr-brand-shade {

                position:
                    absolute;

                inset:
                    0;

                background:
                    linear-gradient(
                        to bottom,

                        rgba(
                            0,
                            0,
                            0,
                            0.48
                        ) 0%,

                        rgba(
                            0,
                            0,
                            0,
                            0.10
                        ) 45%,

                        rgba(
                            0,
                            0,
                            0,
                            0.55
                        ) 100%
                    );

                pointer-events:
                    none;
            }


            /* ==========================================
               HOVER DO BANNER
               ========================================== */

            #${BRAND_ROOT_ID}
            .skr-brand-banner-edit {

                position:
                    absolute;

                left:
                    50%;

                top:
                    62%;

                z-index:
                    4;

                transform:
                    translate(
                        -50%,
                        -50%
                    );

                padding:
                    7px 10px;

                border-radius:
                    7px;

                background:
                    rgba(
                        0,
                        0,
                        0,
                        0.70
                    );

                color:
                    #fff;

                font-size:
                    11px;

                font-weight:
                    650;

                opacity:
                    0;

                transition:
                    opacity
                    120ms ease;

                pointer-events:
                    none;

                backdrop-filter:
                    blur(4px);
            }


            #${BRAND_ROOT_ID}
            .skr-brand-banner:hover
            .skr-brand-banner-edit {

                opacity:
                    1;
            }


            /* ==========================================
               AVATAR
               ========================================== */

            #${BRAND_ROOT_ID}
            .skr-brand-avatar-wrap {

                position:
                    absolute;

                left:
                    16px;

                top:
                    94px;

                z-index:
                    20;

                width:
                    64px;

                height:
                    64px;

                border-radius:
                    17px;

                padding:
                    3px;

                background:
                    #1e1f22;

                box-shadow:
                    0 4px 14px
                    rgba(
                        0,
                        0,
                        0,
                        0.38
                    );
            }


            #${BRAND_ROOT_ID}
            .skr-brand-avatar {

                position:
                    relative;

                width:
                    100%;

                height:
                    100%;

                overflow:
                    hidden;

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    center;

                border-radius:
                    14px;

                cursor:
                    pointer;

                background:
                    linear-gradient(
                        135deg,
                        #5865f2,
                        #7b5cff
                    );

                color:
                    #fff;

                font-size:
                    20px;

                font-weight:
                    750;

                letter-spacing:
                    0.5px;
            }


            #${BRAND_ROOT_ID}
            .skr-brand-avatar-image {

                position:
                    absolute;

                inset:
                    0;

                width:
                    100%;

                height:
                    100%;

                object-fit:
                    cover;

                object-position:
                    center;

                display:
                    none;
            }


            #${BRAND_ROOT_ID}.has-avatar
            .skr-brand-avatar-image {

                display:
                    block;
            }


            #${BRAND_ROOT_ID}
            .skr-brand-avatar-edit {

                position:
                    absolute;

                inset:
                    0;

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    center;

                background:
                    rgba(
                        0,
                        0,
                        0,
                        0.62
                    );

                color:
                    white;

                font-size:
                    11px;

                font-weight:
                    650;

                opacity:
                    0;

                transition:
                    opacity
                    120ms ease;

                pointer-events:
                    none;
            }


            #${BRAND_ROOT_ID}
            .skr-brand-avatar:hover
            .skr-brand-avatar-edit {

                opacity:
                    1;
            }


            /* ==========================================
               TEXTO DE AJUDA
               ========================================== */

            #${BRAND_ROOT_ID}
            .skr-brand-hint {

                position:
                    absolute;

                left:
                    92px;

                right:
                    12px;

                top:
                    136px;

                overflow:
                    hidden;

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;

                color:
                    rgba(
                        255,
                        255,
                        255,
                        0.47
                    );

                font-size:
                    10px;

                pointer-events:
                    none;
            }


            /* ==========================================
               HEADER ORIGINAL DO SHARKORD
               ========================================== */

            .${ORIGINAL_HEADER_CLASS} {

                position:
                    absolute !important;

                left:
                    0 !important;

                right:
                    0 !important;

                top:
                    0 !important;

                width:
                    100% !important;

                z-index:
                    100 !important;

                margin:
                    0 !important;

                padding-left:
                    16px !important;

                padding-right:
                    0 !important;

                background:
                    transparent !important;

                border:
                    none !important;

                box-shadow:
                    none !important;
            }


            .${ORIGINAL_HEADER_CLASS},
            .${ORIGINAL_HEADER_CLASS} * {

                color:
                    white !important;

                text-shadow:
                    0 1px 2px
                    rgba(
                        0,
                        0,
                        0,
                        0.95
                    );
            }


            /*
             * Não aumentamos e nem diminuímos
             * o botão do menu.
             *
             * Só permitimos que o JS controle
             * a posição dele.
             */
            .${ORIGINAL_HEADER_CLASS}
            button,

            .${ORIGINAL_HEADER_CLASS}
            [role="button"] {

                right:
                    auto !important;

                z-index:
                    101;
            }
        `;


        document.head
            ?.appendChild(
                style
            );
    }


    // ==================================================
    // PREPARAR SIDEBAR
    // ==================================================

    function prepareSidebar(
        sidebar
    ) {

        if (!sidebar) {
            return;
        }


        const style =
            getComputedStyle(
                sidebar
            );


        if (
            style.position ===
            "static"
        ) {

            sidebar.style.position =
                "relative";
        }


        currentSidebar =
            sidebar;
    }


    // ==================================================
    // POSICIONAR HEADER ORIGINAL
    // ==================================================

    function positionOriginalHeader(
        sidebar,
        serverName
    ) {

        const header =
            findOriginalServerHeader(
                sidebar,
                serverName
            );


        if (
            !header
        ) {

            console.warn(
                "[Server Branding] header original do servidor ainda não encontrado."
            );


            return false;
        }


        if (
            currentOriginalHeader &&
            currentOriginalHeader !==
            header
        ) {

            currentOriginalHeader
                .classList
                .remove(
                    ORIGINAL_HEADER_CLASS
                );
        }


        currentOriginalHeader =
            header;


        header.classList.add(
            ORIGINAL_HEADER_CLASS
        );


        /*
         * Depois da classe mudar o layout,
         * esperamos um frame antes de medir.
         */
        requestAnimationFrame(
            () => {

                if (
                    header.isConnected &&
                    sidebar.isConnected
                ) {

                    alignHeaderMenuWithPlus(
                        sidebar,
                        header
                    );
                }
            }
        );


        /*
         * React pode recalcular o layout
         * logo depois.
         */
        setTimeout(
            () => {

                if (
                    header.isConnected &&
                    sidebar.isConnected
                ) {

                    alignHeaderMenuWithPlus(
                        sidebar,
                        header
                    );
                }

            },
            150
        );


        setTimeout(
            () => {

                if (
                    header.isConnected &&
                    sidebar.isConnected
                ) {

                    alignHeaderMenuWithPlus(
                        sidebar,
                        header
                    );
                }

            },
            500
        );


        console.log(
            "[Server Branding] header original posicionado sobre o banner."
        );


        return true;
    }


    // ==================================================
    // PERFIL
    // ==================================================

    function applyProfile(
        profile
    ) {

        currentProfile = {

            url:
                profile?.url ||
                SERVER_URL,

            name:
                profile?.name ||
                guessServerName(),

            avatarDataUrl:
                profile?.logo
                    ? buildServerFileUrl(
                        profile.logo
                    )
                    : null,

            bannerDataUrl:
                profile?.banner
                    ? buildServerFileUrl(
                        profile.banner
                    )
                    : null
        };


        const root =
            document.getElementById(
                BRAND_ROOT_ID
            );


        if (
            !root
        ) {

            return;
        }


        const avatarImage =
            root.querySelector(
                ".skr-brand-avatar-image"
            );


        const bannerImage =
            root.querySelector(
                ".skr-brand-banner-image"
            );


        const initials =
            root.querySelector(
                ".skr-brand-initials"
            );


        if (
            initials
        ) {

            initials.textContent =
                getInitials(
                    currentProfile.name
                );
        }


        // ==============================================
        // AVATAR
        // ==============================================

        if (
            currentProfile.avatarDataUrl
        ) {

            if (
                avatarImage
            ) {

                avatarImage.src =
                    currentProfile
                        .avatarDataUrl;
            }


            root.classList.add(
                "has-avatar"
            );

        } else {

            avatarImage
                ?.removeAttribute(
                    "src"
                );


            root.classList.remove(
                "has-avatar"
            );
        }


        // ==============================================
        // BANNER
        // ==============================================

        if (
            currentProfile.bannerDataUrl
        ) {

            if (
                bannerImage
            ) {

                bannerImage.src =
                    currentProfile
                        .bannerDataUrl;
            }


            root.classList.add(
                "has-banner"
            );

        } else {

            bannerImage
                ?.removeAttribute(
                    "src"
                );


            root.classList.remove(
                "has-banner"
            );
        }


        // ==============================================
        // HEADER
        // ==============================================

        if (
            currentSidebar
        ) {

            positionOriginalHeader(
                currentSidebar,
                currentProfile.name
            );
        }
    }


    // ==================================================
    // EDIÇÃO SERVER-SIDE
    // ==================================================

    let brandingChangeInProgress =
        false;


    function getSharkordToken() {

        /*
         * O cliente oficial do Sharkord v0.0.23 usa exatamente
         * SessionStorageKey.TOKEN = "sharkord-token" para o tRPC.
         * Não devemos varrer localStorage primeiro, pois pode existir
         * um token de auto-login diferente da sessão atualmente aberta.
         */
        try {

            const sessionToken =
                sessionStorage.getItem(
                    "sharkord-token"
                );


            if (
                sessionToken
            ) {

                return sessionToken;
            }

        } catch {}


        return null;
    }


    function getRememberedServerPassword() {

        try {

            return (
                localStorage.getItem(
                    "sharkord-server-password"
                ) ||
                null
            );

        } catch {

            return null;
        }
    }


    function runSharkordMutation(
        path,
        input,
        token
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const websocketUrl =
                    new URL(
                        SERVER_URL
                    );


                websocketUrl.protocol =
                    websocketUrl.protocol ===
                    "https:"
                        ? "wss:"
                        : "ws:";


                websocketUrl.search =
                    "?connectionParams=1";


                const socket =
                    new WebSocket(
                        websocketUrl.toString()
                    );


                const handshakeId =
                    1;

                const joinId =
                    2;

                const mutationId =
                    3;


                let settled =
                    false;

                let handshakeSent =
                    false;

                let joinSent =
                    false;

                let mutationSent =
                    false;


                const finish =
                    (
                        error,
                        value
                    ) => {

                        if (
                            settled
                        ) {

                            return;
                        }


                        settled =
                            true;


                        clearTimeout(
                            timeout
                        );


                        try {

                            socket.close();

                        } catch {}


                        if (
                            error
                        ) {

                            reject(
                                error
                            );

                        } else {

                            resolve(
                                value
                            );
                        }
                    };


                const timeout =
                    setTimeout(
                        () => {

                            finish(
                                new Error(
                                    "A alteração do branding demorou demais para responder."
                                )
                            );
                        },
                        15000
                    );


                const sendHandshake =
                    () => {

                        if (
                            handshakeSent ||
                            socket.readyState !== WebSocket.OPEN
                        ) {

                            return;
                        }


                        handshakeSent =
                            true;


                        socket.send(
                            JSON.stringify({
                                id:
                                handshakeId,

                                method:
                                    "query",

                                params: {
                                    path:
                                        "others.handshake"
                                }
                            })
                        );
                    };


                const sendJoin =
                    handshakeData => {

                        if (
                            joinSent ||
                            socket.readyState !== WebSocket.OPEN
                        ) {

                            return;
                        }


                        const handshakeHash =
                            handshakeData?.handshakeHash;


                        if (
                            !handshakeHash
                        ) {

                            finish(
                                new Error(
                                    "O Sharkord não retornou o handshakeHash necessário para autenticar a conexão."
                                )
                            );


                            return;
                        }


                        const joinInput = {
                            handshakeHash
                        };


                        if (
                            handshakeData?.hasPassword
                        ) {

                            const password =
                                getRememberedServerPassword();


                            if (
                                !password
                            ) {

                                finish(
                                    new Error(
                                        "O servidor exige senha e ela não está disponível no armazenamento do Sharkord."
                                    )
                                );


                                return;
                            }


                            joinInput.password =
                                password;
                        }


                        joinSent =
                            true;


                        socket.send(
                            JSON.stringify({
                                id:
                                joinId,

                                method:
                                    "query",

                                params: {
                                    input:
                                    joinInput,

                                    path:
                                        "others.joinServer"
                                }
                            })
                        );
                    };


                const sendMutation =
                    () => {

                        if (
                            mutationSent ||
                            socket.readyState !== WebSocket.OPEN
                        ) {

                            return;
                        }


                        mutationSent =
                            true;


                        socket.send(
                            JSON.stringify({
                                id:
                                mutationId,

                                method:
                                    "mutation",

                                params: {
                                    input,
                                    path
                                }
                            })
                        );
                    };


                socket.addEventListener(
                    "open",
                    () => {

                        /*
                         * O token valida a identidade da conexão, mas o Sharkord
                         * ainda cria ctx.authenticated=false. Para acessar uma
                         * protectedProcedure precisamos repetir o fluxo oficial:
                         * connectionParams -> handshake -> joinServer -> mutation.
                         */
                        socket.send(
                            JSON.stringify({
                                method:
                                    "connectionParams",

                                data: {
                                    token
                                }
                            })
                        );


                        // A primeira mensagem é reservada aos connectionParams.
                        // Enviamos o handshake na tarefa seguinte para manter a
                        // negociação na mesma ordem usada pelo cliente tRPC.
                        setTimeout(
                            sendHandshake,
                            0
                        );
                    }
                );


                socket.addEventListener(
                    "message",
                    event => {

                        let message;


                        try {

                            message =
                                JSON.parse(
                                    String(
                                        event.data ||
                                        ""
                                    )
                                );

                        } catch {

                            return;
                        }


                        const messages =
                            Array.isArray(
                                message
                            )
                                ? message
                                : [
                                    message
                                ];


                        for (
                            const item
                            of messages
                            ) {

                            if (
                                item?.id === handshakeId
                            ) {

                                if (
                                    item?.error
                                ) {

                                    finish(
                                        new Error(
                                            item.error?.message ||
                                            item.error?.data?.message ||
                                            "Falha no handshake do Sharkord."
                                        )
                                    );


                                    return;
                                }


                                const handshakeData =
                                    item?.result?.data?.data ||
                                    item?.result?.data;


                                if (
                                    handshakeData
                                ) {

                                    sendJoin(
                                        handshakeData
                                    );
                                }


                                continue;
                            }


                            if (
                                item?.id === joinId
                            ) {

                                if (
                                    item?.error
                                ) {

                                    finish(
                                        new Error(
                                            item.error?.message ||
                                            item.error?.data?.message ||
                                            "Falha ao autenticar a conexão auxiliar do Sharkord."
                                        )
                                    );


                                    return;
                                }


                                if (
                                    item?.result
                                ) {

                                    sendMutation();
                                }


                                continue;
                            }


                            if (
                                item?.id !== mutationId
                            ) {

                                continue;
                            }


                            if (
                                item?.error
                            ) {

                                finish(
                                    new Error(
                                        item.error?.message ||
                                        item.error?.data?.message ||
                                        "O Sharkord recusou a alteração do branding."
                                    )
                                );


                                return;
                            }


                            if (
                                item?.result
                            ) {

                                finish(
                                    null,
                                    item.result
                                );


                                return;
                            }
                        }
                    }
                );


                socket.addEventListener(
                    "error",
                    () => {

                        finish(
                            new Error(
                                "Falha na conexão WebSocket usada para alterar o branding."
                            )
                        );
                    }
                );


                socket.addEventListener(
                    "close",
                    () => {

                        if (
                            !settled
                        ) {

                            finish(
                                new Error(
                                    "A conexão com o Sharkord foi encerrada antes da confirmação."
                                )
                            );
                        }
                    }
                );
            }
        );
    }


    async function chooseBrandingImage(
        type,
        element
    ) {
// BRANDING EDIT MOVED TO REACT V7.6
        // Edicao de logo/banner agora vive em:
        // Server Settings > General.
        return;

        if (
            brandingChangeInProgress
        ) {

            return;
        }


        const token =
            getSharkordToken();


        if (
            !token
        ) {

            console.error(
                "[Server Branding] token do Sharkord não encontrado."
            );


            return;
        }


        brandingChangeInProgress =
            true;


        element?.setAttribute(
            "aria-busy",
            "true"
        );


        try {

            const result =
                await ipcRenderer.invoke(
                    "server:branding:choose-image",
                    {
                        serverUrl:
                        SERVER_URL,

                        type,

                        token
                    }
                );


            if (
                result?.cancelled
            ) {

                return;
            }


            const fileId =
                result?.file?.id;


            if (
                !fileId
            ) {

                throw new Error(
                    "Upload concluído sem ID de arquivo."
                );
            }


            const mutationPath =
                type ===
                "banner"
                    ? "others.changeBanner"
                    : "others.changeLogo";


            await runSharkordMutation(
                mutationPath,
                {
                    fileId
                },
                token
            );


            console.log(
                "[Server Branding] alterado no servidor:",
                {
                    type,
                    fileId
                }
            );


            /*
             * Não aplicamos a imagem escolhida localmente.
             * O servidor publica a nova configuração e o
             * listener server-branding:server-data reaplica
             * logo/banner a partir de /public/<arquivo>.
             */

        } catch (error) {

            console.error(
                "[Server Branding] erro alterando imagem:",
                error
            );

        } finally {

            brandingChangeInProgress =
                false;


            element?.removeAttribute(
                "aria-busy"
            );
        }
    }


    // ==================================================
    // CRIAR BRANDING
    // ==================================================

    function createBrandingElement() {

        const root =
            document.createElement(
                "div"
            );


        root.id =
            BRAND_ROOT_ID;


        /*
         * Não adicionamos outro título.
         *
         * O nome visível continua sendo
         * o original do Sharkord.
         */
        root.innerHTML = `

            <div
                class="skr-brand-banner"
                title="Clique para alterar o banner"
            >

                <img
                    class="skr-brand-banner-image"
                    alt=""
                >

                <div
                    class="skr-brand-shade"
                ></div>

                <div
                    class="skr-brand-banner-edit"
                >
                    Alterar banner
                </div>

            </div>


            <div
                class="skr-brand-avatar-wrap"
            >

                <div
                    class="skr-brand-avatar"
                    title="Clique para alterar o avatar"
                >

                    <span
                        class="skr-brand-initials"
                    >
                        ${getInitials(
            currentProfile?.name ||
            guessServerName()
        )}
                    </span>


                    <img
                        class="skr-brand-avatar-image"
                        alt=""
                    >


                    <div
                        class="skr-brand-avatar-edit"
                    >
                        Alterar
                    </div>

                </div>

            </div>


            <div
                class="skr-brand-hint"
                aria-hidden="true"
            ></div>
        `;


        // ==============================================
        // BANNER
        // ==============================================

        root.querySelector(
            ".skr-brand-banner"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();


                event.stopPropagation();


                void chooseBrandingImage(
                    "banner",
                    event.currentTarget
                );
            },
            true
        );


        // ==============================================
        // AVATAR
        // ==============================================

        root.querySelector(
            ".skr-brand-avatar"
        )?.addEventListener(
            "click",
            event => {

                event.preventDefault();


                event.stopPropagation();


                void chooseBrandingImage(
                    "avatar",
                    event.currentTarget
                );
            },
            true
        );


        return root;
    }


    // ==================================================
    // INSTALAR
    // ==================================================

    async function ensureBranding() {

        const sidebar =
            findSidebar();


        if (
            !sidebar
        ) {

            return false;
        }


        prepareSidebar(
            sidebar
        );


        ensureStyles();


        let root =
            document.getElementById(
                BRAND_ROOT_ID
            );


        if (
            !root ||
            !root.isConnected
        ) {

            root =
                createBrandingElement();


            sidebar.insertBefore(
                root,
                sidebar.firstChild
            );


            console.log(
                "[Server Branding] banner instalado."
            );
        }


        applyProfile(
            currentProfile ||
            {
                url:
                SERVER_URL,

                name:
                    guessServerName()
            }
        );


        positionOriginalHeader(
            sidebar,
            currentProfile?.name ||
            guessServerName()
        );


        return true;
    }


    // ==================================================
    // AGENDAR INSTALAÇÃO
    // ==================================================

    function scheduleInstall() {

        if (
            installTimer
        ) {

            clearTimeout(
                installTimer
            );
        }


        installTimer =
            setTimeout(
                () => {

                    installTimer =
                        null;


                    void ensureBranding();
                },
                100
            );
    }


    // ==================================================
    // REALINHAR
    // ==================================================

    function realignHeaderMenu() {

        if (
            !currentSidebar ||
            !currentSidebar.isConnected ||
            !currentOriginalHeader ||
            !currentOriginalHeader.isConnected
        ) {

            return;
        }


        alignHeaderMenuWithPlus(
            currentSidebar,
            currentOriginalHeader
        );
    }


    // ==================================================
    // RESIZE
    // ==================================================

    window.addEventListener(
        "resize",
        () => {

            requestAnimationFrame(
                realignHeaderMenu
            );
        }
    );


    // ==================================================
    // INICIAR
    // ==================================================

    async function initialize() {

        ensureStyles();


        currentProfile = {

            url:
            SERVER_URL,

            name:
                guessServerName(),

            logo:
                null,

            banner:
                null
        };


        ipcRenderer.on(
            "server-branding:server-data",
            (
                _event,
                serverData
            ) => {

                if (
                    !serverData ||
                    typeof serverData !== "object"
                ) {

                    return;
                }


                currentProfile = {

                    url:
                    SERVER_URL,

                    name:
                        serverData.name ||
                        guessServerName(),

                    logo:
                        serverData.logo ||
                        null,

                    banner:
                        serverData.banner ||
                        null
                };


                console.log(
                    "[Server Branding] branding server-side recebido:",
                    {
                        name:
                        currentProfile.name,

                        logo:
                            currentProfile.logo?.name ||
                            null,

                        banner:
                            currentProfile.banner?.name ||
                            null
                    }
                );


                void ensureBranding();
            }
        );


        await ensureBranding();


        /*
         * O Sharkord é renderizado com React.
         * Fazemos algumas passadas para pegar
         * elementos que aparecem depois.
         */

        setTimeout(
            () => {

                void ensureBranding();

            },
            250
        );


        setTimeout(
            () => {

                void ensureBranding();

            },
            600
        );


        setTimeout(
            () => {

                void ensureBranding();

            },
            1200
        );


        setTimeout(
            () => {

                void ensureBranding();

            },
            2200
        );


        // ==============================================
        // MUTATION OBSERVER
        // ==============================================

        if (
            !observer &&
            document.documentElement
        ) {

            observer =
                new MutationObserver(
                    () => {

                        const root =
                            document.getElementById(
                                BRAND_ROOT_ID
                            );


                        /*
                         * Se o React recriou elementos
                         * importantes, instala novamente.
                         */
                        if (
                            !root ||
                            !root.isConnected ||
                            !currentOriginalHeader ||
                            !currentOriginalHeader
                                .isConnected
                        ) {

                            scheduleInstall();


                            return;
                        }


                        /*
                         * Se só mudou algum canal/categoria,
                         * recalculamos a posição do menu.
                         */
                        if (
                            !installTimer
                        ) {

                            installTimer =
                                setTimeout(
                                    () => {

                                        installTimer =
                                            null;


                                        realignHeaderMenu();
                                    },
                                    80
                                );
                        }
                    }
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


        console.log(
            "[Server Branding] v3.0 - branding server-side + alinhamento X pelo + e Y pelo título."
        );
    }


    // ==================================================
    // DOM READY
    // ==================================================

    if (
        document.readyState ===
        "loading"
    ) {

        window.addEventListener(
            "DOMContentLoaded",
            () => {

                void initialize();
            },
            {
                once:
                    true
            }
        );

    } else {

        void initialize();
    }
}

// BRANDING READONLY STYLE V7.6
(() => {
    const installBrandingReadonlyStyle = () => {
        if (
            document.getElementById(
                "skr-branding-readonly-v76"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "skr-branding-readonly-v76";

        style.textContent = `
            .skr-brand-banner-edit,
            .skr-brand-avatar-edit,
            .skr-brand-hint {
                display: none !important;
            }

            .skr-brand-banner,
            .skr-brand-avatar,
            .skr-brand-avatar-wrap {
                cursor: default !important;
            }
        `;

        (
            document.head ||
            document.documentElement
        ).appendChild(
            style
        );
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            installBrandingReadonlyStyle,
            {
                once: true
            }
        );
    } else {
        installBrandingReadonlyStyle();
    }
})();
