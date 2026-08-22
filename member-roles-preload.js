const {
    ipcRenderer
} = require(
    "electron"
);


// ======================================================
// Sharkord Desktop
// member-roles-preload.js
//
// v4.1
//
// - Usa dados reais enviados pelo main.js
// - Agrupa membros pela role principal
// - Corrige o primeiro membro ficando fora do grupo
// - Colore o nome pela cor da role
// - Não interfere no screen share / áudio / branding
// ======================================================

(() => {

    "use strict";


    // ==================================================
    // CONSTANTES
    // ==================================================

    const STYLE_ID =
        "skr-member-roles-v41-style";


    const HEADER_CLASS =
        "skr-member-role-header-v41";


    const ORIGINAL_HEADER_MARK =
        "data-skr-original-members-header-v41";


    const INSERTED_MARK =
        "data-skr-role-header-v41";


    const ANCHOR_MARK =
        "data-skr-role-anchor-v41";


    const NAME_MARK =
        "data-skr-role-colored-name-v41";


    // ==================================================
    // ESTADO
    // ==================================================

    let serverUsers =
        [];


    let serverRoles =
        [];


    let renderTimer =
        null;


    let rendering =
        false;


    let lastSignature =
        "";


    // ==================================================
    // LOG
    // ==================================================

    function log(
        ...args
    ) {

        console.log(
            "[Member Roles v4.1]",
            ...args
        );
    }


    // ==================================================
    // TEXTO
    // ==================================================

    function normalizeText(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    function normalizeKey(
        value
    ) {

        return normalizeText(
            value
        )
            .toLowerCase();
    }


    // ==================================================
    // VISIBILIDADE
    // ==================================================

    function isVisible(
        element
    ) {

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
            style.display !==
            "none" &&
            style.visibility !==
            "hidden"
        );
    }


    // ==================================================
    // CSS
    // ==================================================

    function installStyles() {

        if (
            !document.documentElement
        ) {

            return;
        }


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


        style.textContent =
            `
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
            .skr-role-count-v41 {
                margin-left: 4px;
                opacity: .85;
            }
            `;


        document.documentElement
            .appendChild(
                style
            );
    }


    // ==================================================
    // RECEBE DADOS DO MAIN
    // ==================================================

    function setServerData(
        data
    ) {

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


        serverUsers =
            data.users
                .filter(
                    user =>
                        user &&
                        user.name &&
                        user.name !==
                        "__deleted_user__"
                )
                .map(
                    user => {

                        return {

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
                        };
                    }
                );


        serverRoles =
            data.roles
                .filter(
                    role =>
                        role &&
                        role.id !==
                        undefined
                )
                .map(
                    role => {

                        return {

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
                        };
                    }
                );


        log(
            "dados recebidos:",
            {
                users:
                    serverUsers.map(
                        user => ({
                            name:
                            user.name,

                            roleIds:
                            user.roleIds
                        })
                    ),

                roles:
                    serverRoles.map(
                        role => ({
                            id:
                            role.id,

                            name:
                            role.name,

                            color:
                            role.color,

                            isDefault:
                            role.isDefault
                        })
                    )
            }
        );


        /*
         * Força reconstrução caso alguma role
         * tenha mudado.
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


    // ==================================================
    // ROLE POR ID
    // ==================================================

    function getRoleById(
        id
    ) {

        const numericId =
            Number(
                id
            );


        return (
            serverRoles.find(
                role =>
                    Number(
                        role.id
                    ) ===
                    numericId
            ) ||
            null
        );
    }


    // ==================================================
    // ROLE PRINCIPAL
    // ==================================================

    function getPrimaryRole(
        user
    ) {

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


        /*
         * Role não-default vence role default.
         *
         * Exemplo:
         *
         * Owner + Member
         * =>
         * Owner
         */
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


                const idA =
                    Number(
                        roleA?.id ??
                        0
                    );


                const idB =
                    Number(
                        roleB?.id ??
                        0
                    );


                return (
                    idA -
                    idB
                );
            }
        );


        return assignedRoles[0];
    }


    // ==================================================
    // PROCURA NOME NA SIDEBAR
    // ==================================================

    function findExactNameElement(
        name
    ) {

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
                         * Sidebar de membros fica
                         * na direita.
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
         * Escolhe o menor elemento que contém
         * exatamente o nome.
         *
         * Isso evita escolher um wrapper enorme.
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


    // ==================================================
    // DESCOBRE A ROW DO MEMBRO
    // ==================================================

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
                rect.width >=
                140 &&
                rect.width <=
                420 &&
                rect.height >=
                28 &&
                rect.height <=
                72 &&
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


    // ==================================================
    // ANCESTRAIS
    // ==================================================

    function getAncestors(
        element
    ) {

        const result =
            [];


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


    // ==================================================
    // FILHO DIRETO
    // ==================================================

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


    // ==================================================
    // HEADER ORIGINAL "MEMBERS — X"
    // ==================================================

    function findOriginalMembersHeader(
        commonParent,
        firstRow
    ) {

        if (
            !commonParent ||
            !firstRow
        ) {

            return null;
        }


        const rowRect =
            firstRow
                .getBoundingClientRect();


        const candidates =
            Array.from(
                commonParent.querySelectorAll(
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


                        const text =
                            normalizeKey(
                                element.textContent
                            );


                        const membersMatch =
                            /^members?\s*[—–:-]?\s*\d*$/
                                .test(
                                    text
                                );


                        const membrosMatch =
                            /^membros?\s*[—–:-]?\s*\d*$/
                                .test(
                                    text
                                );


                        if (
                            !membersMatch &&
                            !membrosMatch
                        ) {

                            return false;
                        }


                        const rect =
                            element
                                .getBoundingClientRect();


                        return (
                            rect.bottom <=
                            rowRect.top +
                            6
                        );
                    }
                );


        /*
         * Mais próximo da primeira row.
         */
        candidates.sort(
            (
                elementA,
                elementB
            ) => {

                return (
                    elementB
                        .getBoundingClientRect()
                        .top -
                    elementA
                        .getBoundingClientRect()
                        .top
                );
            }
        );


        return (
            candidates[0] ||
            null
        );
    }


    // ==================================================
    // RESTAURA CORES ANTIGAS
    // ==================================================

    function restoreMemberNameColors() {

        const elements =
            document.querySelectorAll(
                `[${NAME_MARK}="1"]`
            );


        for (
            const element
            of elements
            ) {

            const oldColor =
                element.dataset
                    .skrOldRoleColorV41 ??
                "";


            element.style.color =
                oldColor;


            delete element.dataset
                .skrOldRoleColorV41;


            element.removeAttribute(
                NAME_MARK
            );
        }
    }


    // ==================================================
    // REMOVE HEADERS CRIADOS
    // ==================================================

    function removeInsertedHeaders() {

        const headers =
            document.querySelectorAll(
                `[${INSERTED_MARK}="1"]`
            );


        for (
            const header
            of headers
            ) {

            header.remove();
        }


        const anchors =
            document.querySelectorAll(
                `[${ANCHOR_MARK}="1"]`
            );


        for (
            const anchor
            of anchors
            ) {

            anchor.remove();
        }


        const originals =
            document.querySelectorAll(
                `[${ORIGINAL_HEADER_MARK}="1"]`
            );


        for (
            const header
            of originals
            ) {

            header.style.display =
                header.dataset
                    .skrOldDisplayV41 ||
                "";


            delete header.dataset
                .skrOldDisplayV41;


            header.removeAttribute(
                ORIGINAL_HEADER_MARK
            );
        }
    }


    // ==================================================
    // CRIA HEADER DE ROLE
    // ==================================================

    function createRoleHeader(
        role,
        count
    ) {

        const header =
            document.createElement(
                "div"
            );


        header.className =
            HEADER_CLASS;


        header.setAttribute(
            INSERTED_MARK,
            "1"
        );


        /*
         * A própria cor configurada no Sharkord.
         */
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
            )
                .toUpperCase();


        const total =
            document.createElement(
                "span"
            );


        total.className =
            "skr-role-count-v41";


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


    // ==================================================
    // COLORE O NOME DO USUÁRIO
    // ==================================================

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
                    element => {

                        return (
                            normalizeKey(
                                element.textContent
                            ) ===
                            wanted
                        );
                    }
                );


        /*
         * Queremos o menor elemento textual,
         * não a row inteira.
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


        const nameElement =
            candidates[0];


        if (
            !nameElement
        ) {

            return;
        }


        if (
            !nameElement.hasAttribute(
                NAME_MARK
            )
        ) {

            nameElement.dataset
                .skrOldRoleColorV41 =
                nameElement.style.color ||
                "";


            nameElement.setAttribute(
                NAME_MARK,
                "1"
            );
        }


        nameElement.style.color =
            role.color;
    }


    // ==================================================
    // RENDER
    // ==================================================

    function render() {

        if (
            rendering
        ) {

            return;
        }


        if (
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


            // ==========================================
            // MAPEIA USUÁRIOS PARA ELEMENTOS
            // ==========================================

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

                    row,

                    nameElement
                });
            }


            if (
                mapped.length <
                2
            ) {

                log(
                    "ainda não achei linhas suficientes:",
                    mapped.map(
                        item =>
                            item.user.name
                    )
                );


                return;
            }


            // ==========================================
            // CONTAINER COMUM
            // ==========================================

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

                log(
                    "ancestral comum não encontrado."
                );


                return;
            }


            // ==========================================
            // TRANSFORMA EM FILHOS DIRETOS
            // ==========================================

            const directMapped =
                mapped
                    .map(
                        item => {

                            return {

                                ...item,

                                row:
                                    getDirectChildUnder(
                                        commonAncestor,
                                        item.row
                                    )
                            };
                        }
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

                log(
                    "wrappers duplicados encontrados; aguardando layout estabilizar."
                );


                return;
            }


            // ==========================================
            // ASSINATURA
            // ==========================================

            const signature =
                directMapped
                    .map(
                        item => {

                            return (
                                `${item.user.id}:` +
                                `${item.role?.id ?? "none"}:` +
                                `${item.role?.color ?? ""}`
                            );
                        }
                    )
                    .sort()
                    .join(
                        "|"
                    );


            if (
                signature ===
                lastSignature &&
                document.querySelector(
                    `[${INSERTED_MARK}="1"]`
                )
            ) {

                /*
                 * Mesmo assim repinta os nomes,
                 * porque o React pode ter recriado
                 * algum span.
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


            // ==========================================
            // LIMPA UI ANTERIOR
            // ==========================================

            removeInsertedHeaders();


            restoreMemberNameColors();


            lastSignature =
                signature;


            // ==========================================
            // AGRUPA POR ROLE
            // ==========================================

            const groups =
                new Map();


            for (
                const item
                of directMapped
                ) {

                const role =
                    item.role ||
                    {
                        id:
                            -1,

                        name:
                            "Members",

                        color:
                            "#FFFFFF",

                        isDefault:
                            true
                    };


                const key =
                    Number(
                        role.id
                    );


                if (
                    !groups.has(
                        key
                    )
                ) {

                    groups.set(
                        key,
                        {
                            role,
                            items:
                                []
                        }
                    );
                }


                groups
                    .get(
                        key
                    )
                    .items
                    .push(
                        item
                    );
            }


            // ==========================================
            // ORDEM DOS GRUPOS
            // ==========================================

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
                                groupA.role ||
                                {};


                            const roleB =
                                groupB.role ||
                                {};


                            const defaultA =
                                Boolean(
                                    roleA.isDefault
                                );


                            const defaultB =
                                Boolean(
                                    roleB.isDefault
                                );


                            /*
                             * Não-default primeiro.
                             *
                             * Owner antes de Member.
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
                                    roleA.id ??
                                    0
                                ) -
                                Number(
                                    roleB.id ??
                                    0
                                )
                            );
                        }
                    );


            // ==========================================
            // PRIMEIRA ROW VISUAL
            // ==========================================

            const firstVisualRow =
                directMapped
                    .map(
                        item =>
                            item.row
                    )
                    .sort(
                        (
                            rowA,
                            rowB
                        ) => {

                            return (
                                rowA
                                    .getBoundingClientRect()
                                    .top -
                                rowB
                                    .getBoundingClientRect()
                                    .top
                            );
                        }
                    )[0];


            if (
                !firstVisualRow
            ) {

                return;
            }


            // ==========================================
            // ESCONDE "MEMBERS — X"
            // ==========================================

            const originalHeader =
                findOriginalMembersHeader(
                    commonAncestor,
                    firstVisualRow
                );


            if (
                originalHeader
            ) {

                originalHeader.dataset
                    .skrOldDisplayV41 =
                    originalHeader.style.display ||
                    "";


                originalHeader.setAttribute(
                    ORIGINAL_HEADER_MARK,
                    "1"
                );


                originalHeader.style.display =
                    "none";
            }


            // ==========================================
            // ÂNCORA FIXA
            // ==========================================

            /*
             * ESTE É O FIX PRINCIPAL DA v4.1.
             *
             * Antes usamos a primeira row como
             * insertionPoint.
             *
             * Se Erebaran fosse essa primeira row,
             * acabávamos fazendo:
             *
             * insertBefore(Erebaran, Erebaran)
             *
             * ...que obviamente não move nada.
             *
             * Agora criamos uma âncora separada.
             */

            const anchor =
                document.createElement(
                    "div"
                );


            anchor.setAttribute(
                ANCHOR_MARK,
                "1"
            );


            anchor.style.display =
                "none";


            commonAncestor.insertBefore(
                anchor,
                firstVisualRow
            );


            // ==========================================
            // INSERE GRUPOS
            // ==========================================

            for (
                const group
                of orderedGroups
                ) {

                const header =
                    createRoleHeader(
                        group.role,
                        group.items.length
                    );


                commonAncestor.insertBefore(
                    header,
                    anchor
                );


                /*
                 * Mantém a ordem visual original
                 * dos membros dentro da própria role.
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

                    commonAncestor.insertBefore(
                        item.row,
                        anchor
                    );


                    // ==================================
                    // COR DO NOME
                    // ==================================

                    paintMemberName(
                        item.row,
                        item.user,
                        group.role
                    );
                }
            }


            // ==========================================
            // REMOVE ÂNCORA
            // ==========================================

            anchor.remove();


            // ==========================================
            // LOG FINAL
            // ==========================================

            log(
                "agrupamento aplicado:",
                orderedGroups.map(
                    group => ({

                        role:
                        group.role.name,

                        color:
                        group.role.color,

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
                "[Member Roles v4.1] erro:",
                error
            );

        } finally {

            rendering =
                false;
        }
    }


    // ==================================================
    // SCHEDULER
    // ==================================================

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


    // ==================================================
    // DOM OBSERVER
    // ==================================================

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


        const observer =
            new MutationObserver(
                () => {

                    scheduleRender();
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


        window.addEventListener(
            "resize",
            scheduleRender
        );


        scheduleRender();


        log(
            "v4.1 iniciado."
        );
    }


    // ==================================================
    // START
    // ==================================================

    if (
        document.documentElement
    ) {

        startDomObserver();

    } else {

        document.addEventListener(
            "DOMContentLoaded",
            startDomObserver,
            {
                once:
                    true
            }
        );
    }

})();