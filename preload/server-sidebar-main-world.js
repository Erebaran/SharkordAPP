const {
    contextBridge,
    ipcRenderer
} = require("electron");


// ======================================================
// API ISOLADA -> MAIN WORLD
// ======================================================

contextBridge.exposeInMainWorld(
    "sharkordDesktopServers",
    {
        getState:
            () =>
                ipcRenderer.invoke(
                    "server-sidebar:get-state"
                ),

        connect:
            serverUrl =>
                ipcRenderer.invoke(
                    "server-sidebar:connect",
                    serverUrl
                ),

        add:
            serverUrl =>
                ipcRenderer.invoke(
                    "server-sidebar:add",
                    serverUrl
                ),

        remove:
            serverUrl =>
                ipcRenderer.invoke(
                    "server-sidebar:remove",
                    serverUrl
                ),

        onMemberData:
            callback => {

                if (
                    typeof callback !==
                    "function"
                ) {

                    return () => {};
                }


                const listener =
                    (
                        _event,
                        data
                    ) => {

                        callback(
                            data
                        );
                    };


                ipcRenderer.on(
                    "member-roles:server-data",
                    listener
                );


                return () => {

                    ipcRenderer.removeListener(
                        "member-roles:server-data",
                        listener
                    );
                };
            }
    }
);


// ======================================================
// UI NO MAIN WORLD
// ======================================================

contextBridge.executeInMainWorld({

    func: () => {

        if (
            Reflect.get(
                window,
                "__sharkordServerSidebarInstalled"
            )
        ) {

            return;
        }


        Reflect.set(
            window,
            "__sharkordServerSidebarInstalled",
            true
        );


        const ROOT_ID =
            "__sharkord_server_sidebar";

        const STYLE_ID =
            "__sharkord_server_sidebar_style";

        const MODAL_ID =
            "__sharkord_server_sidebar_modal";

        const CONTEXT_MENU_ID =
            "__sharkord_server_sidebar_context";

        const TOP_TITLE_ID =
            "__sharkord_server_top_title";

        const SERVER_BANNER_ID =
            "__sharkord_global_server_banner";

        const SERVER_AVATAR_ID =
            "__sharkord_global_server_avatar";

        const SIDEBAR_WIDTH =
            72;

        const TITLEBAR_HEIGHT =
            32;

        const APP_TOPBAR_HEIGHT =
            50;


        let sidebarState = {
            currentServer:
                null,

            appIconDataUrl:
                null,

            servers:
                []
        };


        let memberData = {
            users:
                [],

            roles:
                []
        };


        let layoutTimer =
            null;


        let directMessagesTarget =
            null;


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
                .trim()
                .toLowerCase();
        }


        function api() {

            return Reflect.get(
                window,
                "sharkordDesktopServers"
            );
        }


        function showToast(
            message,
            isError =
            false
        ) {

            const toast =
                document.createElement(
                    "div"
                );


            toast.textContent =
                message;


            toast.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:2147483647;
                max-width:360px;
                padding:11px 14px;
                border-radius:8px;
                border:1px solid ${
                isError
                    ? "rgba(239,68,68,.45)"
                    : "rgba(255,255,255,.14)"
            };
                background:#18181b;
                color:${
                isError
                    ? "#fca5a5"
                    : "#f4f4f5"
            };
                box-shadow:0 12px 35px rgba(0,0,0,.35);
                font:500 13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                pointer-events:none;
            `;


            document.body.appendChild(
                toast
            );


            setTimeout(
                () => {

                    toast.remove();
                },
                3200
            );
        }


        function firstLetter(
            name
        ) {

            const normalized =
                String(
                    name ||
                    "S"
                )
                    .trim();


            return (
                normalized[0] ||
                "S"
            ).toUpperCase();
        }


        function installGlobalStyle() {

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
                html {
                    width:100% !important;
                    height:100vh !important;
                    box-sizing:border-box !important;
                    padding-left:${SIDEBAR_WIDTH}px !important;
                    padding-top:${TITLEBAR_HEIGHT}px !important;
                    overflow:hidden !important;
                    background:#111214 !important;
                }

                body {
                    width:100% !important;
                    height:calc(100vh - ${TITLEBAR_HEIGHT}px) !important;
                    min-height:0 !important;
                    max-height:calc(100vh - ${TITLEBAR_HEIGHT}px) !important;
                    min-width:0 !important;
                    overflow:hidden !important;
                    box-sizing:border-box !important;
                }

                body > div:first-child {
                    height:100% !important;
                    min-height:0 !important;
                    max-height:100% !important;
                }

                #${ROOT_ID} {
                    position:fixed;
                    left:0;
                    top:${TITLEBAR_HEIGHT}px;
                    bottom:0;
                    width:${SIDEBAR_WIDTH}px;
                    z-index:2147483000;
                    box-sizing:border-box;
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    padding:12px 0;
                    background:#2b171c;
                    border-right:1px solid rgba(0,0,0,.30);
                    font-family:
                        system-ui,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                    user-select:none;
                }

                #${ROOT_ID} * {
                    box-sizing:border-box;
                }

                #${ROOT_ID} .sharkord-server-scroll {
                    width:100%;
                    flex:1 1 auto;
                    min-height:0;
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    gap:8px;
                    overflow-x:hidden;
                    overflow-y:auto;
                    scrollbar-width:none;
                }

                #${ROOT_ID} .sharkord-server-scroll::-webkit-scrollbar {
                    display:none;
                }

                #${ROOT_ID} .sharkord-server-button {
                    position:relative;
                    flex:0 0 auto;
                    width:48px;
                    height:48px;
                    padding:0;
                    border:0;
                    border-radius:50%;
                    overflow:visible;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#313338;
                    color:#dbdee1;
                    cursor:pointer;
                    outline:none;
                    transition:
                        border-radius .16s ease,
                        background .16s ease,
                        color .16s ease;
                }

                #${ROOT_ID} .sharkord-server-button:hover {
                    border-radius:16px;
                    background:#5865f2;
                    color:#fff;
                }

                #${ROOT_ID} .sharkord-server-button.active {
                    border-radius:50%;
                    background:#313338;
                    color:#fff;
                    box-shadow:
                        0 0 0 3px #1e1f22,
                        0 0 0 6px #f2f3f5;
                }

                #${ROOT_ID} .sharkord-server-button.active:hover {
                    border-radius:16px;
                    background:#5865f2;
                    box-shadow:
                        0 0 0 3px #1e1f22,
                        0 0 0 6px #f2f3f5;
                }

                #${ROOT_ID} .sharkord-server-button.add:hover {
                    background:#23a559;
                }

                #${ROOT_ID} .sharkord-server-button img {
                    display:block;
                    width:100%;
                    height:100%;
                    border-radius:inherit;
                    object-fit:cover;
                    pointer-events:none;
                }

                #${ROOT_ID} .sharkord-server-letter {
                    font-size:17px;
                    font-weight:700;
                    line-height:1;
                    pointer-events:none;
                }

                #${ROOT_ID} .sharkord-server-divider {
                    flex:0 0 auto;
                    width:32px;
                    height:2px;
                    margin:0 0 2px;
                    border-radius:1px;
                    background:#35363c;
                }

                #${ROOT_ID} .sharkord-app-logo {
                    font-size:24px;
                    font-weight:800;
                }

                #${ROOT_ID} .sharkord-plus {
                    font-size:30px;
                    font-weight:300;
                    line-height:1;
                    transform:translateY(-1px);
                }

                #${TOP_TITLE_ID} {
                    display:none !important;
                }

                #${SERVER_BANNER_ID} {
                    position:fixed;
                    left:${SIDEBAR_WIDTH}px;
                    top:calc(${TITLEBAR_HEIGHT}px + ${APP_TOPBAR_HEIGHT}px - 2px);
                    height:128px;
                    z-index:2147482000;
                    overflow:hidden;
                    background:
                        radial-gradient(
                            circle at 18% 0%,
                            rgba(88,101,242,.34),
                            transparent 56%
                        ),
                        linear-gradient(
                            135deg,
                            #17181b 0%,
                            #27292f 100%
                        );
                    background-position:center;
                    background-size:cover;
                    background-repeat:no-repeat;
                    box-shadow:0 12px 30px rgba(0,0,0,.18);
                    cursor:pointer;
                }

                #${SERVER_BANNER_ID}::after {
                    content:"";
                    position:absolute;
                    inset:0;
                    background:linear-gradient(
                        to bottom,
                        rgba(0,0,0,.34) 0%,
                        rgba(0,0,0,.08) 48%,
                        rgba(0,0,0,.48) 100%
                    );
                    pointer-events:none;
                }

                #${SERVER_AVATAR_ID} {
                    position:fixed;
                    left:calc(${SIDEBAR_WIDTH}px + 18px);
                    top:calc(
                        ${TITLEBAR_HEIGHT}px +
                        ${APP_TOPBAR_HEIGHT}px +
                        16px
                    );
                    z-index:2147482300;
                    width:72px;
                    height:72px;
                    padding:4px;
                    border:0;
                    border-radius:22px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    overflow:hidden;
                    background:#17181b;
                    box-shadow:
                        0 0 0 2px rgba(255,255,255,.14),
                        0 8px 24px rgba(0,0,0,.50);
                    cursor:pointer;
                }

                #${SERVER_AVATAR_ID}:hover {
                    box-shadow:
                        0 0 0 2px rgba(255,255,255,.34),
                        0 8px 24px rgba(0,0,0,.55);
                }

                #${SERVER_AVATAR_ID} img {
                    width:100%;
                    height:100%;
                    border-radius:18px;
                    display:block;
                    object-fit:cover;
                }

                #${SERVER_AVATAR_ID} span {
                    color:#fff;
                    font:800 24px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                }

                #${CONTEXT_MENU_ID} {
                    position:fixed;
                    z-index:2147483647;
                    min-width:190px;
                    padding:6px;
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:8px;
                    background:#111214;
                    color:#dbdee1;
                    box-shadow:0 18px 48px rgba(0,0,0,.50);
                    font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                }

                #${CONTEXT_MENU_ID} button {
                    width:100%;
                    min-height:34px;
                    padding:7px 10px;
                    border:0;
                    border-radius:5px;
                    display:flex;
                    align-items:center;
                    background:transparent;
                    color:#fa777c;
                    font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                    cursor:pointer;
                    text-align:left;
                }

                #${CONTEXT_MENU_ID} button:hover {
                    background:rgba(239,68,68,.14);
                }

                .__sharkord_member_banner_row {
                    position:relative !important;
                    overflow:hidden !important;
                    isolation:isolate;
                    min-height:44px;
                    background-position:center !important;
                    background-size:cover !important;
                    background-repeat:no-repeat !important;
                }

                .__sharkord_member_banner_row::before {
                    content:"";
                    position:absolute;
                    inset:0;
                    z-index:-1;
                    background:linear-gradient(
                        90deg,
                        rgba(17,18,20,.76),
                        rgba(17,18,20,.54)
                    );
                    pointer-events:none;
                }

                .__sharkord_member_banner_row,
                .__sharkord_member_banner_row * {
                    text-shadow:0 1px 2px rgba(0,0,0,.95);
                }

                #${MODAL_ID} {
                    position:fixed;
                    inset:0;
                    z-index:2147483646;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    padding:20px;
                    background:rgba(0,0,0,.56);
                    font-family:
                        system-ui,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                }

                #${MODAL_ID} .panel {
                    width:min(420px, calc(100vw - 40px));
                    padding:22px;
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:14px;
                    background:#1e1f22;
                    color:#f2f3f5;
                    box-shadow:0 24px 70px rgba(0,0,0,.55);
                }

                #${MODAL_ID} h2 {
                    margin:0;
                    font-size:20px;
                    line-height:1.25;
                }

                #${MODAL_ID} p {
                    margin:7px 0 18px;
                    color:#949ba4;
                    font-size:13px;
                    line-height:1.45;
                }

                #${MODAL_ID} label {
                    display:block;
                    margin:0 0 7px;
                    color:#b5bac1;
                    font-size:11px;
                    font-weight:700;
                    text-transform:uppercase;
                }

                #${MODAL_ID} input {
                    display:block;
                    width:100%;
                    height:42px;
                    padding:0 12px;
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:6px;
                    outline:none;
                    background:#111214;
                    color:#f2f3f5;
                    font:400 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                }

                #${MODAL_ID} input:focus {
                    border-color:#5865f2;
                }

                #${MODAL_ID} .error {
                    min-height:18px;
                    margin-top:8px;
                    color:#fa777c;
                    font-size:12px;
                }

                #${MODAL_ID} .actions {
                    display:flex;
                    align-items:center;
                    justify-content:flex-end;
                    gap:8px;
                    margin-top:14px;
                }

                #${MODAL_ID} button {
                    min-height:36px;
                    padding:0 14px;
                    border:0;
                    border-radius:5px;
                    color:#fff;
                    font:600 13px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                    cursor:pointer;
                }

                #${MODAL_ID} .cancel {
                    background:transparent;
                    color:#dbdee1;
                }

                #${MODAL_ID} .save {
                    background:#5865f2;
                }

                #${MODAL_ID} .save:disabled {
                    opacity:.55;
                    cursor:default;
                }
            `;


            (
                document.head ||
                document.documentElement
            ).appendChild(
                style
            );
        }


        function closeServerContextMenu() {

            document.getElementById(
                CONTEXT_MENU_ID
            )?.remove();
        }


        function renderGlobalServerAvatar() {

            if (
                !document.body
            ) {

                return;
            }


            let avatar =
                document.getElementById(
                    SERVER_AVATAR_ID
                );


            if (
                !avatar
            ) {

                avatar =
                    document.createElement(
                        "button"
                    );

                avatar.type =
                    "button";

                avatar.id =
                    SERVER_AVATAR_ID;


                avatar.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        const originalAvatar =
                            document.querySelector(
                                "#__sharkord_server_branding .skr-brand-avatar"
                            );


                        originalAvatar?.click();
                    }
                );


                document.body.appendChild(
                    avatar
                );
            }


            const current =
                sidebarState.servers.find(
                    item =>
                        item.url ===
                        sidebarState.currentServer
                );


            avatar.replaceChildren();


            if (
                current?.avatarDataUrl
            ) {

                const image =
                    document.createElement(
                        "img"
                    );

                image.alt =
                    current?.name ||
                    "Servidor";

                image.src =
                    current.avatarDataUrl;

                avatar.appendChild(
                    image
                );

            } else {

                const fallback =
                    document.createElement(
                        "span"
                    );

                fallback.textContent =
                    firstLetter(
                        current?.name ||
                        "S"
                    );

                avatar.appendChild(
                    fallback
                );
            }


            avatar.title =
                current?.name ||
                "Servidor";
        }


        function renderGlobalServerBanner() {

            if (
                !document.body
            ) {

                return;
            }


            let banner =
                document.getElementById(
                    SERVER_BANNER_ID
                );


            if (
                !banner
            ) {

                banner =
                    document.createElement(
                        "div"
                    );

                banner.id =
                    SERVER_BANNER_ID;


                banner.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        const originalBanner =
                            document.querySelector(
                                "#__sharkord_server_branding .skr-brand-banner"
                            );


                        originalBanner?.click();
                    }
                );


                document.body.appendChild(
                    banner
                );
            }


            const current =
                sidebarState.servers.find(
                    item =>
                        item.url ===
                        sidebarState.currentServer
                );


            if (
                current?.bannerDataUrl
            ) {

                banner.style.backgroundImage =
                    `linear-gradient(
                        to bottom,
                        rgba(0,0,0,.22),
                        rgba(0,0,0,.20)
                    ),
                    url("${String(
                        current.bannerDataUrl
                    ).replace(
                        /"/g,
                        '\\"'
                    )}")`;

            } else {

                banner.style.removeProperty(
                    "background-image"
                );
            }


            /*
             * O banner agora atravessa também a coluna de membros.
             */
            banner.style.right =
                "0";
        }


        function renderTopTitle() {

            document.getElementById(
                TOP_TITLE_ID
            )?.remove();
        }


        function findRightSidebar() {

            const viewportWidth =
                window.innerWidth;


            /*
             * 1) Caminho mais confiável:
             * localizar os cabeçalhos de cargo (OWNER / MEMBER)
             * e subir até o painel vertical da direita.
             */
            const roleHeading =
                Array.from(
                    document.querySelectorAll(
                        "div, span, p, h1, h2, h3, h4"
                    )
                ).find(
                    element => {

                        const text =
                            String(
                                element.textContent ||
                                ""
                            ).trim();


                        if (
                            !/^(OWNER|MEMBER)(\s*[—-]\s*\d+)?$/i.test(
                                text
                            )
                        ) {

                            return false;
                        }


                        const rect =
                            element.getBoundingClientRect();


                        return (
                            rect.width > 0 &&
                            rect.height > 0 &&
                            rect.left >
                            viewportWidth *
                            0.65
                        );
                    }
                );


            if (
                roleHeading
            ) {

                let node =
                    roleHeading;


                for (
                    let depth = 0;
                    node &&
                    node !== document.body &&
                    depth < 9;
                    depth += 1,
                        node =
                            node.parentElement
                ) {

                    const rect =
                        node.getBoundingClientRect();


                    if (
                        rect.width >= 180 &&
                        rect.width <= 420 &&
                        rect.height >=
                        window.innerHeight *
                        0.55 &&
                        rect.right >=
                        viewportWidth -
                        4
                    ) {

                        return node;
                    }
                }
            }


            /*
             * 2) Fallback pelos nomes conhecidos dos membros.
             */
            const userNames =
                memberData.users
                    .map(
                        user =>
                            normalizeText(
                                user?.name
                            )
                    )
                    .filter(Boolean);


            if (
                userNames.length
            ) {

                const candidates =
                    Array.from(
                        document.querySelectorAll(
                            "div, aside, section"
                        )
                    );


                let best =
                    null;

                let bestScore =
                    -Infinity;


                for (
                    const element
                    of candidates
                    ) {

                    if (
                        element.closest(
                            `#${ROOT_ID}`
                        )
                    ) {

                        continue;
                    }


                    const rect =
                        element.getBoundingClientRect();


                    if (
                        rect.width < 170 ||
                        rect.width > 430 ||
                        rect.height <
                        window.innerHeight *
                        0.45 ||
                        rect.left <
                        viewportWidth *
                        0.60
                    ) {

                        continue;
                    }


                    const text =
                        normalizeText(
                            element.textContent
                        );


                    let hits =
                        0;


                    for (
                        const name
                        of userNames
                        ) {

                        if (
                            text.includes(
                                name
                            )
                        ) {

                            hits +=
                                1;
                        }
                    }


                    if (
                        hits === 0
                    ) {

                        continue;
                    }


                    const score =
                        hits *
                        1000 +
                        rect.left -
                        Math.abs(
                            viewportWidth -
                            rect.right
                        ) *
                        6;


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


                if (
                    best
                ) {

                    return best;
                }
            }


            /*
             * 3) Último fallback geométrico:
             * maior painel alto encostado na direita.
             */
            const panels =
                Array.from(
                    document.querySelectorAll(
                        "aside, section, div"
                    )
                );


            let geometric =
                null;

            let geometricScore =
                -Infinity;


            for (
                const element
                of panels
                ) {

                if (
                    element.closest(
                        `#${ROOT_ID}`
                    )
                ) {

                    continue;
                }


                const rect =
                    element.getBoundingClientRect();


                if (
                    rect.width < 180 ||
                    rect.width > 360 ||
                    rect.height <
                    window.innerHeight *
                    0.60 ||
                    rect.left <
                    viewportWidth *
                    0.70
                ) {

                    continue;
                }


                const score =
                    rect.left +
                    rect.height -
                    Math.abs(
                        viewportWidth -
                        rect.right
                    ) *
                    20;


                if (
                    score >
                    geometricScore
                ) {

                    geometric =
                        element;

                    geometricScore =
                        score;
                }
            }


            return geometric;
        }


        function findMemberRow(
            user,
            rightSidebar
        ) {

            if (
                !user?.name ||
                !rightSidebar
            ) {

                return null;
            }


            const target =
                normalizeText(
                    user.name
                );


            const labels =
                Array.from(
                    rightSidebar.querySelectorAll(
                        "span, div"
                    )
                ).filter(
                    element =>
                        normalizeText(
                            element.textContent
                        ) ===
                        target
                );


            for (
                const label
                of labels
                ) {

                let node =
                    label;


                for (
                    let depth = 0;
                    node &&
                    node !== rightSidebar &&
                    depth < 7;
                    depth += 1,
                        node =
                            node.parentElement
                ) {

                    const rect =
                        node.getBoundingClientRect();


                    if (
                        rect.width >=
                        Math.min(
                            150,
                            rightSidebar
                                .getBoundingClientRect()
                                .width *
                            0.55
                        ) &&
                        rect.height >= 34 &&
                        rect.height <= 76
                    ) {

                        return node;
                    }
                }
            }


            return null;
        }


        function deriveBannerUrl(
            row,
            user
        ) {

            if (
                !user?.banner
            ) {

                return null;
            }


            const avatarImage =
                row?.querySelector(
                    "img"
                );


            const avatarSrc =
                avatarImage?.src;


            if (
                !avatarSrc
            ) {

                return null;
            }


            let result =
                avatarSrc;


            const avatarId =
                user?.avatar?.id;

            const bannerId =
                user?.banner?.id;


            if (
                avatarId != null &&
                bannerId != null &&
                result.includes(
                    String(
                        avatarId
                    )
                )
            ) {

                result =
                    result.replace(
                        String(
                            avatarId
                        ),
                        String(
                            bannerId
                        )
                    );
            }


            const avatarName =
                user?.avatar?.name;

            const bannerName =
                user?.banner?.name;


            if (
                avatarName &&
                bannerName
            ) {

                const pairs = [
                    [
                        avatarName,
                        bannerName
                    ],
                    [
                        encodeURIComponent(
                            avatarName
                        ),
                        encodeURIComponent(
                            bannerName
                        )
                    ]
                ];


                for (
                    const [
                        from,
                        to
                    ]
                    of pairs
                    ) {

                    if (
                        result.includes(
                            from
                        )
                    ) {

                        result =
                            result.replace(
                                from,
                                to
                            );

                        break;
                    }
                }
            }


            if (
                result ===
                avatarSrc
            ) {

                return null;
            }


            return result;
        }


        function decorateMemberRows() {

            const rightSidebar =
                findRightSidebar();


            if (
                !rightSidebar
            ) {

                return;
            }


            for (
                const user
                of memberData.users
                ) {

                const row =
                    findMemberRow(
                        user,
                        rightSidebar
                    );


                if (
                    !row
                ) {

                    continue;
                }


                row.classList.add(
                    "__sharkord_member_banner_row"
                );


                const bannerUrl =
                    deriveBannerUrl(
                        row,
                        user
                    );


                if (
                    bannerUrl
                ) {

                    row.style.backgroundImage =
                        `url("${bannerUrl.replace(
                            /"/g,
                            '\\"'
                        )}")`;

                } else if (
                    user.bannerColor
                ) {

                    row.style.backgroundImage =
                        "none";

                    row.style.backgroundColor =
                        user.bannerColor;
                }
            }
        }


        function placeSearchAboveMembers() {

            const input =
                Array.from(
                    document.querySelectorAll(
                        "input"
                    )
                ).find(
                    element =>
                        normalizeText(
                            element.placeholder
                        ) ===
                        "search for content..."
                );


            if (
                !input
            ) {

                return;
            }


            const rightSidebar =
                findRightSidebar();


            if (
                !rightSidebar
            ) {

                return;
            }


            let wrapper =
                input;


            for (
                let depth = 0;
                wrapper?.parentElement &&
                depth < 4;
                depth += 1
            ) {

                const parent =
                    wrapper.parentElement;

                const rect =
                    parent.getBoundingClientRect();


                if (
                    rect.width >=
                    input.getBoundingClientRect()
                        .width &&
                    rect.width <= 520 &&
                    rect.height <= 70
                ) {

                    wrapper =
                        parent;

                } else {

                    break;
                }
            }


            const sidebarRect =
                rightSidebar.getBoundingClientRect();


            wrapper.style.position =
                "fixed";

            wrapper.style.left =
                `${Math.round(
                    sidebarRect.left +
                    12
                )}px`;

            wrapper.style.top =
                `${
                    TITLEBAR_HEIGHT +
                    APP_TOPBAR_HEIGHT +
                    84
                }px`;

            wrapper.style.width =
                `${Math.max(
                    170,
                    Math.round(
                        sidebarRect.width -
                        24
                    )
                )}px`;

            wrapper.style.maxWidth =
                "none";

            wrapper.style.zIndex =
                "2147483500";

            wrapper.style.margin =
                "0";


            /*
             * Abre espaço acima de OWNER / cargos para o search.
             * Assim os usuários não ficam colados no campo.
             */
            rightSidebar.style.boxSizing =
                "border-box";

            rightSidebar.style.paddingTop =
                "128px";
        }


        function scheduleLayoutEnhancements() {

            if (
                layoutTimer
            ) {

                clearTimeout(
                    layoutTimer
                );
            }


            layoutTimer =
                setTimeout(
                    () => {

                        layoutTimer =
                            null;

                        renderTopTitle();

                        placeSearchAboveMembers();

                        renderGlobalServerBanner();

                        renderGlobalServerAvatar();

                        replaceDirectMessagesWithServerName();

                        decorateMemberRows();
                    },
                    70
                );
        }


        function openServerContextMenu(
            event,
            server
        ) {

            closeServerContextMenu();


            const menu =
                document.createElement(
                    "div"
                );


            menu.id =
                CONTEXT_MENU_ID;


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";

            button.textContent =
                "Remover servidor";


            button.addEventListener(
                "click",
                async clickEvent => {

                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();


                    button.disabled =
                        true;

                    button.textContent =
                        "Removendo...";


                    try {

                        await api().remove(
                            server.url
                        );


                        closeServerContextMenu();


                        const state =
                            await api().getState();


                        sidebarState = {
                            currentServer:
                                state?.currentServer ||
                                null,

                            appIconDataUrl:
                                state?.appIconDataUrl ||
                                null,

                            servers:
                                Array.isArray(
                                    state?.servers
                                )
                                    ? state.servers
                                    : []
                        };


                        renderSidebar();

                        scheduleLayoutEnhancements();

                    } catch (
                        error
                        ) {

                        button.disabled =
                            false;

                        button.textContent =
                            "Remover servidor";


                        showToast(
                            error?.message ||
                            "Não foi possível remover o servidor.",
                            true
                        );
                    }
                }
            );


            menu.appendChild(
                button
            );


            document.body.appendChild(
                menu
            );


            const width =
                210;

            const height =
                50;


            menu.style.left =
                `${Math.min(
                    event.clientX,
                    window.innerWidth -
                    width -
                    8
                )}px`;

            menu.style.top =
                `${Math.min(
                    event.clientY,
                    window.innerHeight -
                    height -
                    8
                )}px`;
        }


        function replaceDirectMessagesWithServerName() {

            const candidates =
                Array.from(
                    document.querySelectorAll(
                        "span, p, div"
                    )
                );


            const label =
                candidates.find(
                    element =>
                        normalizeText(
                            element.textContent
                        ) ===
                        "direct messages" &&
                        !element.closest(
                            `#${ROOT_ID}`
                        )
                );


            if (
                !label
            ) {

                return;
            }


            directMessagesTarget =
                label.closest(
                    "button, a, [role='button']"
                ) ||
                label.parentElement;


            const current =
                sidebarState.servers.find(
                    server =>
                        server.url ===
                        sidebarState.currentServer
                );


            label.textContent =
                current?.name ||
                "Servidor";


            const clickable =
                directMessagesTarget;


            if (
                clickable
            ) {

                clickable.style.cursor =
                    "default";

                clickable.style.pointerEvents =
                    "none";

                clickable.removeAttribute(
                    "href"
                );

                clickable.setAttribute(
                    "aria-label",
                    current?.name ||
                    "Servidor"
                );
            }
        }


        // ==================================================
        // DIRECT MESSAGES
        // ==================================================

        function clickDirectMessages() {

            if (
                directMessagesTarget &&
                directMessagesTarget.isConnected
            ) {

                /*
                 * O item visível da sidebar não é mais clicável,
                 * mas o botão da dock mantém a função de DM.
                 */
                const previousPointerEvents =
                    directMessagesTarget.style.pointerEvents;


                directMessagesTarget.style.pointerEvents =
                    "auto";


                try {

                    directMessagesTarget.click();

                } finally {

                    directMessagesTarget.style.pointerEvents =
                        previousPointerEvents ||
                        "none";
                }


                return true;
            }


            const candidates =
                Array.from(
                    document.querySelectorAll(
                        [
                            "button",
                            "[role='button']",
                            "a",
                            "div"
                        ].join(",")
                    )
                );


            let best =
                null;

            let bestScore =
                -Infinity;


            for (
                const element
                of candidates
                ) {

                if (
                    element.closest(
                        `#${ROOT_ID}`
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
                    "direct messages"
                ) {

                    continue;
                }


                const rect =
                    element.getBoundingClientRect();


                if (
                    rect.width <= 0 ||
                    rect.height <= 0
                ) {

                    continue;
                }


                let score =
                    1000;


                if (
                    element.matches(
                        "button, a, [role='button']"
                    )
                ) {

                    score +=
                        500;
                }


                score -=
                    Math.abs(
                        rect.left
                    );


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


            if (
                best
            ) {

                best.click();


                return true;
            }


            const textNodes =
                Array.from(
                    document.querySelectorAll(
                        "span, p"
                    )
                );


            const label =
                textNodes.find(
                    element =>
                        normalizeText(
                            element.textContent
                        ) ===
                        "direct messages"
                );


            const clickable =
                label?.closest(
                    "button, a, [role='button']"
                );


            if (
                clickable
            ) {

                clickable.click();


                return true;
            }


            showToast(
                "Direct Messages não está disponível nesta tela.",
                true
            );


            return false;
        }


        // ==================================================
        // BOTÕES
        // ==================================================

        function createCircleButton({
                                        title,
                                        image,
                                        letter,
                                        active =
                                        false,
                                        add =
                                        false
                                    }) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";

            button.className =
                "sharkord-server-button" +
                (
                    active
                        ? " active"
                        : ""
                ) +
                (
                    add
                        ? " add"
                        : ""
                );

            button.title =
                title;


            if (
                image
            ) {

                const img =
                    document.createElement(
                        "img"
                    );


                img.alt =
                    title;

                img.src =
                    image;


                button.appendChild(
                    img
                );

            } else {

                const fallback =
                    document.createElement(
                        "span"
                    );


                fallback.className =
                    add
                        ? "sharkord-plus"
                        : "sharkord-server-letter";


                fallback.textContent =
                    add
                        ? "+"
                        : letter;


                button.appendChild(
                    fallback
                );
            }


            return button;
        }


        // ==================================================
        // MODAL +
        // ==================================================

        function closeAddModal() {

            document.getElementById(
                MODAL_ID
            )?.remove();
        }


        function openAddModal() {

            closeAddModal();


            const overlay =
                document.createElement(
                    "div"
                );


            overlay.id =
                MODAL_ID;


            overlay.innerHTML = `
                <div
                    class="panel"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Adicionar servidor"
                >
                    <h2>
                        Adicionar servidor
                    </h2>

                    <p>
                        Digite o IP ou endereço do servidor Sharkord.
                        O servidor ficará salvo na barra lateral.
                    </p>

                    <label for="__sharkord_server_address">
                        Endereço do servidor
                    </label>

                    <input
                        id="__sharkord_server_address"
                        type="text"
                        autocomplete="off"
                        spellcheck="false"
                        placeholder="sharkord.exemplo.com ou 192.168.1.10:4991"
                    >

                    <div
                        class="error"
                        data-sharkord-error
                    ></div>

                    <div class="actions">
                        <button
                            type="button"
                            class="cancel"
                            data-sharkord-cancel
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            class="save"
                            data-sharkord-save
                        >
                            Adicionar
                        </button>
                    </div>
                </div>
            `;


            document.body.appendChild(
                overlay
            );


            const input =
                overlay.querySelector(
                    "input"
                );

            const error =
                overlay.querySelector(
                    "[data-sharkord-error]"
                );

            const save =
                overlay.querySelector(
                    "[data-sharkord-save]"
                );

            const cancel =
                overlay.querySelector(
                    "[data-sharkord-cancel]"
                );


            const submit =
                async () => {

                    const value =
                        input.value.trim();


                    if (
                        !value
                    ) {

                        error.textContent =
                            "Digite o endereço do servidor.";


                        return;
                    }


                    save.disabled =
                        true;

                    input.disabled =
                        true;

                    error.textContent =
                        "Conectando...";


                    try {

                        await api().add(
                            value
                        );


                        /*
                         * loadURL() troca a página logo depois.
                         * Não precisamos reconstruir a barra aqui.
                         */

                    } catch (
                        caughtError
                        ) {

                        save.disabled =
                            false;

                        input.disabled =
                            false;

                        error.textContent =
                            caughtError?.message ||
                            "Não foi possível conectar ao servidor.";

                        input.focus();
                        input.select();
                    }
                };


            cancel.addEventListener(
                "click",
                closeAddModal
            );


            save.addEventListener(
                "click",
                submit
            );


            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        submit();
                    }


                    if (
                        event.key ===
                        "Escape"
                    ) {

                        event.preventDefault();

                        closeAddModal();
                    }
                }
            );


            overlay.addEventListener(
                "pointerdown",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        closeAddModal();
                    }
                }
            );


            setTimeout(
                () => input.focus(),
                0
            );
        }


        // ==================================================
        // RENDER
        // ==================================================

        function renderSidebar() {

            if (
                !document.body
            ) {

                return;
            }


            installGlobalStyle();


            document.getElementById(
                ROOT_ID
            )?.remove();


            const root =
                document.createElement(
                    "aside"
                );


            root.id =
                ROOT_ID;


            const scroll =
                document.createElement(
                    "div"
                );


            scroll.className =
                "sharkord-server-scroll";


            // ----------------------------------------------
            // APP / DIRECT MESSAGES
            // ----------------------------------------------

            const home =
                createCircleButton({
                    title:
                        "Direct Messages",

                    image:
                    sidebarState.appIconDataUrl,

                    letter:
                        "S"
                });


            home.classList.add(
                "sharkord-app-logo"
            );


            home.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    clickDirectMessages();
                }
            );


            scroll.appendChild(
                home
            );


            const divider =
                document.createElement(
                    "div"
                );


            divider.className =
                "sharkord-server-divider";


            scroll.appendChild(
                divider
            );


            // ----------------------------------------------
            // SERVIDORES SALVOS
            // ----------------------------------------------

            for (
                const server
                of sidebarState.servers
                ) {

                const active =
                    server.url ===
                    sidebarState.currentServer;


                const button =
                    createCircleButton({
                        title:
                            `${server.name}\n${server.url}`,

                        image:
                        server.avatarDataUrl,

                        letter:
                            firstLetter(
                                server.name
                            ),

                        active
                    });


                button.dataset.serverUrl =
                    server.url;


                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();


                        if (
                            server.url ===
                            sidebarState.currentServer
                        ) {

                            return;
                        }


                        button.disabled =
                            true;

                        button.style.opacity =
                            "0.6";


                        try {

                            await api().connect(
                                server.url
                            );

                        } catch (
                            error
                            ) {

                            button.disabled =
                                false;

                            button.style.opacity =
                                "1";


                            showToast(
                                error?.message ||
                                "Falha ao conectar ao servidor.",
                                true
                            );
                        }
                    }
                );


                button.addEventListener(
                    "contextmenu",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();


                        openServerContextMenu(
                            event,
                            server
                        );
                    }
                );


                scroll.appendChild(
                    button
                );
            }


            // ----------------------------------------------
            // +
            // ----------------------------------------------

            const add =
                createCircleButton({
                    title:
                        "Adicionar servidor",

                    add:
                        true
                });


            add.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    openAddModal();
                }
            );


            scroll.appendChild(
                add
            );


            root.appendChild(
                scroll
            );


            document.body.appendChild(
                root
            );


            renderTopTitle();

            renderGlobalServerBanner();

            renderGlobalServerAvatar();

            replaceDirectMessagesWithServerName();

            scheduleLayoutEnhancements();
        }


        async function refreshState() {

            const bridge =
                api();


            if (
                !bridge ||
                typeof bridge.getState !==
                "function"
            ) {

                console.error(
                    "[Server Sidebar] API não encontrada no MAIN WORLD."
                );


                return;
            }


            try {

                const state =
                    await bridge.getState();


                sidebarState = {
                    currentServer:
                        state?.currentServer ||
                        null,

                    appIconDataUrl:
                        state?.appIconDataUrl ||
                        null,

                    servers:
                        Array.isArray(
                            state?.servers
                        )
                            ? state.servers
                            : []
                };


                renderSidebar();

                scheduleLayoutEnhancements();


                console.log(
                    "[Server Sidebar] carregada:",
                    {
                        currentServer:
                        sidebarState.currentServer,

                        servers:
                        sidebarState.servers.length
                    }
                );

            } catch (
                error
                ) {

                console.error(
                    "[Server Sidebar] falha obtendo servidores:",
                    error
                );
            }
        }


        const desktopApi =
            api();


        if (
            desktopApi &&
            typeof desktopApi.onMemberData ===
            "function"
        ) {

            desktopApi.onMemberData(
                data => {

                    memberData = {
                        users:
                            Array.isArray(
                                data?.users
                            )
                                ? data.users
                                : [],

                        roles:
                            Array.isArray(
                                data?.roles
                            )
                                ? data.roles
                                : []
                    };


                    scheduleLayoutEnhancements();
                }
            );
        }


        document.addEventListener(
            "pointerdown",
            event => {

                const menu =
                    document.getElementById(
                        CONTEXT_MENU_ID
                    );


                if (
                    menu &&
                    !menu.contains(
                        event.target
                    )
                ) {

                    closeServerContextMenu();
                }
            },
            true
        );


        window.addEventListener(
            "resize",
            scheduleLayoutEnhancements
        );


        const layoutObserver =
            new MutationObserver(
                () => {

                    scheduleLayoutEnhancements();
                }
            );


        if (
            document.documentElement
        ) {

            layoutObserver.observe(
                document.documentElement,
                {
                    childList:
                        true,

                    subtree:
                        true
                }
            );
        }


        function boot() {

            if (
                !document.body
            ) {

                document.addEventListener(
                    "DOMContentLoaded",
                    refreshState,
                    {
                        once:
                            true
                    }
                );


                return;
            }


            refreshState();
        }


        boot();
    }
});
