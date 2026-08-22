#define NOMINMAX
#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <wrl.h>
#include <wrl/implements.h>
#include <wrl/wrappers/corewrappers.h>
#include <propvarutil.h>
#include <fcntl.h>
#include <io.h>
#include <cstdint>
#include <cstdio>
#include <vector>

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;
using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::Wrappers::RoInitializeWrapper;

static HANDLE g_stopEvent = nullptr;

BOOL WINAPI ConsoleHandler(DWORD signal)
{
    if (
        signal == CTRL_C_EVENT ||
        signal == CTRL_BREAK_EVENT ||
        signal == CTRL_CLOSE_EVENT
    ) {
        if (g_stopEvent) {
            SetEvent(g_stopEvent);
        }
        return TRUE;
    }

    return FALSE;
}

class ActivationHandler final :
    public RuntimeClass<
        RuntimeClassFlags<ClassicCom>,
        FtmBase,
        IActivateAudioInterfaceCompletionHandler
    >
{
public:
    ActivationHandler()
    {
        completed_ = CreateEventW(
            nullptr,
            TRUE,
            FALSE,
            nullptr
        );
    }

    ~ActivationHandler()
    {
        if (completed_) {
            CloseHandle(completed_);
        }
    }

    STDMETHODIMP ActivateCompleted(
        IActivateAudioInterfaceAsyncOperation* operation
    ) override
    {
        HRESULT activateHr = E_FAIL;
        ComPtr<IUnknown> unknown;

        HRESULT hr =
            operation->GetActivateResult(
                &activateHr,
                &unknown
            );

        if (SUCCEEDED(hr)) {
            hr = activateHr;
        }

        if (SUCCEEDED(hr)) {
            hr = unknown.As(&audioClient_);
        }

        result_ = hr;

        SetEvent(completed_);

        return S_OK;
    }

    HRESULT WaitForResult(
        IAudioClient** audioClient
    )
    {
        WaitForSingleObject(
            completed_,
            INFINITE
        );

        if (FAILED(result_)) {
            return result_;
        }

        return audioClient_.CopyTo(
            audioClient
        );
    }

private:
    HANDLE completed_ = nullptr;
    HRESULT result_ = E_PENDING;
    ComPtr<IAudioClient> audioClient_;
};

static bool WriteAll(
    HANDLE output,
    const void* data,
    DWORD bytes
)
{
    const BYTE* cursor =
        static_cast<const BYTE*>(data);

    DWORD remaining = bytes;

    while (remaining > 0) {
        DWORD written = 0;

        if (
            !WriteFile(
                output,
                cursor,
                remaining,
                &written,
                nullptr
            ) ||
            written == 0
        ) {
            return false;
        }

        cursor += written;
        remaining -= written;
    }

    return true;
}

static bool WritePacket(
    HANDLE output,
    const BYTE* data,
    UINT32 bytes,
    bool silent
)
{
    if (!WriteAll(
        output,
        &bytes,
        sizeof(bytes)
    )) {
        return false;
    }

    if (bytes == 0) {
        return true;
    }

    if (!silent) {
        return WriteAll(
            output,
            data,
            bytes
        );
    }

    static std::vector<BYTE> zeros;

    if (zeros.size() < bytes) {
        zeros.resize(bytes, 0);
    }

    return WriteAll(
        output,
        zeros.data(),
        bytes
    );
}

int wmain(int argc, wchar_t** argv)
{
    if (argc < 2) {
        fwprintf(
            stderr,
            L"Uso: process-audio-capture.exe <HWND-decimal>\n"
        );
        return 2;
    }

    wchar_t* end = nullptr;

    unsigned long long hwndValue =
        wcstoull(
            argv[1],
            &end,
            10
        );

    if (
        !end ||
        *end != L'\0' ||
        hwndValue == 0
    ) {
        fwprintf(
            stderr,
            L"HWND invalido.\n"
        );
        return 3;
    }

    HWND hwnd =
        reinterpret_cast<HWND>(
            static_cast<uintptr_t>(
                hwndValue
            )
        );

    DWORD processId = 0;

    if (
        !GetWindowThreadProcessId(
            hwnd,
            &processId
        ) ||
        processId == 0
    ) {
        fwprintf(
            stderr,
            L"Nao foi possivel obter o PID da janela. Win32=%lu\n",
            GetLastError()
        );
        return 4;
    }

    /*
     * O helper sempre entrega:
     *
     * 44100 Hz
     * stereo
     * PCM signed 16-bit little endian
     *
     * AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM faz
     * a conversao a partir do formato do Windows.
     */
    WAVEFORMATEX format = {};
    format.wFormatTag =
        WAVE_FORMAT_PCM;

    format.nChannels =
        2;

    format.nSamplesPerSec =
        44100;

    format.wBitsPerSample =
        16;

    format.nBlockAlign =
        format.nChannels *
        format.wBitsPerSample /
        8;

    format.nAvgBytesPerSec =
        format.nSamplesPerSec *
        format.nBlockAlign;

    format.cbSize = 0;

    RoInitializeWrapper initialize(
        RO_INIT_MULTITHREADED
    );

    HRESULT hr =
        initialize;

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"RoInitialize falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 5;
    }

    AUDIOCLIENT_ACTIVATION_PARAMS params = {};
    params.ActivationType =
        AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;

    params.ProcessLoopbackParams.TargetProcessId =
        processId;

    params.ProcessLoopbackParams.ProcessLoopbackMode =
        PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activateParams;
    PropVariantInit(
        &activateParams
    );

    activateParams.vt =
        VT_BLOB;

    activateParams.blob.cbSize =
        sizeof(params);

    activateParams.blob.pBlobData =
        reinterpret_cast<BYTE*>(
            &params
        );

    auto handler =
        Make<ActivationHandler>();

    if (!handler) {
        fwprintf(
            stderr,
            L"Falha criando ActivationHandler.\n"
        );
        return 6;
    }

    ComPtr<
        IActivateAudioInterfaceAsyncOperation
    > operation;

    hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
        __uuidof(IAudioClient),
        &activateParams,
        handler.Get(),
        &operation
    );

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"ActivateAudioInterfaceAsync falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 7;
    }

    ComPtr<IAudioClient> audioClient;

    hr = handler->WaitForResult(
        &audioClient
    );

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"Ativacao de process loopback falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 8;
    }

    const DWORD flags =
        AUDCLNT_STREAMFLAGS_LOOPBACK |
        AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
        AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM |
        AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;

    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        flags,
        0,
        0,
        &format,
        nullptr
    );

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"IAudioClient::Initialize falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 9;
    }

    HANDLE sampleReady =
        CreateEventW(
            nullptr,
            FALSE,
            FALSE,
            nullptr
        );

    g_stopEvent =
        CreateEventW(
            nullptr,
            TRUE,
            FALSE,
            nullptr
        );

    if (
        !sampleReady ||
        !g_stopEvent
    ) {
        fwprintf(
            stderr,
            L"CreateEvent falhou.\n"
        );
        return 10;
    }

    SetConsoleCtrlHandler(
        ConsoleHandler,
        TRUE
    );

    hr = audioClient->SetEventHandle(
        sampleReady
    );

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"SetEventHandle falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 11;
    }

    ComPtr<IAudioCaptureClient>
        captureClient;

    hr = audioClient->GetService(
        IID_PPV_ARGS(
            &captureClient
        )
    );

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"GetService(IAudioCaptureClient) falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 12;
    }

    /*
     * Cabecalho binario:
     * 8 bytes magic "SHKAUD01"
     * uint32 sampleRate
     * uint16 channels
     * uint16 bitsPerSample
     */
    HANDLE output =
        GetStdHandle(
            STD_OUTPUT_HANDLE
        );

    const char magic[8] = {
        'S','H','K','A',
        'U','D','0','1'
    };

    uint32_t sampleRate =
        format.nSamplesPerSec;

    uint16_t channels =
        format.nChannels;

    uint16_t bits =
        format.wBitsPerSample;

    if (
        !WriteAll(
            output,
            magic,
            sizeof(magic)
        ) ||
        !WriteAll(
            output,
            &sampleRate,
            sizeof(sampleRate)
        ) ||
        !WriteAll(
            output,
            &channels,
            sizeof(channels)
        ) ||
        !WriteAll(
            output,
            &bits,
            sizeof(bits)
        )
    ) {
        return 13;
    }

    hr = audioClient->Start();

    if (FAILED(hr)) {
        fwprintf(
            stderr,
            L"IAudioClient::Start falhou: 0x%08X\n",
            static_cast<unsigned>(hr)
        );
        return 14;
    }

    HANDLE waits[2] = {
        g_stopEvent,
        sampleReady
    };

    bool running = true;

    while (running) {
        DWORD wait =
            WaitForMultipleObjects(
                2,
                waits,
                FALSE,
                INFINITE
            );

        if (
            wait ==
            WAIT_OBJECT_0
        ) {
            break;
        }

        if (
            wait !=
            WAIT_OBJECT_0 + 1
        ) {
            break;
        }

        while (true) {
            UINT32 packetFrames = 0;

            hr = captureClient
                ->GetNextPacketSize(
                    &packetFrames
                );

            if (
                FAILED(hr) ||
                packetFrames == 0
            ) {
                break;
            }

            BYTE* data = nullptr;
            UINT32 frames = 0;
            DWORD captureFlags = 0;

            hr = captureClient
                ->GetBuffer(
                    &data,
                    &frames,
                    &captureFlags,
                    nullptr,
                    nullptr
                );

            if (FAILED(hr)) {
                running = false;
                break;
            }

            UINT32 bytes =
                frames *
                format.nBlockAlign;

            bool silent =
                (
                    captureFlags &
                    AUDCLNT_BUFFERFLAGS_SILENT
                ) != 0;

            bool ok =
                WritePacket(
                    output,
                    data,
                    bytes,
                    silent
                );

            captureClient
                ->ReleaseBuffer(
                    frames
                );

            if (!ok) {
                running = false;
                break;
            }
        }
    }

    audioClient->Stop();

    CloseHandle(
        sampleReady
    );

    CloseHandle(
        g_stopEvent
    );

    g_stopEvent = nullptr;

    return 0;
}
