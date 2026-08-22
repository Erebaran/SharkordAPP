const { ipcRenderer } = require("electron");

(() => {
    "use strict";

    // ======================================================
    // Sharkord Desktop
    // member-roles-preload.js
    //
    // v4.3
    //
    // - Roles reais do servidor
    // - Cores reais das roles
    // - Atualização em tempo real
    // - Não move membros desnecessariamente
    // - Corrige loop infinito do MutationObserver
    // ======================================================


    const STYLE_ID =
        "skr-member-roles-v43-style";

    const HEADER_CLASS =
        "skr-member-role-header-v43";

    const FLEX_CLASS =
        "skr-member-role-flex-v43";

    const GENERATED_MARK =
        "data-skr-role-generated-v43";

    const COLORED_MARK =
        "data-skr-role-colored-v43";

    const ORDER_MARK =
        "data-skr-role-order-v43";

    const HIDDEN_MARK =
        "data-skr-original-members-hidden-v43";


    // ======================================================
    // ESTADO
    // ======================================================

    let serverUsers = [];
    let serverRoles = [];

    let renderTimer = null;

    let rendering = false;

    let observer = null;

    let observerPaused = false;

    let lastSignature = "";


    // ======================================================
    // LOG
    // ======================================================

    function log(...args) {
        console.log(
            "[Member Roles v4.3]",
            ...args
        );
    }


    // ======================================================
    // TEXTO
    // ======================================================

    function normalizeText(value) {
        return String(
            value ?? ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    function normalizeKey(value) {
        return normalizeText(
            value
        ).toLowerCase();
    }


    // ======================================================
    // VISIBILIDADE
    // ======================================================

    function isVisible(element) {
        if (
            !(element instanceof HTMLElement)
        ) {
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
            window.getComputedStyle(
                element
            );

        return (
            style.display !== "none" &&
            style.visibility !== "hidden"
        );
    }


    // ======================================================
    // CSS
    // ======================================================

    function installStyles() {
        if (
            !document.documentElement ||
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
            .${FLEX_CLASS} {
                display: flex !important;
                flex-direction: column !important;
            }

            .${HEADER_CLASS} {
                box-sizing: border-box;

                display: flex;
                align-items: center;

                width: 100%;
                min-height: 30px;

                padding:
                    10px
                    8px
                    4px
                    8px;

                font-size: 11px;
                font-weight: 700;
                line-height: 16px;

                text-transform: uppercase;
                letter-spacing: .02em;

                user-select: none;
                pointer-events: none;

                opacity: .82;
            }

            .${HEADER_CLASS}
            .skr-role-count-v43 {
                margin-left: 4px;
                opacity: .85;
            }
        `;

        document.documentElement
            .appendChild(
                style
            );
    }


    // ======================================================
    // OBSERVER
    // ======================================================

    function connectObserver() {
        if (
            !observer ||
            !document.documentElement
        ) {
            return;
        }

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }


    function pauseObserver() {
        observerPaused = true;

        if (
            observer
        ) {
            observer.disconnect();
        }
    }


    function resumeObserver() {
        /*
         * Esperamos o ciclo atual do DOM terminar.
         *
         * Assim as mutações feitas pelo nosso próprio
         * render não voltam para o observer.
         */
        setTimeout(
            () => {
                observerPaused = false;

                connectObserver();
            },
            0
        );
    }


    // ======================================================
    // DADOS DO SERVIDOR
    // ======================================================

    function setServerData(data) {
        if (
            !data ||
            !Array.isArray(
                data.users
            ) ||
            !Array.isArray(
                data.roles
            )
        ) {
            return;
        }


        const nextUsers =
            data.users
                .filter(
                    user =>
                        user &&
                        user.name &&
                        user.name !==
                        "__deleted_user__"
                )
                .map(
                    user => ({
                        id:
                            Number(
                                user.id
                            ),

                        name:
                            normalizeText(
                                user.name
                            ),

                        roleIds:
                            Array.isArray(
                                user.roleIds
                            )
                                ? user.roleIds.map(
                                    roleId =>
                                        Number(
                                            roleId
                                        )
                                )
                                : []
                    })
                );


        const nextRoles =
            data.roles
                .filter(
                    role =>
                        role &&
                        role.id !== undefined
                )
                .map(
                    role => ({
                        id:
                            Number(
                                role.id
                            ),

                        name:
                            normalizeText(
                                role.name
                            ) ||
                            "Role",

                        color:
                            normalizeText(
                                role.color
                            ) ||
                            null,

                        isDefault:
                            Boolean(
                                role.isDefault
                            )
                    })
                );


        const oldDataSignature =
            JSON.stringify({
                users:
                serverUsers,

                roles:
                serverRoles
            });


        const newDataSignature =
            JSON.stringify({
                users:
                nextUsers,

                roles:
                nextRoles
            });


        /*
         * Se o main reenviar exatamente o mesmo
         * estado, não fazemos nada.
         */
        if (
            oldDataSignature ===
            newDataSignature
        ) {
            return;
        }


        serverUsers =
            nextUsers;

        serverRoles =
            nextRoles;


        log(
            "dados do servidor atualizados."
        );


        /*
         * Força uma reconstrução na próxima renderização.
         */
        lastSignature =
            "";


        scheduleRender();
    }


    ipcRenderer.on(
        "member-roles:server-data",
        (
            _event,
            data
        ) => {
            setServerData(
                data
            );
        }
    );


    // ======================================================
    // ROLES
    // ======================================================

    function getRoleById(id) {
        const numericId =
            Number(
                id
            );

        return (
            serverRoles.find(
                role =>
                    role.id ===
                    numericId
            ) ||
            null
        );
    }


    function getPrimaryRole(user) {
        if (
            !user ||
            !Array.isArray(
                user.roleIds
            )
        ) {
            return null;
        }


        const assignedRoles =
            user.roleIds
                .map(
                    roleId =>
                        getRoleById(
                            roleId
                        )
                )
                .filter(
                    Boolean
                );


        if (
            !assignedRoles.length
        ) {
            return null;
        }


        assignedRoles.sort(
            (
                roleA,
                roleB
            ) => {
                const defaultA =
                    Boolean(
                        roleA?.isDefault
                    );

                const defaultB =
                    Boolean(
                        roleB?.isDefault
                    );


                /*
                 * Cargo não-default ganha do default.
                 *
                 * Owner + Member
                 * =>
                 * Owner
                 */
                if (
                    defaultA !==
                    defaultB
                ) {
                    return (
                        Number(
                            defaultA
                        ) -
                        Number(
                            defaultB
                        )
                    );
                }


                return (
                    Number(
                        roleA?.id ??
                        0
                    ) -
                    Number(
                        roleB?.id ??
                        0
                    )
                );
            }
        );


        return assignedRoles[0];
    }


    // ======================================================
    // ELEMENTO DO NOME
    // ======================================================

    function findExactNameElement(name) {
        const wanted =
            normalizeKey(
                name
            );


        const candidates =
            Array.from(
                document.querySelectorAll(
                    "span, p, div"
                )
            )
                .filter(
                    element => {
                        if (
                            !isVisible(
                                element
                            )
                        ) {
                            return false;
                        }


                        const rect =
                            element
                                .getBoundingClientRect();


                        /*
                         * Lista de membros fica na
                         * lateral direita.
                         */
                        if (
                            rect.left <
                            window.innerWidth *
                            0.60
                        ) {
                            return false;
                        }


                        return (
                            normalizeKey(
                                element.textContent
                            ) ===
                            wanted
                        );
                    }
                );


        /*
         * Preferimos o menor elemento que contém
         * exatamente o nome.
         */
        candidates.sort(
            (
                elementA,
                elementB
            ) => {
                const rectA =
                    elementA
                        .getBoundingClientRect();

                const rectB =
                    elementB
                        .getBoundingClientRect();


                return (
                        rectA.width *
                        rectA.height
                    ) -
                    (
                        rectB.width *
                        rectB.height
                    );
            }
        );


        return (
            candidates[0] ||
            null
        );
    }


    // ======================================================
    // ROW DO MEMBRO
    // ======================================================

    function findMemberRow(
        nameElement
    ) {
        if (
            !nameElement
        ) {
            return null;
        }


        let current =
            nameElement;

        let best =
            null;


        for (
            let depth = 0;

            current &&
            depth < 8;

            depth++
        ) {
            const rect =
                current
                    .getBoundingClientRect();


            if (
                rect.width >= 140 &&
                rect.width <= 420 &&
                rect.height >= 28 &&
                rect.height <= 72 &&
                rect.left >
                window.innerWidth *
                0.55
            ) {
                best =
                    current;
            }


            current =
                current.parentElement;
        }


        return best;
    }


    // ======================================================
    // ANCESTRAIS
    // ======================================================

    function getAncestors(element) {
        const result = [];

        let current =
            element;


        while (
            current
            ) {
            result.push(
                current
            );

            current =
                current.parentElement;
        }


        return result;
    }


    function findCommonAncestor(
        elements
    ) {
        if (
            !elements.length
        ) {
            return null;
        }


        const firstAncestors =
            getAncestors(
                elements[0]
            );


        for (
            const candidate
            of firstAncestors
            ) {
            if (
                elements.every(
                    element =>
                        candidate.contains(
                            element
                        )
                )
            ) {
                return candidate;
            }
        }


        return null;
    }


    function getDirectChildUnder(
        ancestor,
        element
    ) {
        if (
            !ancestor ||
            !element
        ) {
            return null;
        }


        let current =
            element;


        while (
            current &&
            current.parentElement !==
            ancestor
            ) {
            current =
                current.parentElement;
        }


        if (
            current &&
            current.parentElement ===
            ancestor
        ) {
            return current;
        }


        return null;
    }


    // ======================================================
    // HEADER ORIGINAL "MEMBERS — X"
    // ======================================================

    function findOriginalMembersHeader(
        firstRow
    ) {
        if (
            !firstRow
        ) {
            return null;
        }


        const rowRect =
            firstRow
                .getBoundingClientRect();


        const candidates =
            Array.from(
                document.querySelectorAll(
                    "span, p, div, h1, h2, h3, h4"
                )
            )
                .filter(
                    element => {
                        if (
                            element.hasAttribute(
                                GENERATED_MARK
                            )
                        ) {
                            return false;
                        }


                        if (
                            !isVisible(
                                element
                            )
                        ) {
                            return false;
                        }


                        const text =
                            normalizeKey(
                                element.textContent
                            );


                        const matches =
                            /^members?\s*[—–:-]?\s*\d*$/
                                .test(
                                    text
                                ) ||
                            /^membros?\s*[—–:-]?\s*\d*$/
                                .test(
                                    text
                                );


                        if (
                            !matches
                        ) {
                            return false;
                        }


                        const rect =
                            element
                                .getBoundingClientRect();


                        return (
                            rect.left >
                            window.innerWidth *
                            0.55 &&

                            rect.bottom <=
                            rowRect.top +
                            8 &&

                            rowRect.top -
                            rect.bottom <
                            120
                        );
                    }
                );


        candidates.sort(
            (
                elementA,
                elementB
            ) => {
                const rectA =
                    elementA
                        .getBoundingClientRect();

                const rectB =
                    elementB
                        .getBoundingClientRect();


                return (
                    rectB.bottom -
                    rectA.bottom
                );
            }
        );


        return (
            candidates[0] ||
            null
        );
    }


    // ======================================================
    // LIMPEZA
    // ======================================================

    function restoreGeneratedUi() {

        document
            .querySelectorAll(
                `[${GENERATED_MARK}="1"]`
            )
            .forEach(
                element =>
                    element.remove()
            );


        document
            .querySelectorAll(
                `[${COLORED_MARK}="1"]`
            )
            .forEach(
                element => {

                    element.style.color =
                        element.dataset
                            .skrOldRoleColorV43 ||
                        "";


                    delete element.dataset
                        .skrOldRoleColorV43;


                    element.removeAttribute(
                        COLORED_MARK
                    );
                }
            );


        document
            .querySelectorAll(
                `[${ORDER_MARK}="1"]`
            )
            .forEach(
                element => {

                    element.style.order =
                        element.dataset
                            .skrOldRoleOrderV43 ||
                        "";


                    delete element.dataset
                        .skrOldRoleOrderV43;


                    element.removeAttribute(
                        ORDER_MARK
                    );
                }
            );


        document
            .querySelectorAll(
                `[${HIDDEN_MARK}="1"]`
            )
            .forEach(
                element => {

                    element.style.display =
                        element.dataset
                            .skrOldDisplayV43 ||
                        "";


                    delete element.dataset
                        .skrOldDisplayV43;


                    element.removeAttribute(
                        HIDDEN_MARK
                    );
                }
            );


        document
            .querySelectorAll(
                `.${FLEX_CLASS}`
            )
            .forEach(
                element => {

                    element.classList.remove(
                        FLEX_CLASS
                    );
                }
            );
    }


    // ======================================================
    // COR DO NOME
    // ======================================================

    function paintMemberName(
        row,
        user,
        role
    ) {
        if (
            !row ||
            !user ||
            !role?.color
        ) {
            return;
        }


        const wanted =
            normalizeKey(
                user.name
            );


        const candidates =
            Array.from(
                row.querySelectorAll(
                    "span, p, div"
                )
            )
                .filter(
                    element =>
                        normalizeKey(
                            element.textContent
                        ) ===
                        wanted
                );


        candidates.sort(
            (
                elementA,
                elementB
            ) => {

                const rectA =
                    elementA
                        .getBoundingClientRect();

                const rectB =
                    elementB
                        .getBoundingClientRect();


                return (
                        rectA.width *
                        rectA.height
                    ) -
                    (
                        rectB.width *
                        rectB.height
                    );
            }
        );


        const nameElement =
            candidates[0];


        if (
            !nameElement
        ) {
            return;
        }


        if (
            !nameElement.hasAttribute(
                COLORED_MARK
            )
        ) {

            nameElement.dataset
                .skrOldRoleColorV43 =
                nameElement.style.color ||
                "";


            nameElement.setAttribute(
                COLORED_MARK,
                "1"
            );
        }


        if (
            nameElement.style.color !==
            role.color
        ) {
            nameElement.style.color =
                role.color;
        }
    }


    // ======================================================
    // CRIAR HEADER
    // ======================================================

    function createRoleHeader(
        role,
        count,
        order
    ) {

        const header =
            document.createElement(
                "div"
            );


        header.className =
            HEADER_CLASS;


        header.setAttribute(
            GENERATED_MARK,
            "1"
        );


        header.style.order =
            String(
                order
            );


        if (
            role.color
        ) {
            header.style.color =
                role.color;
        }


        const name =
            document.createElement(
                "span"
            );


        name.textContent =
            normalizeText(
                role.name
            ).toUpperCase();


        const total =
            document.createElement(
                "span"
            );


        total.className =
            "skr-role-count-v43";


        total.textContent =
            `— ${count}`;


        header.appendChild(
            name
        );


        header.appendChild(
            total
        );


        return header;
    }


    // ======================================================
    // VALIDA UI EXISTENTE
    // ======================================================

    function isCurrentUiStillValid(
        mapped
    ) {

        const headers =
            document.querySelectorAll(
                `[${GENERATED_MARK}="1"]`
            );


        if (
            headers.length ===
            0
        ) {
            return false;
        }


        for (
            const item
            of mapped
            ) {

            if (
                !item.row ||
                !item.row.isConnected ||
                !item.row.hasAttribute(
                    ORDER_MARK
                )
            ) {
                return false;
            }
        }


        return true;
    }


    // ======================================================
    // RENDER
    // ======================================================

    function render() {

        if (
            rendering ||
            !document.documentElement ||
            !document.body
        ) {
            return;
        }


        if (
            !serverUsers.length ||
            !serverRoles.length
        ) {
            return;
        }


        rendering =
            true;


        try {

            installStyles();


            // ==================================================
            // MAPEIA USUÁRIOS
            // ==================================================

            const mapped =
                [];


            for (
                const user
                of serverUsers
                ) {

                const nameElement =
                    findExactNameElement(
                        user.name
                    );


                if (
                    !nameElement
                ) {
                    continue;
                }


                const row =
                    findMemberRow(
                        nameElement
                    );


                if (
                    !row
                ) {
                    continue;
                }


                mapped.push({
                    user,

                    role:
                        getPrimaryRole(
                            user
                        ),

                    row
                });
            }


            if (
                mapped.length <
                2
            ) {
                return;
            }


            // ==================================================
            // CONTAINER
            // ==================================================

            const commonAncestor =
                findCommonAncestor(
                    mapped.map(
                        item =>
                            item.row
                    )
                );


            if (
                !commonAncestor
            ) {
                return;
            }


            const directMapped =
                mapped
                    .map(
                        item => ({
                            ...item,

                            row:
                                getDirectChildUnder(
                                    commonAncestor,
                                    item.row
                                )
                        })
                    )
                    .filter(
                        item =>
                            item.row
                    );


            const uniqueRows =
                new Set(
                    directMapped.map(
                        item =>
                            item.row
                    )
                );


            if (
                uniqueRows.size !==
                directMapped.length
            ) {
                return;
            }


            // ==================================================
            // ASSINATURA DO ESTADO
            // ==================================================

            const signature =
                directMapped
                    .map(
                        item => {

                            return [
                                item.user.id,
                                item.user.name,
                                item.role?.id ??
                                "none",
                                item.role?.name ??
                                "",
                                item.role?.color ??
                                ""
                            ].join(
                                ":"
                            );
                        }
                    )
                    .sort()
                    .join(
                        "|"
                    );


            /*
             * Nada mudou.
             *
             * Não desmontamos tudo de novo.
             */
            if (
                signature ===
                lastSignature &&
                isCurrentUiStillValid(
                    directMapped
                )
            ) {

                /*
                 * Só garante as cores.
                 *
                 * Isso é barato e não altera childList.
                 */
                for (
                    const item
                    of directMapped
                    ) {

                    if (
                        item.role
                    ) {
                        paintMemberName(
                            item.row,
                            item.user,
                            item.role
                        );
                    }
                }


                return;
            }


            // ==================================================
            // A PARTIR DAQUI VAMOS ALTERAR DOM
            // ==================================================

            pauseObserver();


            restoreGeneratedUi();


            // ==================================================
            // ORDEM VISUAL ORIGINAL
            // ==================================================

            directMapped.sort(
                (
                    itemA,
                    itemB
                ) => {

                    return (
                        itemA.row
                            .getBoundingClientRect()
                            .top -
                        itemB.row
                            .getBoundingClientRect()
                            .top
                    );
                }
            );


            const firstVisualRow =
                directMapped[0]
                    ?.row;


            if (
                !firstVisualRow
            ) {
                return;
            }


            // ==================================================
            // ESCONDE HEADER ORIGINAL
            // ==================================================

            const originalHeader =
                findOriginalMembersHeader(
                    firstVisualRow
                );


            if (
                originalHeader
            ) {

                originalHeader.dataset
                    .skrOldDisplayV43 =
                    originalHeader.style.display ||
                    "";


                originalHeader.setAttribute(
                    HIDDEN_MARK,
                    "1"
                );


                originalHeader.style.display =
                    "none";
            }


            // ==================================================
            // FLEX
            // ==================================================

            commonAncestor.classList.add(
                FLEX_CLASS
            );


            // ==================================================
            // AGRUPA
            // ==================================================

            const groups =
                new Map();


            for (
                const item
                of directMapped
                ) {

                const role =
                    item.role ||
                    {
                        id: -1,
                        name: "Members",
                        color: "#FFFFFF",
                        isDefault: true
                    };


                if (
                    !groups.has(
                        role.id
                    )
                ) {

                    groups.set(
                        role.id,
                        {
                            role,
                            items: []
                        }
                    );
                }


                groups
                    .get(
                        role.id
                    )
                    .items
                    .push(
                        item
                    );
            }


            // ==================================================
            // ORDEM DOS CARGOS
            // ==================================================

            const orderedGroups =
                Array.from(
                    groups.values()
                )
                    .sort(
                        (
                            groupA,
                            groupB
                        ) => {

                            const roleA =
                                groupA.role;

                            const roleB =
                                groupB.role;


                            const defaultA =
                                Boolean(
                                    roleA?.isDefault
                                );

                            const defaultB =
                                Boolean(
                                    roleB?.isDefault
                                );


                            if (
                                defaultA !==
                                defaultB
                            ) {
                                return (
                                    Number(
                                        defaultA
                                    ) -
                                    Number(
                                        defaultB
                                    )
                                );
                            }


                            return (
                                Number(
                                    roleA?.id ??
                                    0
                                ) -
                                Number(
                                    roleB?.id ??
                                    0
                                )
                            );
                        }
                    );


            // ==================================================
            // APLICA ORDERS
            // ==================================================

            let order =
                10;


            for (
                const group
                of orderedGroups
                ) {

                const roleHeader =
                    createRoleHeader(
                        group.role,
                        group.items.length,
                        order++
                    );


                commonAncestor.appendChild(
                    roleHeader
                );


                /*
                 * Mantém a ordem visual dos membros
                 * dentro do cargo.
                 */
                group.items.sort(
                    (
                        itemA,
                        itemB
                    ) => {

                        return (
                            itemA.row
                                .getBoundingClientRect()
                                .top -
                            itemB.row
                                .getBoundingClientRect()
                                .top
                        );
                    }
                );


                for (
                    const item
                    of group.items
                    ) {

                    if (
                        !item.row.hasAttribute(
                            ORDER_MARK
                        )
                    ) {

                        item.row.dataset
                            .skrOldRoleOrderV43 =
                            item.row.style.order ||
                            "";


                        item.row.setAttribute(
                            ORDER_MARK,
                            "1"
                        );
                    }


                    item.row.style.order =
                        String(
                            order++
                        );


                    paintMemberName(
                        item.row,
                        item.user,
                        group.role
                    );
                }


                order +=
                    10;
            }


            lastSignature =
                signature;


            /*
             * Agora logamos UMA VEZ por mudança real.
             */
            log(
                "agrupamento atualizado:",
                orderedGroups.map(
                    group => ({
                        role:
                        group.role.name,

                        users:
                            group.items.map(
                                item =>
                                    item.user.name
                            )
                    })
                )
            );


        } catch (
            error
            ) {

            console.error(
                "[Member Roles v4.3] erro:",
                error
            );

        } finally {

            if (
                observerPaused
            ) {
                resumeObserver();
            }


            rendering =
                false;
        }
    }


    // ======================================================
    // AGENDADOR
    // ======================================================

    function scheduleRender() {

        clearTimeout(
            renderTimer
        );


        renderTimer =
            setTimeout(
                render,
                180
            );
    }


    // ======================================================
    // INICIA OBSERVER
    // ======================================================

    function startDomObserver() {

        if (
            !document.documentElement
        ) {

            setTimeout(
                startDomObserver,
                25
            );

            return;
        }


        installStyles();


        observer =
            new MutationObserver(
                mutations => {

                    if (
                        observerPaused ||
                        rendering
                    ) {
                        return;
                    }


                    /*
                     * Só interessa se realmente houve
                     * alteração estrutural.
                     */
                    const hasRelevantChange =
                        mutations.some(
                            mutation =>
                                mutation.type ===
                                "childList" &&
                                (
                                    mutation.addedNodes.length >
                                    0 ||
                                    mutation.removedNodes.length >
                                    0
                                )
                        );


                    if (
                        !hasRelevantChange
                    ) {
                        return;
                    }


                    scheduleRender();
                }
            );


        connectObserver();


        window.addEventListener(
            "resize",
            scheduleRender
        );


        scheduleRender();


        log(
            "v4.3 iniciado."
        );
    }


    // ======================================================
    // START
    // ======================================================

    if (
        document.documentElement
    ) {

        startDomObserver();

    } else {

        document.addEventListener(
            "DOMContentLoaded",
            startDomObserver,
            {
                once: true
            }
        );
    }

})();