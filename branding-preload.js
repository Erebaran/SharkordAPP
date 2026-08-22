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
    // SERVER-SIDE BRANDING
    // ==================================================

    function buildPublicFileUrl(
        file
    ) {

        if (
            !file ||
            !file.name
        ) {

            return null;
        }


        try {

            return new URL(
                `/public/${encodeURIComponent(
                    file.name
                )}`,
                SERVER_URL
            ).toString();

        } catch {

            return null;
        }
    }


    function applyServerBranding(
        data
    ) {

        if (
            !data ||
            typeof data !==
            "object"
        ) {

            return;
        }


        const nextProfile = {

            url:
            SERVER_URL,

            name:
                data.name ||
                currentProfile?.name ||
                guessServerName(),

            avatarDataUrl:
                buildPublicFileUrl(
                    data.logo
                ),

            bannerDataUrl:
                buildPublicFileUrl(
                    data.banner
                )
        };


        currentProfile =
            nextProfile;


        console.log(
            "[Server Branding] branding server-side recebido:",
            {
                name:
                nextProfile.name,

                logo:
                    data.logo?.name ||
                    null,

                banner:
                    data.banner?.name ||
                    null
            }
        );


        applyProfile(
            nextProfile
        );


        scheduleInstall();
    }


    ipcRenderer.on(
        "server-branding:server-data",
        (
            _event,
            data
        ) => {

            applyServerBranding(
                data
            );
        }
    );


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
                name ||
                "Servidor"
            )
                .trim()
                .split(
                    /\s+/
                )
                .filter(
                    Boolean
                );


        return (
            parts
                .slice(
                    0,
                    2
                )
                .map(
                    part =>
                        part[0]
                            ?.toUpperCase() ||
                        ""
                )
                .join("") ||
            "S"
        );
    }


    function guessServerName() {

        const labels =
            location.hostname
                .split(".")
                .filter(
                    Boolean
                );


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


    function isVisible(
        element
    ) {

        if (
            !element
        ) {

            return false;
        }


        const rect =
            element
                .getBoundingClientRect();


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

        if (
            !element
        ) {

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
                .filter(
                    Boolean
                )
                .join(
                    " "
                )
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
                    node
                        .getBoundingClientRect();


                if (
                    rect.width >=
                    180 &&

                    rect.width <=
                    360 &&

                    rect.height >=
                    window.innerHeight *
                    0.55 &&

                    rect.left <=
                    420
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

        if (
            !sidebar
        ) {

            return null;
        }


        const normalizedName =
            normalizeText(
                serverName
            );


        const sidebarRect =
            sidebar
                .getBoundingClientRect();


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
                    ].join(
                        ","
                    )
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
                    node
                        .getBoundingClientRect();


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
                    rect.height >=
                    35 &&

                    rect.height <=
                    80
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
                    relativeTop >=
                    -5 &&

                    relativeTop <=
                    220
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

        if (
            !header
        ) {

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
                element
                    .getBoundingClientRect();


            const area =
                rect.width *
                rect.height;


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

        if (
            !sidebar
        ) {

            return null;
        }


        const sidebarRect =
            sidebar
                .getBoundingClientRect();


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


            if (
                currentOriginalHeader &&
                currentOriginalHeader.contains(
                    button
                )
            ) {

                continue;
            }


            const rect =
                button
                    .getBoundingClientRect();


            if (
                rect.width >
                55 ||

                rect.height >
                55
            ) {

                continue;
            }


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
                description ===
                "+"
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


            if (
                relativeCenterX >
                sidebarRect.width *
                0.60
            ) {

                score +=
                    150;
            }


            score +=
                relativeCenterX;


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


        return (
            bestScore >=
            100
                ? best
                : null
        );
    }


    // ==================================================
    // ENCONTRAR BOTÃO ☰
    // ==================================================

    function findHeaderMenuButton(
        header
    ) {

        if (
            !header
        ) {

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


        buttons.sort(
            (
                a,
                b
            ) =>
                b
                    .getBoundingClientRect()
                    .left -
                a
                    .getBoundingClientRect()
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

            return false;
        }


        const menuButton =
            findHeaderMenuButton(
                header
            );


        if (
            !menuButton
        ) {

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


        const plusCenterX =
            plusRect.left +
            plusRect.width /
            2;


        const desiredCenterX =
            plusCenterX -
            headerRect.left;


        let desiredCenterY =
            headerRect.height /
            2;


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


        menuButton.style.setProperty(
            "transform",
            "translate(-50%, -50%)",
            "important"
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

            #${BRAND_ROOT_ID} {
                position: relative;
                flex: 0 0 auto;
                width: 100%;
                height: 166px;
                margin: 0;
                overflow: visible;
                user-select: none;
                z-index: 4;
            }

            #${BRAND_ROOT_ID}
            .skr-brand-banner {
                position: absolute;
                left: 0;
                top: 0;
                right: 0;
                width: 100%;
                height: 126px;
                overflow: hidden;
                background:
                    radial-gradient(
                        circle at 18% 0%,
                        rgba(88, 101, 242, 0.34),
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
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center;
                display: none;
            }

            #${BRAND_ROOT_ID}.has-banner
            .skr-brand-banner-image {
                display: block;
            }

            #${BRAND_ROOT_ID}
            .skr-brand-shade {
                position: absolute;
                inset: 0;
                background:
                    linear-gradient(
                        to bottom,
                        rgba(0,0,0,0.48) 0%,
                        rgba(0,0,0,0.10) 45%,
                        rgba(0,0,0,0.55) 100%
                    );
                pointer-events: none;
            }

            #${BRAND_ROOT_ID}
            .skr-brand-avatar-wrap {
                position: absolute;
                left: 16px;
                top: 94px;
                z-index: 20;
                width: 64px;
                height: 64px;
                border-radius: 17px;
                padding: 3px;
                background: #1e1f22;
                box-shadow:
                    0 4px 14px
                    rgba(0,0,0,0.38);
            }

            #${BRAND_ROOT_ID}
            .skr-brand-avatar {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 14px;
                background:
                    linear-gradient(
                        135deg,
                        #5865f2,
                        #7b5cff
                    );
                color: #fff;
                font-size: 20px;
                font-weight: 750;
                letter-spacing: 0.5px;
            }

            #${BRAND_ROOT_ID}
            .skr-brand-avatar-image {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center;
                display: none;
            }

            #${BRAND_ROOT_ID}.has-avatar
            .skr-brand-avatar-image {
                display: block;
            }

            #${BRAND_ROOT_ID}
            .skr-brand-hint {
                position: absolute;
                left: 92px;
                right: 12px;
                top: 136px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color:
                    rgba(
                        255,
                        255,
                        255,
                        0.47
                    );
                font-size: 10px;
                pointer-events: none;
            }

            .${ORIGINAL_HEADER_CLASS} {
                position: absolute !important;
                left: 0 !important;
                right: 0 !important;
                top: 0 !important;
                width: 100% !important;
                z-index: 100 !important;
                margin: 0 !important;
                padding-left: 16px !important;
                padding-right: 0 !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }

            .${ORIGINAL_HEADER_CLASS},
            .${ORIGINAL_HEADER_CLASS} * {
                color: white !important;
                text-shadow:
                    0 1px 2px
                    rgba(0,0,0,0.95);
            }

            .${ORIGINAL_HEADER_CLASS}
            button,

            .${ORIGINAL_HEADER_CLASS}
            [role="button"] {
                right: auto !important;
                z-index: 101;
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

        if (
            !sidebar
        ) {

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
                profile
                    ?.avatarDataUrl ||
                null,

            bannerDataUrl:
                profile
                    ?.bannerDataUrl ||
                null
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
    // CRIAR BRANDING
    // ==================================================

    function createBrandingElement() {

        const root =
            document.createElement(
                "div"
            );


        root.id =
            BRAND_ROOT_ID;


        root.innerHTML = `

            <div
                class="skr-brand-banner"
            >

                <img
                    class="skr-brand-banner-image"
                    alt=""
                >

                <div
                    class="skr-brand-shade"
                ></div>

            </div>


            <div
                class="skr-brand-avatar-wrap"
            >

                <div
                    class="skr-brand-avatar"
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

                </div>

            </div>


            <div
                class="skr-brand-hint"
            >
                Branding definido pelo servidor
            </div>
        `;


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

            avatarDataUrl:
                null,

            bannerDataUrl:
                null
        };


        await ensureBranding();


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
            "[Server Branding] v3 - server-side."
        );
    }


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