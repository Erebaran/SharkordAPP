const {
    contextBridge
} = require("electron");


contextBridge.executeInMainWorld({

    func: () => {

        if (
            !Reflect.get(
                window,
                "__sharkordVoiceAdminDisconnectInstalled"
            )
        ) {

            Reflect.set(
                window,
                "__sharkordVoiceAdminDisconnectInstalled",
                true
            );


            const VOICE_ADMIN_MENU_ITEM_ID =
                "__sharkord_disconnect_voice_user";


            let voiceAdminPendingUserId =
                null;


            let voiceAdminPendingRow =
                null;


            let voiceAdminToken =
                null;


            let voiceAdminPassword =
                null;


            /*
             * O preload roda antes do app React. Aproveitamos isso para
             * observar as mensagens tRPC/WebSocket que o próprio Sharkord
             * envia e guardar apenas os dados necessários para uma conexão
             * auxiliar autenticada.
             */
            const originalWebSocketSend =
                WebSocket.prototype.send;


            WebSocket.prototype.send =
                function (
                    data
                ) {

                    try {

                        if (
                            typeof data ===
                            "string"
                        ) {

                            const parsed =
                                JSON.parse(
                                    data
                                );


                            const packets =
                                Array.isArray(
                                    parsed
                                )
                                    ? parsed
                                    : [
                                        parsed
                                    ];


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

                                    voiceAdminToken =
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

                                        voiceAdminPassword =
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


            function voiceAdminGetErrorText(
                error
            ) {

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


            function voiceAdminToast(
                message,
                isError = false
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


            function voiceAdminMutation(
                path,
                input
            ) {

                return new Promise(
                    (
                        resolve,
                        reject
                    ) => {

                        if (
                            !voiceAdminToken
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

                        const mutationId =
                            91003;


                        let settled =
                            false;

                        let handshakeData =
                            null;


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
                                            voiceAdminToken
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
                                    Array.isArray(
                                        parsed
                                    )
                                        ? parsed
                                        : [
                                            parsed
                                        ];


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


                                        handshakeData =
                                            packet?.result
                                                ?.data
                                                ?.data ||
                                            packet?.result
                                                ?.data;


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
                                                !voiceAdminPassword
                                            ) {

                                                finish(
                                                    new Error(
                                                        "Senha do servidor não foi capturada. Reconecte ao servidor e tente novamente."
                                                    )
                                                );


                                                return;
                                            }


                                            joinInput.password =
                                                voiceAdminPassword;
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


                                        if (
                                            packet?.result
                                        ) {

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
                                        }


                                        continue;
                                    }


                                    if (
                                        packet?.id !==
                                        mutationId
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
                                            packet.result
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


            function voiceAdminFindRow(
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


            function voiceAdminFindUserId(
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
                    Array.isArray(
                        value
                    )
                ) {

                    for (
                        const item
                        of value
                        ) {

                        const found =
                            voiceAdminFindUserId(
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
                    seen.has(
                        value
                    )
                ) {
                    return null;
                }


                seen.add(
                    value
                );


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


                /*
                 * No VoiceUser atual, o userId fica em:
                 *
                 * __reactProps$... -> children[0] -> props -> userId
                 *
                 * Percorremos primeiro os campos mais prováveis.
                 */
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
                        voiceAdminFindUserId(
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


            function voiceAdminGetUserIdFromRow(
                row
            ) {

                /*
                 * Caminho rápido e estável para a estrutura real observada
                 * no Sharkord:
                 *
                 * row.__reactProps$...children[0].props.userId
                 */
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
                            voiceAdminFindUserId(
                                props
                            );


                        if (
                            foundInProps
                        ) {

                            console.log(
                                "[Voice Admin] userId identificado recursivamente nas React props:",
                                foundInProps
                            );


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


                /*
                 * Fallback: procura também no Fiber e nos pais próximos.
                 */
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
                                node[
                                    key
                                    ];

                        } catch {

                            continue;
                        }


                        const found =
                            voiceAdminFindUserId(
                                payload
                            );


                        if (
                            found
                        ) {

                            console.log(
                                "[Voice Admin] userId identificado pelo fallback React:",
                                found
                            );


                            return found;
                        }
                    }
                }


                return null;
            }


            function voiceAdminGetControlledPopup(
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


            function voiceAdminInstallMenuItem() {

                if (
                    !voiceAdminPendingUserId ||
                    document.getElementById(
                        VOICE_ADMIN_MENU_ITEM_ID
                    )
                ) {
                    return;
                }


                const menu =
                    voiceAdminGetControlledPopup(
                        voiceAdminPendingRow
                    );


                if (
                    !menu
                ) {

                    setTimeout(
                        voiceAdminInstallMenuItem,
                        25
                    );


                    return;
                }


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


                const item =
                    document.createElement(
                        "button"
                    );


                item.id =
                    VOICE_ADMIN_MENU_ITEM_ID;

                item.type =
                    "button";

                item.setAttribute(
                    "role",
                    "menuitem"
                );


                item.textContent =
                    "Desconectar da chamada";


                item.style.cssText = `
                    width:calc(100% - 12px);
                    min-height:32px;
                    margin:3px 6px 6px;
                    padding:6px 8px;
                    display:flex;
                    align-items:center;
                    border:0;
                    border-radius:5px;
                    background:transparent;
                    color:#ef4444;
                    font:500 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                    text-align:left;
                    cursor:pointer;
                    outline:none;
                `;


                item.addEventListener(
                    "mouseenter",
                    () => {

                        item.style.background =
                            "rgba(239,68,68,.12)";
                    }
                );


                item.addEventListener(
                    "mouseleave",
                    () => {

                        item.style.background =
                            "transparent";
                    }
                );


                item.addEventListener(
                    "pointerdown",
                    event => {

                        event.stopPropagation();
                    }
                );


                item.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();
                        event.stopPropagation();


                        const userId =
                            voiceAdminPendingUserId;


                        if (
                            !userId
                        ) {
                            return;
                        }


                        item.disabled =
                            true;

                        item.style.opacity =
                            "0.55";


                        try {

                            await voiceAdminMutation(
                                "voice.disconnectUser",
                                {
                                    userId
                                }
                            );


                            voiceAdminToast(
                                "Usuário desconectado da chamada."
                            );


                            console.log(
                                "[Voice Admin] usuário desconectado:",
                                userId
                            );

                        } catch (
                            error
                            ) {

                            const message =
                                voiceAdminGetErrorText(
                                    error
                                );


                            voiceAdminToast(
                                message,
                                true
                            );


                            console.error(
                                "[Voice Admin] falha ao desconectar:",
                                {
                                    userId,
                                    error
                                }
                            );


                            item.disabled =
                                false;

                            item.style.opacity =
                                "1";
                        }
                    }
                );


                menu.appendChild(
                    separator
                );

                menu.appendChild(
                    item
                );
            }


            document.addEventListener(
                "contextmenu",
                event => {

                    const row =
                        voiceAdminFindRow(
                            event.target
                        );


                    if (
                        !row
                    ) {

                        voiceAdminPendingUserId =
                            null;


                        voiceAdminPendingRow =
                            null;


                        return;
                    }


                    const userId =
                        voiceAdminGetUserIdFromRow(
                            row
                        );


                    if (
                        !userId
                    ) {

                        voiceAdminPendingUserId =
                            null;


                        voiceAdminPendingRow =
                            null;


                        console.warn(
                            "[Voice Admin] linha de voz encontrada, mas userId não pôde ser identificado."
                        );


                        return;
                    }


                    voiceAdminPendingUserId =
                        userId;


                    voiceAdminPendingRow =
                        row;


                    setTimeout(
                        voiceAdminInstallMenuItem,
                        0
                    );


                    setTimeout(
                        voiceAdminInstallMenuItem,
                        35
                    );
                },
                true
            );


            console.log(
                "[Voice Admin] instalado dentro do MAIN WORLD."
            );
        }

    }
});
