// Sharkord Desktop — preload principal
//
// Bootstrap modular e resiliente.
// Cada responsabilidade vive em seu próprio módulo.
// Um erro isolado não deve impedir os outros módulos de carregar.
//
// IMPORTANTE:
// A antiga injeção visual da Server Sidebar foi removida deste bootstrap.
// O layout agora deve ser controlado pelo source React do Sharkord Client.

const modules = [
    {
        name: "Updater API",
        path: "./preload/updater-api"
    },
    {
        name: "ScreenShare API",
        path: "./preload/screen-share-api"
    },
    {
        name: "Process Audio API",
        path: "./preload/process-audio-api"
    },
    {
        name: "Voice Admin",
        path: "./preload/voice-admin-main-world"
    },
    {
        name: "ScreenShare Main World",
        path: "./preload/screen-share-main-world"
    },
    {
        name: "Server Rail API",
        path: "./preload/server-rail-api"
    }
];

for (const moduleEntry of modules) {
    try {
        require(moduleEntry.path);

        console.log(
            `[Main Preload] ${moduleEntry.name} carregado.`
        );
    } catch (error) {
        console.error(
            `[Main Preload] falha carregando ${moduleEntry.name}:`,
            error
        );
    }
}
