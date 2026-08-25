const {
    contextBridge
} = require("electron");

contextBridge.executeInMainWorld({
    func: () => {
        if (
            Reflect.get(
                window,
                "__sharkordVoiceAdminDisconnectInstalled"
            )
        ) {
            return;
        }

        Reflect.set(
            window,
            "__sharkordVoiceAdminDisconnectInstalled",
            true
        );

        const ROOT_ID =
            "__sharkord_voice_admin_controls";

        const FLYOUT_ID =
            "__sharkord_voice_admin_roles_flyout";

        let pendingUserId =
            null;

        let pendingRow =
            null;

        let sessionToken =
            null;

        let serverPassword =
            null;

        let generation =
            0;

        // ==================================================
        // CAPTURA AUTENTICAÇÃO DO WEBSOCKET REAL DO SHARKORD
        // ==================================================

        const originalWebSocketSend =
            WebSocket.prototype.send;

        WebSocket.prototype.send =
            function (data) {
                try {
                    if (
                        typeof data ===
                        "string"
                    ) {
                        const parsed =
                            JSON.parse(data);

                        const packets =
                            Array.isArray(parsed)
                                ? parsed
                                : [parsed];

                        for (
                            const packet
                            of packets
                            ) {
                            if (
                                packet?.method ===
                                "connectionParams" &&
                                typeof packet?.data?.token ===
                                "string"
                            ) {
                                sessionToken =
                                    packet.data.token;
                            }

                            if (
                                packet?.params?.path ===
                                "others.joinServer"
                            ) {
                                const password =
                                    packet?.params
                                        ?.input
                                        ?.password;

                                if (
                                    typeof password ===
                                    "string"
                                ) {
                                    serverPassword =
                                        password;
                                }
                            }
                        }
                    }
                } catch {}

                return originalWebSocketSend.apply(
                    this,
                    arguments
                );
            };

        // ==================================================
        // HELPERS
        // ==================================================

        function getErrorText(error) {
            if (
                typeof error ===
                "string"
            ) {
                return error;
            }

            return (
                error?.message ||
                error?.data?.message ||
                "Erro desconhecido."
            );
        }

        function toast(
            message,
            isError = false
        ) {
            const element =
                document.createElement(
                    "div"
                );

            element.textContent =
                message;

            element.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:2147483647;
                max-width:380px;
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
                element
            );

            setTimeout(
                () => element.remove(),
                3200
            );
        }

        function unwrapResult(packet) {
            return (
                packet?.result
                    ?.data
                    ?.data ??
                packet?.result
                    ?.data ??
                packet?.result ??
                null
            );
        }

        // ==================================================
        // TRPC AUXILIAR AUTENTICADO
        // ==================================================

        function request(
            method,
            path,
            input
        ) {
            return new Promise(
                (
                    resolve,
                    reject
                ) => {
                    if (
                        !sessionToken
                    ) {
                        reject(
                            new Error(
                                "Token da sessão ainda não foi capturado. Reconecte ao servidor e tente novamente."
                            )
                        );

                        return;
                    }

                    const websocketUrl =
                        new URL(
                            location.origin
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
                        91001;

                    const joinId =
                        91002;

                    const actionId =
                        91003;

                    let settled =
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
                                reject(error);
                            } else {
                                resolve(value);
                            }
                        };

                    const timeout =
                        setTimeout(
                            () => {
                                finish(
                                    new Error(
                                        "O servidor demorou demais para responder."
                                    )
                                );
                            },
                            15000
                        );

                    socket.addEventListener(
                        "open",
                        () => {
                            socket.send(
                                JSON.stringify({
                                    method:
                                        "connectionParams",

                                    data: {
                                        token:
                                        sessionToken
                                    }
                                })
                            );

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
                        }
                    );

                    socket.addEventListener(
                        "message",
                        event => {
                            let parsed;

                            try {
                                parsed =
                                    JSON.parse(
                                        String(
                                            event.data ||
                                            ""
                                        )
                                    );
                            } catch {
                                return;
                            }

                            const packets =
                                Array.isArray(parsed)
                                    ? parsed
                                    : [parsed];

                            for (
                                const packet
                                of packets
                                ) {
                                if (
                                    packet?.id ===
                                    handshakeId
                                ) {
                                    if (
                                        packet?.error
                                    ) {
                                        finish(
                                            new Error(
                                                packet.error
                                                    ?.message ||
                                                "Falha no handshake."
                                            )
                                        );

                                        return;
                                    }

                                    const handshakeData =
                                        unwrapResult(
                                            packet
                                        );

                                    const handshakeHash =
                                        handshakeData
                                            ?.handshakeHash;

                                    if (
                                        !handshakeHash
                                    ) {
                                        finish(
                                            new Error(
                                                "Handshake inválido."
                                            )
                                        );

                                        return;
                                    }

                                    const joinInput = {
                                        handshakeHash
                                    };

                                    if (
                                        handshakeData
                                            ?.hasPassword
                                    ) {
                                        if (
                                            !serverPassword
                                        ) {
                                            finish(
                                                new Error(
                                                    "Senha do servidor não foi capturada. Reconecte ao servidor e tente novamente."
                                                )
                                            );

                                            return;
                                        }

                                        joinInput.password =
                                            serverPassword;
                                    }

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

                                    continue;
                                }

                                if (
                                    packet?.id ===
                                    joinId
                                ) {
                                    if (
                                        packet?.error
                                    ) {
                                        finish(
                                            new Error(
                                                packet.error
                                                    ?.message ||
                                                "Falha ao autenticar a conexão auxiliar."
                                            )
                                        );

                                        return;
                                    }

                                    const params = {
                                        path
                                    };

                                    if (
                                        input !==
                                        undefined
                                    ) {
                                        params.input =
                                            input;
                                    }

                                    socket.send(
                                        JSON.stringify({
                                            id:
                                            actionId,

                                            method,

                                            params
                                        })
                                    );

                                    continue;
                                }

                                if (
                                    packet?.id !==
                                    actionId
                                ) {
                                    continue;
                                }

                                if (
                                    packet?.error
                                ) {
                                    finish(
                                        new Error(
                                            packet.error
                                                ?.message ||
                                            packet.error
                                                ?.data
                                                ?.message ||
                                            "O servidor recusou a ação."
                                        )
                                    );

                                    return;
                                }

                                if (
                                    packet?.result
                                ) {
                                    finish(
                                        null,
                                        unwrapResult(
                                            packet
                                        )
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
                                    "Falha na conexão WebSocket auxiliar."
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
                                        "A conexão foi encerrada antes da confirmação."
                                    )
                                );
                            }
                        }
                    );
                }
            );
        }

        function query(
            path,
            input
        ) {
            return request(
                "query",
                path,
                input
            );
        }

        function mutation(
            path,
            input
        ) {
            return request(
                "mutation",
                path,
                input
            );
        }

        // ==================================================
        // LOCALIZAÇÃO DO USUÁRIO / POPUP
        // ==================================================

        function findVoiceRow(
            startNode
        ) {
            let node =
                startNode instanceof Element
                    ? startNode
                    : startNode?.parentElement;

            for (
                let depth = 0;
                node &&
                depth < 10;
                depth += 1,
                    node = node.parentElement
            ) {
                const className =
                    typeof node.className ===
                    "string"
                        ? node.className
                        : "";

                if (
                    className.includes(
                        "hover:bg-accent/30"
                    ) &&
                    className.includes(
                        "px-2"
                    ) &&
                    className.includes(
                        "py-1"
                    )
                ) {
                    return node;
                }
            }

            return null;
        }

        function findUserId(
            value,
            depth = 0,
            seen = new WeakSet()
        ) {
            if (
                value == null ||
                depth > 8
            ) {
                return null;
            }

            if (
                Array.isArray(value)
            ) {
                for (
                    const item
                    of value
                    ) {
                    const found =
                        findUserId(
                            item,
                            depth + 1,
                            seen
                        );

                    if (
                        found
                    ) {
                        return found;
                    }
                }

                return null;
            }

            if (
                typeof value !==
                "object"
            ) {
                return null;
            }

            if (
                seen.has(value)
            ) {
                return null;
            }

            seen.add(value);

            if (
                Number.isInteger(
                    value.userId
                ) &&
                value.userId > 0
            ) {
                return value.userId;
            }

            if (
                Number.isInteger(
                    value.user?.id
                ) &&
                value.user.id > 0
            ) {
                return value.user.id;
            }

            if (
                Number.isInteger(
                    value.voiceUser?.id
                ) &&
                value.voiceUser.id > 0
            ) {
                return value.voiceUser.id;
            }

            const preferredKeys = [
                "props",
                "children",
                "memoizedProps",
                "pendingProps",
                "return",
                "child",
                "sibling"
            ];

            for (
                const key
                of preferredKeys
                ) {
                let nested;

                try {
                    nested =
                        value[key];
                } catch {
                    continue;
                }

                const found =
                    findUserId(
                        nested,
                        depth + 1,
                        seen
                    );

                if (
                    found
                ) {
                    return found;
                }
            }

            return null;
        }

        function getUserIdFromRow(
            row
        ) {
            try {
                const reactPropsKey =
                    Object.getOwnPropertyNames(
                        row
                    ).find(
                        key =>
                            key.startsWith(
                                "__reactProps$"
                            )
                    );

                if (
                    reactPropsKey
                ) {
                    const props =
                        row[
                            reactPropsKey
                            ];

                    const directUserId =
                        props?.children?.[0]
                            ?.props?.userId;

                    if (
                        Number.isInteger(
                            directUserId
                        ) &&
                        directUserId > 0
                    ) {
                        console.log(
                            "[Voice Admin] userId identificado pelas React props:",
                            directUserId
                        );

                        return directUserId;
                    }

                    const foundInProps =
                        findUserId(
                            props
                        );

                    if (
                        foundInProps
                    ) {
                        return foundInProps;
                    }
                }
            } catch (
                error
                ) {
                console.warn(
                    "[Voice Admin] falha ao ler React props da linha:",
                    error
                );
            }

            let node =
                row;

            for (
                let depth = 0;
                node &&
                depth < 8;
                depth += 1,
                    node = node.parentElement
            ) {
                let keys = [];

                try {
                    keys =
                        Object.getOwnPropertyNames(
                            node
                        );
                } catch {}

                for (
                    const key
                    of keys
                    ) {
                    if (
                        !key.startsWith(
                            "__reactProps$"
                        ) &&
                        !key.startsWith(
                            "__reactFiber$"
                        )
                    ) {
                        continue;
                    }

                    let payload;

                    try {
                        payload =
                            node[key];
                    } catch {
                        continue;
                    }

                    const found =
                        findUserId(
                            payload
                        );

                    if (
                        found
                    ) {
                        return found;
                    }
                }
            }

            return null;
        }

        function getControlledPopup(
            row
        ) {
            if (
                !row
            ) {
                return null;
            }

            const controlledId =
                row.getAttribute(
                    "aria-controls"
                );

            if (
                !controlledId
            ) {
                return null;
            }

            const popup =
                document.getElementById(
                    controlledId
                );

            if (
                !popup
            ) {
                return null;
            }

            const rect =
                popup.getBoundingClientRect();

            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {
                return null;
            }

            return popup;
        }

        // ==================================================
        // COMPONENTES VISUAIS
        // ==================================================

        function makeSeparator() {
            const separator =
                document.createElement(
                    "div"
                );

            separator.style.cssText = `
                height:1px;
                margin:5px 6px;
                background:rgba(255,255,255,.08);
                pointer-events:none;
            `;

            return separator;
        }

        function makeButton(
            label,
            {
                danger = false,
                checked = null,
                suffix = ""
            } = {}
        ) {
            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.setAttribute(
                "role",
                "menuitem"
            );

            button.style.cssText = `
                width:calc(100% - 12px);
                min-height:32px;
                margin:2px 6px;
                padding:6px 8px;
                display:flex;
                align-items:center;
                gap:8px;
                border:0;
                border-radius:5px;
                background:transparent;
                color:${
                danger
                    ? "#ef4444"
                    : "inherit"
            };
                font:500 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                text-align:left;
                cursor:pointer;
                outline:none;
            `;

            const check =
                document.createElement(
                    "span"
                );

            check.style.cssText = `
                width:15px;
                flex:0 0 15px;
                text-align:center;
                opacity:.9;
            `;

            check.textContent =
                checked === null
                    ? ""
                    : checked
                        ? "✓"
                        : "";

            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                label;

            text.style.cssText = `
                flex:1 1 auto;
                min-width:0;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
            `;

            const right =
                document.createElement(
                    "span"
                );

            right.textContent =
                suffix;

            right.style.cssText = `
                flex:0 0 auto;
                opacity:.65;
            `;

            button.append(
                check,
                text,
                right
            );

            button.addEventListener(
                "mouseenter",
                () => {
                    button.style.background =
                        danger
                            ? "rgba(239,68,68,.12)"
                            : "rgba(255,255,255,.08)";
                }
            );

            button.addEventListener(
                "mouseleave",
                () => {
                    button.style.background =
                        "transparent";
                }
            );

            button.addEventListener(
                "pointerdown",
                event => {
                    event.stopPropagation();
                }
            );

            return button;
        }

        function setBusy(
            button,
            busy
        ) {
            button.disabled =
                busy;

            button.style.opacity =
                busy
                    ? "0.55"
                    : "1";
        }

        function closeRolesFlyout() {
            document.getElementById(
                FLYOUT_ID
            )?.remove();
        }

        async function openRolesFlyout(
            anchor,
            userId
        ) {
            closeRolesFlyout();

            const flyout =
                document.createElement(
                    "div"
                );

            flyout.id =
                FLYOUT_ID;

            flyout.style.cssText = `
                position:fixed;
                z-index:2147483646;
                min-width:220px;
                max-width:320px;
                max-height:360px;
                overflow:auto;
                padding:6px 0;
                border:1px solid rgba(255,255,255,.10);
                border-radius:7px;
                background:#18181b;
                color:#f4f4f5;
                box-shadow:0 16px 42px rgba(0,0,0,.45);
                font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            `;

            const rect =
                anchor.getBoundingClientRect();

            flyout.style.left =
                `${Math.min(
                    rect.right + 6,
                    window.innerWidth - 330
                )}px`;

            flyout.style.top =
                `${Math.min(
                    rect.top,
                    window.innerHeight - 370
                )}px`;

            const loading =
                document.createElement(
                    "div"
                );

            loading.textContent =
                "Carregando cargos...";

            loading.style.cssText = `
                padding:8px 12px;
                color:#a1a1aa;
                font-size:12px;
            `;

            flyout.appendChild(
                loading
            );

            document.body.appendChild(
                flyout
            );

            try {
                const data =
                    await query(
                        "users.getRoles",
                        {
                            userId
                        }
                    );

                flyout.replaceChildren();

                const roles =
                    Array.isArray(
                        data?.roles
                    )
                        ? data.roles
                        : [];

                const assigned =
                    new Set(
                        (
                            Array.isArray(
                                data?.userRoleIds
                            )
                                ? data.userRoleIds
                                : []
                        ).map(Number)
                    );

                if (
                    roles.length === 0
                ) {
                    const empty =
                        document.createElement(
                            "div"
                        );

                    empty.textContent =
                        "Nenhum cargo disponível.";

                    empty.style.cssText = `
                        padding:8px 12px;
                        color:#a1a1aa;
                        font-size:12px;
                    `;

                    flyout.appendChild(
                        empty
                    );

                    return;
                }

                for (
                    const role
                    of roles
                    ) {
                    const roleId =
                        Number(
                            role?.id
                        );

                    if (
                        !Number.isInteger(
                            roleId
                        )
                    ) {
                        continue;
                    }

                    const hasRole =
                        assigned.has(
                            roleId
                        );

                    const button =
                        makeButton(
                            role?.name ||
                            `Cargo ${roleId}`,
                            {
                                checked:
                                hasRole
                            }
                        );

                    if (
                        typeof role?.color ===
                        "string" &&
                        role.color
                    ) {
                        button.style.color =
                            role.color;
                    }

                    button.addEventListener(
                        "click",
                        async event => {
                            event.preventDefault();
                            event.stopPropagation();

                            setBusy(
                                button,
                                true
                            );

                            try {
                                if (
                                    hasRole
                                ) {
                                    await mutation(
                                        "users.removeRole",
                                        {
                                            userId,
                                            roleId
                                        }
                                    );

                                    toast(
                                        "Cargo removido."
                                    );
                                } else {
                                    await mutation(
                                        "users.addRole",
                                        {
                                            userId,
                                            roleId
                                        }
                                    );

                                    toast(
                                        "Cargo adicionado."
                                    );
                                }

                                await openRolesFlyout(
                                    anchor,
                                    userId
                                );
                            } catch (
                                error
                                ) {
                                toast(
                                    getErrorText(
                                        error
                                    ),
                                    true
                                );

                                setBusy(
                                    button,
                                    false
                                );
                            }
                        }
                    );

                    flyout.appendChild(
                        button
                    );
                }
            } catch (
                error
                ) {
                flyout.replaceChildren();

                const failed =
                    document.createElement(
                        "div"
                    );

                failed.textContent =
                    getErrorText(
                        error
                    );

                failed.style.cssText = `
                    padding:8px 12px;
                    color:#fca5a5;
                    font-size:12px;
                `;

                flyout.appendChild(
                    failed
                );
            }
        }

        // ==================================================
        // MENU ADMIN
        // ==================================================

        async function installMenu(
            expectedGeneration
        ) {
            if (
                expectedGeneration !==
                generation ||
                !pendingUserId
            ) {
                return;
            }

            const previous =
                document.getElementById(
                    ROOT_ID
                );

            if (
                previous
            ) {
                previous.remove();
            }

            const menu =
                getControlledPopup(
                    pendingRow
                );

            if (
                !menu
            ) {
                setTimeout(
                    () =>
                        installMenu(
                            expectedGeneration
                        ),
                    25
                );

                return;
            }

            const userId =
                pendingUserId;

            const root =
                document.createElement(
                    "div"
                );

            root.id =
                ROOT_ID;

            root.appendChild(
                makeSeparator()
            );

            // ------------------------------
            // CARGOS
            // ------------------------------

            const rolesButton =
                makeButton(
                    "Cargos",
                    {
                        suffix:
                            "›"
                    }
                );

            rolesButton.addEventListener(
                "click",
                async event => {
                    event.preventDefault();
                    event.stopPropagation();

                    await openRolesFlyout(
                        rolesButton,
                        userId
                    );
                }
            );

            root.appendChild(
                rolesButton
            );

            // ------------------------------
            // CONTROLES DE VOZ
            // ------------------------------

            let adminState = {
                inVoice:
                    false,
                muted:
                    false,
                deafened:
                    false
            };

            try {
                const state =
                    await query(
                        "voice.getAdminState",
                        {
                            userId
                        }
                    );

                if (
                    state &&
                    typeof state ===
                    "object"
                ) {
                    adminState = {
                        ...adminState,
                        ...state
                    };
                }
            } catch (
                error
                ) {
                console.warn(
                    "[Voice Admin] falha ao consultar estado:",
                    error
                );
            }

            const muteButton =
                makeButton(
                    "Mutar no servidor",
                    {
                        checked:
                            Boolean(
                                adminState.muted
                            )
                    }
                );

            const deafenButton =
                makeButton(
                    "Desativar áudio no servidor",
                    {
                        checked:
                            Boolean(
                                adminState.deafened
                            )
                    }
                );

            if (
                !adminState.inVoice
            ) {
                for (
                    const button
                    of [
                    muteButton,
                    deafenButton
                ]
                    ) {
                    button.disabled =
                        true;

                    button.style.opacity =
                        "0.45";

                    button.title =
                        "Usuário não está em uma chamada.";
                }
            }

            muteButton.addEventListener(
                "click",
                async event => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        muteButton.disabled
                    ) {
                        return;
                    }

                    const nextMuted =
                        !Boolean(
                            adminState.muted
                        );

                    setBusy(
                        muteButton,
                        true
                    );

                    try {
                        await mutation(
                            "voice.setServerMute",
                            {
                                userId,
                                muted:
                                nextMuted
                            }
                        );

                        toast(
                            nextMuted
                                ? "Usuário mutado no servidor."
                                : "Mute do servidor removido."
                        );

                        adminState.muted =
                            nextMuted;

                        generation += 1;

                        const nextGeneration =
                            generation;

                        setTimeout(
                            () =>
                                installMenu(
                                    nextGeneration
                                ),
                            0
                        );
                    } catch (
                        error
                        ) {
                        toast(
                            getErrorText(
                                error
                            ),
                            true
                        );

                        setBusy(
                            muteButton,
                            false
                        );
                    }
                }
            );

            deafenButton.addEventListener(
                "click",
                async event => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        deafenButton.disabled
                    ) {
                        return;
                    }

                    const nextDeafened =
                        !Boolean(
                            adminState.deafened
                        );

                    setBusy(
                        deafenButton,
                        true
                    );

                    try {
                        await mutation(
                            "voice.setServerDeafen",
                            {
                                userId,
                                deafened:
                                nextDeafened
                            }
                        );

                        toast(
                            nextDeafened
                                ? "Áudio do usuário desativado no servidor."
                                : "Áudio do servidor restaurado."
                        );

                        adminState.deafened =
                            nextDeafened;

                        generation += 1;

                        const nextGeneration =
                            generation;

                        setTimeout(
                            () =>
                                installMenu(
                                    nextGeneration
                                ),
                            0
                        );
                    } catch (
                        error
                        ) {
                        toast(
                            getErrorText(
                                error
                            ),
                            true
                        );

                        setBusy(
                            deafenButton,
                            false
                        );
                    }
                }
            );

            root.append(
                muteButton,
                deafenButton
            );

            // ------------------------------
            // DESCONECTAR
            // ------------------------------

            const disconnectButton =
                makeButton(
                    "Desconectar da chamada",
                    {
                        danger:
                            true
                    }
                );

            if (
                !adminState.inVoice
            ) {
                disconnectButton.disabled =
                    true;

                disconnectButton.style.opacity =
                    "0.45";

                disconnectButton.title =
                    "Usuário não está em uma chamada.";
            }

            disconnectButton.addEventListener(
                "click",
                async event => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        disconnectButton.disabled
                    ) {
                        return;
                    }

                    setBusy(
                        disconnectButton,
                        true
                    );

                    try {
                        await mutation(
                            "voice.disconnectUser",
                            {
                                userId
                            }
                        );

                        toast(
                            "Usuário desconectado da chamada."
                        );

                        console.log(
                            "[Voice Admin] usuário desconectado:",
                            userId
                        );

                        closeRolesFlyout();
                    } catch (
                        error
                        ) {
                        toast(
                            getErrorText(
                                error
                            ),
                            true
                        );

                        setBusy(
                            disconnectButton,
                            false
                        );
                    }
                }
            );

            root.appendChild(
                disconnectButton
            );

            menu.appendChild(
                root
            );
        }

        // ==================================================
        // EVENTOS
        // ==================================================

        document.addEventListener(
            "contextmenu",
            event => {
                closeRolesFlyout();

                const row =
                    findVoiceRow(
                        event.target
                    );

                if (
                    !row
                ) {
                    pendingUserId =
                        null;

                    pendingRow =
                        null;

                    return;
                }

                const userId =
                    getUserIdFromRow(
                        row
                    );

                if (
                    !userId
                ) {
                    pendingUserId =
                        null;

                    pendingRow =
                        null;

                    console.warn(
                        "[Voice Admin] linha de voz encontrada, mas userId não pôde ser identificado."
                    );

                    return;
                }

                pendingUserId =
                    userId;

                pendingRow =
                    row;

                generation += 1;

                const currentGeneration =
                    generation;

                setTimeout(
                    () =>
                        installMenu(
                            currentGeneration
                        ),
                    0
                );

                setTimeout(
                    () =>
                        installMenu(
                            currentGeneration
                        ),
                    35
                );
            },
            true
        );

        document.addEventListener(
            "pointerdown",
            event => {
                const flyout =
                    document.getElementById(
                        FLYOUT_ID
                    );

                if (
                    flyout &&
                    !flyout.contains(
                        event.target
                    )
                ) {
                    closeRolesFlyout();
                }
            },
            true
        );

        console.log(
            "[Voice Admin] controles administrativos instalados dentro do MAIN WORLD."
        );
    }
});
