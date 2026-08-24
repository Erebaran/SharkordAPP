function installScreenShareUi(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const inject = async () => {
        if (mainWindow.isDestroyed()) {
            return;
        }

        const code = String.raw`
(() => {
    const PATCH = "__sharkordScreenShareUiLeanDual";
    const CALL_ID = "__sharkord_switch_call_lean_dual";
    const VOICE_ID = "__sharkord_switch_voice_lean_dual";
    const STATE_EVENT = "__sharkordLocalScreenShareState";

    if (window[PATCH]) {
        return;
    }

    window[PATCH] = true;

    // Remove resíduos das versões antigas.
    document.querySelectorAll(
        '[id^="__sharkord_switch_"], #__sharkord_simple_switch_source, ' +
        '#__sharkord_voice_panel_switch_button, #__sharkord_call_bar_switch_button'
    ).forEach((element) => element.remove());

    const SWITCH_ICON = [
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
        '<rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/>',
        '<path d="M8.5 20H15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        '<path d="M12 17V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        '<path d="M12.5 12.5L17.5 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        '<path d="M14 7.5H17.5V11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
        '</svg>'
    ].join("");

    // Lucide "Monitor" normal. Usado só enquanto a call bar ainda não montou.
    const MONITOR_ON = [
        '<rect width="20" height="14" x="2" y="3" rx="2" ry="2"></rect>',
        '<line x1="8" x2="16" y1="21" y2="21"></line>',
        '<line x1="12" x2="12" y1="17" y2="21"></line>'
    ].join("");

    let switching = false;
    const boundNativeButtons = new WeakSet();

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function visible(element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        const style = getComputedStyle(element);
        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0
        );
    }

    function isCustom(element) {
        return (
            element?.id === CALL_ID ||
            element?.id === VOICE_ID ||
            element?.hasAttribute?.("data-sharkord-screen-switch")
        );
    }

    function rgb(background) {
        const match = String(background || "").match(
            /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/
        );

        return match
            ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
            : null;
    }

    function buttonDescription(button) {
        return String(
            [
                button?.getAttribute?.("aria-label"),
                button?.getAttribute?.("title"),
                button?.getAttribute?.("data-tooltip-content"),
                button?.textContent
            ]
                .filter(Boolean)
                .join(" ")
        ).toLowerCase();
    }

    function isRedButton(button) {
        if (!button) {
            return false;
        }

        const className = String(
            button.getAttribute?.("class") ||
            button.className ||
            ""
        ).toLowerCase();

        const description = buttonDescription(button);

        // UI atual do Sharkord.
        if (
            className.includes("bg-[#ec4245]") ||
            className.includes("hover:bg-[#da373c]") ||
            className.includes("bg-red-")
        ) {
            return true;
        }

        // Fallback semântico.
        if (
            description.includes("disconnect") ||
            description.includes("hang up") ||
            description.includes("end call") ||
            description.includes("desconectar") ||
            description.includes("encerrar chamada")
        ) {
            return true;
        }

        // Compatibilidade com a UI antiga.
        try {
            const color = rgb(getComputedStyle(button).backgroundColor);

            return Boolean(
                color &&
                color.r >= 145 &&
                color.r > color.g * 1.30 &&
                color.r > color.b * 1.15
            );
        } catch {
            return false;
        }
    }

    function isActiveScreenShareButton(button) {
        if (!button || !visible(button)) {
            return false;
        }

        const description = buttonDescription(button);
        const className = String(
            button.getAttribute?.("class") ||
            button.className ||
            ""
        ).toLowerCase();

        const pressed = String(
            button.getAttribute?.("aria-pressed") || ""
        ).toLowerCase();

        const state = String(
            button.getAttribute?.("data-state") || ""
        ).toLowerCase();

        if (pressed === "true") {
            return true;
        }

        if (
            state === "active" ||
            state === "on" ||
            state === "checked"
        ) {
            return true;
        }

        if (
            description.includes("stop sharing") ||
            description.includes("stop share") ||
            description.includes("stop screen") ||
            description.includes("parar compartilhamento") ||
            description.includes("parar transmiss") ||
            description.includes("encerrar compartilhamento")
        ) {
            return true;
        }

        // Classes do ControlToggleButton atual.
        if (
            className.includes("bg-blue-500/20") ||
            className.includes("hover:bg-blue-500/30") ||
            className.includes("bg-blue-500/15") ||
            className.includes("hover:bg-blue-500/25")
        ) {
            return true;
        }

        return false;
    }

    function smallButtons(root) {
        return Array.from(root.querySelectorAll("button, [role='button']"))
            .filter((button) => !isCustom(button) && visible(button))
            .map((button) => ({
                button,
                rect: button.getBoundingClientRect()
            }))
            .filter(({ rect }) =>
                rect.width >= 24 &&
                rect.width <= 72 &&
                rect.height >= 24 &&
                rect.height <= 72
            )
            .sort((a, b) => a.rect.left - b.rect.left);
    }

    // --------------------------------------------------
    // Call bar (direita)
    // --------------------------------------------------

    function findCallControls() {
        const hangups = Array.from(
            document.querySelectorAll("button, [role='button']")
        )
            .filter((button) => {
                if (!visible(button) || isCustom(button) || !isRedButton(button)) {
                    return false;
                }

                const rect = button.getBoundingClientRect();
                return (
                    rect.width >= 48 &&
                    rect.height >= 48 &&
                    rect.left > window.innerWidth * 0.45
                );
            })
            .sort((a, b) =>
                b.getBoundingClientRect().left - a.getBoundingClientRect().left
            );

        const hangup = hangups[0];
        if (!hangup) {
            return null;
        }

        const hangupRect = hangup.getBoundingClientRect();
        let root = hangup.parentElement;

        for (let depth = 0; root && depth < 6; depth++, root = root.parentElement) {
            const buttons = Array.from(
                root.querySelectorAll("button, [role='button']")
            )
                .filter((button) => !isCustom(button) && visible(button))
                .map((button) => ({
                    button,
                    rect: button.getBoundingClientRect()
                }))
                .filter(({ rect }) => {
                    const centerY = rect.top + rect.height / 2;
                    const hangupCenterY = hangupRect.top + hangupRect.height / 2;
                    return Math.abs(centerY - hangupCenterY) <= 24;
                })
                .sort((a, b) => a.rect.left - b.rect.left);

            const index = buttons.findIndex(({ button }) => button === hangup);

            // screen precisa apenas de um template à esquerda.
            // Funciona com 3 ou 4 controles na barra.
            if (index >= 2) {
                return {
                    screen: buttons[index - 1].button,
                    template: buttons[index - 2].button
                };
            }
        }

        return null;
    }

    // --------------------------------------------------
    // Voice connected (esquerda)
    // --------------------------------------------------

    function findVoiceControls() {
        const candidates = Array.from(
            document.querySelectorAll("div, section, aside")
        )
            .filter((element) => {
                if (!visible(element)) {
                    return false;
                }

                const text = String(element.textContent || "").toLowerCase();
                if (
                    !text.includes("voice connected") &&
                    !text.includes("voz conectada") &&
                    !text.includes("conectado a voz")
                ) {
                    return false;
                }

                const rect = element.getBoundingClientRect();
                return rect.width <= 520 && rect.height <= 220;
            })
            .sort((a, b) => {
                const ar = a.getBoundingClientRect();
                const br = b.getBoundingClientRect();
                return ar.width * ar.height - br.width * br.height;
            });

        for (const card of candidates) {
            const buttons = smallButtons(card);

            if (buttons.length >= 2) {
                return {
                    screen: buttons.at(-1).button,
                    template: buttons.at(-2).button
                };
            }
        }

        return null;
    }

    // --------------------------------------------------
    // Corrige SOMENTE o ícone invertido da esquerda
    // --------------------------------------------------

    function fixLeftScreenIcon() {
        const voice = findVoiceControls();
        if (!voice?.screen) {
            return;
        }

        const targetSvg = voice.screen.querySelector("svg");
        if (!targetSvg) {
            return;
        }

        const call = findCallControls();
        const sourceSvg = call?.screen?.querySelector("svg");

        const wanted = sourceSvg?.innerHTML || MONITOR_ON;

        if (targetSvg.innerHTML !== wanted) {
            targetSvg.innerHTML = wanted;
        }

        // Se alguma tentativa antiga deixou o SVG oculto.
        if (targetSvg.style.visibility) {
            targetSvg.style.visibility = "";
        }
    }

    // --------------------------------------------------
    // Estado
    // --------------------------------------------------

    function isSharing() {
        // Estado real publicado pelo main/preload.
        if (window.__sharkordLocalScreenShareActive === true) {
            return true;
        }

        // Fallback visual: evita perder os botões quando o frontend
        // remonta a barra antes/depois do evento de estado.
        const call = findCallControls();
        if (call?.screen && isActiveScreenShareButton(call.screen)) {
            return true;
        }

        const voice = findVoiceControls();
        return Boolean(
            voice?.screen &&
            isActiveScreenShareButton(voice.screen)
        );
    }

    function setSharing(active) {
        window.__sharkordLocalScreenShareActive = Boolean(active);
    }

    function bindNativeStop(button) {
        if (!button || boundNativeButtons.has(button)) {
            return;
        }

        boundNativeButtons.add(button);

        button.addEventListener(
            "click",
            () => {
                if (isSharing()) {
                    setSharing(false);
                    refresh();
                }
            },
            true
        );
    }

    // --------------------------------------------------
    // Botão Trocar tela
    // --------------------------------------------------

    function makeSwitchButton(template, id) {
        // cloneNode não copia listeners JS; preserva somente o visual nativo.
        const button = template.cloneNode(true);

        button.id = id;
        button.disabled = false;
        button.removeAttribute("aria-pressed");
        button.removeAttribute("data-state");
        button.setAttribute("type", "button");
        button.setAttribute("title", "Trocar tela");
        button.setAttribute("aria-label", "Trocar tela");
        button.setAttribute("data-sharkord-screen-switch", "true");

        const svg = button.querySelector("svg");
        if (svg) {
            const holder = document.createElement("div");
            holder.innerHTML = SWITCH_ICON;
            const replacement = holder.firstElementChild;

            if (replacement) {
                // Mantém exatamente tamanho/classes do SVG nativo.
                for (const attr of ["class", "width", "height", "stroke", "stroke-width"]) {
                    const value = svg.getAttribute(attr);
                    if (value) {
                        replacement.setAttribute(attr, value);
                    }
                }

                replacement.style.cssText = svg.style.cssText;
                svg.replaceWith(replacement);
            }
        }

        button.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                void switchSource();
            },
            true
        );

        return button;
    }

    function installSwitch(controls, id) {
        if (!controls?.screen || !controls?.template) {
            document.getElementById(id)?.remove();
            return;
        }

        const parent = controls.screen.parentElement;
        if (!parent) {
            return;
        }

        const existing = document.getElementById(id);

        if (
            existing?.isConnected &&
            existing.parentElement === parent &&
            existing.nextElementSibling === controls.screen
        ) {
            return;
        }

        existing?.remove();
        parent.insertBefore(
            makeSwitchButton(controls.template, id),
            controls.screen
        );
    }

    function removeSwitches() {
        document.getElementById(CALL_ID)?.remove();
        document.getElementById(VOICE_ID)?.remove();
    }

    function refresh() {
        // A correção do ícone não depende de estar compartilhando.
        fixLeftScreenIcon();

        const call = findCallControls();
        const voice = findVoiceControls();

        if (call) {
            bindNativeStop(call.screen);
        }

        if (!isSharing() || switching) {
            removeSwitches();
            return;
        }

        // Cada botão é instalado de forma independente.
        // Se uma barra estiver sendo remontada, a outra continua existindo.
        installSwitch(call, CALL_ID);
        installSwitch(voice, VOICE_ID);
    }

    // --------------------------------------------------
    // Troca de fonte
    // --------------------------------------------------

    async function chooseSource() {
        const api = window.electronScreenShare;

        if (!api || typeof api.chooseSource !== "function") {
            throw new Error("electronScreenShare.chooseSource indisponível");
        }

        try {
            return await api.chooseSource();
        } catch (error) {
            if (String(error?.message || error).includes("SCREEN_SHARE_CANCELLED")) {
                return null;
            }

            throw error;
        }
    }

    async function waitForRestartControl(previous) {
        const deadline = Date.now() + 1800;

        while (Date.now() < deadline) {
            const current = findCallControls();

            if (
                current?.screen &&
                (current.screen !== previous || !previous?.isConnected)
            ) {
                return current.screen;
            }

            await delay(75);
        }

        return findCallControls()?.screen || null;
    }

    async function waitForShareStart() {
        const deadline = Date.now() + 6500;

        while (Date.now() < deadline) {
            if (isSharing()) {
                return true;
            }

            await delay(100);
        }

        return false;
    }

    async function switchSource() {
        if (switching || !isSharing()) {
            return;
        }

        switching = true;
        removeSwitches();

        try {
            const selection = await chooseSource();

            if (!selection?.sourceId) {
                return;
            }

            const call = findCallControls();
            if (!call?.screen) {
                throw new Error("botão nativo de screen share não encontrado");
            }

            const previous = call.screen;

            // O picker já deixou selectedShareOptions preparado no main.
            previous.click();
            setSharing(false);

            const restartButton = await waitForRestartControl(previous);
            if (!restartButton) {
                throw new Error("botão de screen share não reapareceu");
            }

            await delay(180);
            restartButton.click();

            if (!(await waitForShareStart())) {
                throw new Error("screen share não reiniciou");
            }

            console.log("[ScreenShare UI Lean Dual] fonte trocada.");
        } catch (error) {
            console.error("[ScreenShare UI Lean Dual] falha ao trocar fonte:", error);
        } finally {
            switching = false;
            refresh();
        }
    }

    // --------------------------------------------------
    // Ciclo de vida
    // --------------------------------------------------

    window.addEventListener(STATE_EVENT, refresh);

    const observer = new MutationObserver(() => {
        // Síncrono: corrige o MonitorOff antes do próximo paint quando possível.
        fixLeftScreenIcon();
        refresh();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    setInterval(refresh, 1000);
    refresh();

    console.log("[ScreenShare UI Lean Dual] instalado.");
})();
`;

        try {
            await mainWindow.webContents.executeJavaScript(code, true);
        } catch (error) {
            console.error("[ScreenShare UI Lean Dual] falha ao injetar:", error);
        }
    };

    mainWindow.webContents.on("did-finish-load", inject);
    mainWindow.webContents.on("did-navigate-in-page", () => setTimeout(inject, 100));

    if (!mainWindow.webContents.isLoading()) {
        void inject();
    }
}

module.exports = {
    installScreenShareUi
};
