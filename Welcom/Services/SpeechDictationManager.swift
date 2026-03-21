import Foundation
import Speech
import AVFoundation
import Combine

@MainActor
final class SpeechDictationManager: ObservableObject {
    @Published var isRecording = false
    @Published var errorMessage: String?

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale.current)
    private var baseText: String = ""

    func toggleDictation(currentText: String, onUpdate: @escaping (String) -> Void) {
        if isRecording {
            stopDictation()
        } else {
            startDictation(currentText: currentText, onUpdate: onUpdate)
        }
    }

    func stopDictation() {
        recognitionTask?.cancel()
        recognitionTask = nil

        recognitionRequest?.endAudio()
        recognitionRequest = nil

        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }

        isRecording = false
    }

    private func startDictation(currentText: String, onUpdate: @escaping (String) -> Void) {
        guard let speechRecognizer, speechRecognizer.isAvailable else {
            errorMessage = "Speech recognition is currently unavailable."
            return
        }

        requestAccess { [weak self] granted in
            guard let self else { return }
            guard granted else {
                self.errorMessage = "Please allow microphone and speech recognition access in Settings."
                return
            }

            self.baseText = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
            self.errorMessage = nil

            self.recognitionTask?.cancel()
            self.recognitionTask = nil

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            self.recognitionRequest = request

            let session = AVAudioSession.sharedInstance()
            do {
                try session.setCategory(.record, mode: .measurement, options: .duckOthers)
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                self.errorMessage = "Audio session setup failed: \(error.localizedDescription)"
                return
            }

            let inputNode = self.audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.removeTap(onBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            self.audioEngine.prepare()
            do {
                try self.audioEngine.start()
            } catch {
                self.errorMessage = "Could not start recording: \(error.localizedDescription)"
                return
            }

            self.isRecording = true

            self.recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }

                if let result {
                    let spoken = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    let combined = self.baseText.isEmpty
                        ? spoken
                        : (spoken.isEmpty ? self.baseText : "\(self.baseText) \(spoken)")
                    onUpdate(combined)

                    if result.isFinal {
                        self.stopDictation()
                    }
                }

                if let error {
                    self.errorMessage = "Dictation error: \(error.localizedDescription)"
                    self.stopDictation()
                }
            }
        }
    }

    private func requestAccess(completion: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            guard speechStatus == .authorized else {
                DispatchQueue.main.async {
                    completion(false)
                }
                return
            }

            AVAudioApplication.requestRecordPermission { micGranted in
                DispatchQueue.main.async {
                    completion(micGranted)
                }
            }
        }
    }
}
