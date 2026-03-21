import SwiftUI

struct SessionRatingView: View {
    let session: Session
    let userId: String
    @Environment(\.dismiss) var dismiss
    
    @State private var overallRating: Int = 0
    @State private var respectfulnessRating: Int = 0
    @State private var agreementReached: Bool = false
    @State private var wouldNegotiateAgain: Bool = false
    @State private var feedback: String = ""
    @State private var showingThankYou = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 30) {
                    // Header
                    VStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.green)
                        
                        Text("Session Complete")
                            .font(.title)
                            .bold()
                        
                        Text("How was your negotiation experience?")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 20)
                    
                    VStack(spacing: 25) {
                        // Overall Rating
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Overall Experience")
                                .font(.headline)
                            
                            HStack(spacing: 12) {
                                ForEach(1...5, id: \.self) { star in
                                    Button(action: { overallRating = star }) {
                                        Image(systemName: star <= overallRating ? "star.fill" : "star")
                                            .font(.system(size: 32))
                                            .foregroundColor(star <= overallRating ? .yellow : .gray)
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.1))
                        )
                        
                        // Respectfulness Rating
                        VStack(alignment: .leading, spacing: 10) {
                            Text("How respectful was the other party?")
                                .font(.headline)
                            
                            HStack(spacing: 12) {
                                ForEach(1...5, id: \.self) { star in
                                    Button(action: { respectfulnessRating = star }) {
                                        Image(systemName: star <= respectfulnessRating ? "heart.fill" : "heart")
                                            .font(.system(size: 32))
                                            .foregroundColor(star <= respectfulnessRating ? .red : .gray)
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.1))
                        )
                        
                        // Agreement Reached
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Outcome")
                                .font(.headline)
                            
                            Toggle("Agreement Reached", isOn: $agreementReached)
                                .tint(.green)
                            
                            Toggle("Would Negotiate Again", isOn: $wouldNegotiateAgain)
                                .tint(.blue)
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.1))
                        )
                        
                        // Feedback
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Additional Feedback (Optional)")
                                .font(.headline)
                            
                            TextEditor(text: $feedback)
                                .frame(height: 100)
                                .padding(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                )
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.1))
                        )
                    }
                    .padding(.horizontal)
                    
                    // Submit Button
                    Button(action: submitRating) {
                        HStack {
                            Spacer()
                            Text("Submit Rating")
                                .bold()
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(overallRating > 0 && respectfulnessRating > 0 ? Color.blue : Color.gray)
                        )
                    }
                    .disabled(overallRating == 0 || respectfulnessRating == 0)
                    .padding(.horizontal)
                    .padding(.bottom, 30)
                }
            }
            .navigationTitle("Rate Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") {
                        dismiss()
                    }
                }
            }
            .alert("Thank You!", isPresented: $showingThankYou) {
                Button("Done") {
                    dismiss()
                }
            } message: {
                Text("Your feedback helps improve the negotiation experience for everyone.")
            }
        }
    }
    
    private func submitRating() {
        let rating = SessionRating(
            sessionId: session.id,
            userId: userId,
            overallRating: overallRating,
            respectfulnessRating: respectfulnessRating,
            agreementReached: agreementReached,
            wouldNegotiateAgain: wouldNegotiateAgain,
            feedback: feedback.isEmpty ? nil : feedback
        )
        
        // TODO: Save to Firebase/backend
        print("Rating submitted: \(rating)")
        
        showingThankYou = true
    }
}

#Preview {
    SessionRatingView(
        session: Session(
            title: "Sample Negotiation",
            sessionCode: "ABC123",
            status: .completed,
            currentTurn: .partyA,
            currentTurnNumber: 10,
            maxTurns: 10,
            turnDuration: 120,
            partyAId: "user1",
            partyBId: "user2",
            turnStartedAt: Date()
        ),
        userId: "user1"
    )
}
