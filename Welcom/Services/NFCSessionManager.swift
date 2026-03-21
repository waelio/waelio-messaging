import Foundation
import Combine
import CoreNFC

class NFCSessionManager: NSObject, ObservableObject {
    private static let featureFlagKey = "NFCFeatureEnabled"

    @Published var sessionCode: String?
    @Published var errorMessage: String?
    @Published var isReading = false
    @Published var isWriting = false
    
    private var nfcSession: NFCNDEFReaderSession?
    private var codeToWrite: String?

    static var isEnabledInBuild: Bool {
        guard let value = Bundle.main.object(forInfoDictionaryKey: featureFlagKey) as? NSNumber else {
            return false
        }

        return value.boolValue
    }

    static var isSupported: Bool {
        guard isEnabledInBuild else {
            return false
        }

#if targetEnvironment(simulator)
        return false
#else
        if ProcessInfo.processInfo.isiOSAppOnMac {
            return false
        }

        return NFCNDEFReaderSession.readingAvailable
#endif
    }

    static var unavailableMessage: String {
        guard isEnabledInBuild else {
            return "NFC is not available on this device."
        }

#if targetEnvironment(simulator)
        return "NFC is not available in the iOS Simulator."
#else
        if ProcessInfo.processInfo.isiOSAppOnMac {
            return "NFC is not available when running an iPhone or iPad app on Mac."
        }

        return "NFC is not available on this device or with the current signing configuration."
#endif
    }
    
    // MARK: - Read Session Code
    
    func startReading() {
        guard Self.isSupported else {
            errorMessage = Self.unavailableMessage
            return
        }
        
        nfcSession = NFCNDEFReaderSession(
            delegate: self,
            queue: nil,
            invalidateAfterFirstRead: true
        )
        
        nfcSession?.alertMessage = "Hold your iPhone near another device to read the session code"
        nfcSession?.begin()
        isReading = true
    }
    
    // MARK: - Write Session Code
    
    func startWriting(code: String) {
        guard Self.isSupported else {
            errorMessage = Self.unavailableMessage
            return
        }
        
        codeToWrite = code
        
        nfcSession = NFCNDEFReaderSession(
            delegate: self,
            queue: nil,
            invalidateAfterFirstRead: false
        )
        
        nfcSession?.alertMessage = "Hold your iPhone near another device to share the session code"
        nfcSession?.begin()
        isWriting = true
    }
    
    private func createNFCMessage(with code: String) -> NFCNDEFMessage {
        let payload = NFCNDEFPayload(
            format: .nfcWellKnown,
            type: "T".data(using: .utf8)!,
            identifier: Data(),
            payload: createTextPayload(text: code)
        )
        
        return NFCNDEFMessage(records: [payload])
    }
    
    private func createTextPayload(text: String) -> Data {
        // Text Record Format: [Status Byte][Language Code][Text]
        let languageCode = "en"
        let languageCodeData = languageCode.data(using: .utf8)!
        let textData = text.data(using: .utf8)!
        
        var payload = Data()
        payload.append(UInt8(languageCodeData.count)) // Status byte with language code length
        payload.append(languageCodeData)
        payload.append(textData)
        
        return payload
    }
    
    private func parseTextPayload(from payload: NFCNDEFPayload) -> String? {
        guard payload.typeNameFormat == .nfcWellKnown,
              let type = String(data: payload.type, encoding: .utf8),
              type == "T" else {
            return nil
        }
        
        let data = payload.payload
        guard data.count > 1 else { return nil }
        
        let languageCodeLength = Int(data[0] & 0x3F)
        guard data.count > languageCodeLength + 1 else { return nil }
        
        let textData = data.subdata(in: (languageCodeLength + 1)..<data.count)
        return String(data: textData, encoding: .utf8)
    }
}

// MARK: - NFCNDEFReaderSessionDelegate

extension NFCSessionManager: NFCNDEFReaderSessionDelegate {
    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        guard let message = messages.first,
              let payload = message.records.first,
              let code = parseTextPayload(from: payload) else {
            return
        }
        
        DispatchQueue.main.async {
            self.sessionCode = code
            self.isReading = false
        }
        
        session.alertMessage = "Session code received!"
        session.invalidate()
    }
    
    func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard let tag = tags.first else {
            session.invalidate(errorMessage: "No tag found")
            return
        }
        
        session.connect(to: tag) { error in
            if let error = error {
                session.invalidate(errorMessage: "Connection failed: \(error.localizedDescription)")
                return
            }
            
            tag.queryNDEFStatus { status, capacity, error in
                guard error == nil else {
                    session.invalidate(errorMessage: "Query failed")
                    return
                }
                
                if self.isWriting, let code = self.codeToWrite {
                    // Write mode
                    let message = self.createNFCMessage(with: code)
                    
                    tag.writeNDEF(message) { error in
                        if let error = error {
                            session.invalidate(errorMessage: "Write failed: \(error.localizedDescription)")
                            DispatchQueue.main.async {
                                self.errorMessage = "Failed to write: \(error.localizedDescription)"
                                self.isWriting = false
                            }
                        } else {
                            session.alertMessage = "Session code shared successfully!"
                            session.invalidate()
                            DispatchQueue.main.async {
                                self.isWriting = false
                            }
                        }
                    }
                } else if self.isReading {
                    // Read mode
                    tag.readNDEF { message, error in
                        guard error == nil,
                              let message = message,
                              let payload = message.records.first,
                              let code = self.parseTextPayload(from: payload) else {
                            session.invalidate(errorMessage: "Failed to read session code")
                            return
                        }
                        
                        DispatchQueue.main.async {
                            self.sessionCode = code
                            self.isReading = false
                        }
                        
                        session.alertMessage = "Session code received!"
                        session.invalidate()
                    }
                }
            }
        }
    }
    
    func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {
        // Session is active
    }
    
    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        DispatchQueue.main.async {
            self.isReading = false
            self.isWriting = false
            
            if let nfcError = error as? NFCReaderError,
               nfcError.code != .readerSessionInvalidationErrorUserCanceled {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}
