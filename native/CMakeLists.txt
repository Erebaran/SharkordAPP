cmake_minimum_required(VERSION 3.20)

project(
    SharkordProcessAudio
    LANGUAGES CXX
)

add_executable(
    process-audio-capture
    process-audio-capture.cpp
)

target_compile_features(
    process-audio-capture
    PRIVATE
    cxx_std_17
)

target_compile_definitions(
    process-audio-capture
    PRIVATE
    UNICODE
    _UNICODE
)

target_link_libraries(
    process-audio-capture
    PRIVATE
    Ole32
    Propsys
    Mmdevapi
    RuntimeObject
)
