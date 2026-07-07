import RoomPlan
import SwiftUI

struct RoomPlanView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var capturedRoom: CapturedRoom?
    @State private var status = RoomCaptureSession.isSupported
        ? "Move slowly around the room."
        : "RoomPlan is not supported on this device."

    var body: some View {
        ZStack {
            if RoomCaptureSession.isSupported {
                RoomCaptureContainer(capturedRoom: $capturedRoom, status: $status)
                    .ignoresSafeArea()
            } else {
                Color.black.ignoresSafeArea()
            }

            VStack(spacing: 12) {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .semibold))
                            .frame(width: 44, height: 44)
                            .glassCircle()
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Text("RoomPlan")
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .shadow(color: .black.opacity(0.3), radius: 8, y: 2)

                    Spacer()

                    Image(systemName: "house")
                        .font(.system(size: 18, weight: .semibold))
                        .frame(width: 44, height: 44)
                        .glassCircle()
                }

                RoomPlanSummaryCard(room: capturedRoom, status: status)

                Spacer()

                HStack(spacing: 12) {
                    Button {
                        exportJSON()
                    } label: {
                        Label("Export JSON", systemImage: "doc.text")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(RoomPlanActionButtonStyle(isProminent: true))
                    .disabled(capturedRoom == nil)

                    Button {
                        exportUSDZ()
                    } label: {
                        Label("Export USDZ", systemImage: "cube")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(RoomPlanActionButtonStyle(isProminent: false))
                    .disabled(capturedRoom == nil)
                }
                .padding(.bottom, 18)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .foregroundStyle(.white)
        }
    }

    private func exportJSON() {
        guard let capturedRoom else { return }

        do {
            let url = documentsURL(fileName: "RoomPlanCapture.json")
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(capturedRoom).write(to: url, options: [.atomic])
            status = "Exported JSON to Documents/RoomPlanCapture.json"
        } catch {
            status = "JSON export failed: \(error.localizedDescription)"
        }
    }

    private func exportUSDZ() {
        guard let capturedRoom else { return }

        do {
            let url = documentsURL(fileName: "RoomPlanCapture.usdz")
            try capturedRoom.export(to: url, exportOptions: .mesh)
            status = "Exported USDZ to Documents/RoomPlanCapture.usdz"
        } catch {
            status = "USDZ export failed: \(error.localizedDescription)"
        }
    }

    private func documentsURL(fileName: String) -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }
}

private struct RoomCaptureContainer: UIViewRepresentable {
    @Binding var capturedRoom: CapturedRoom?
    @Binding var status: String

    func makeCoordinator() -> Coordinator {
        Coordinator(capturedRoom: $capturedRoom, status: $status)
    }

    func makeUIView(context: Context) -> RoomCaptureView {
        let captureView = RoomCaptureView(frame: .zero)
        captureView.captureSession.delegate = context.coordinator
        captureView.isModelEnabled = true

        var configuration = RoomCaptureSession.Configuration()
        configuration.isCoachingEnabled = true
        captureView.captureSession.run(configuration: configuration)
        return captureView
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

    static func dismantleUIView(_ uiView: RoomCaptureView, coordinator: Coordinator) {
        uiView.captureSession.stop()
    }

    final class Coordinator: NSObject, RoomCaptureSessionDelegate {
        private var capturedRoom: Binding<CapturedRoom?>
        private var status: Binding<String>

        init(capturedRoom: Binding<CapturedRoom?>, status: Binding<String>) {
            self.capturedRoom = capturedRoom
            self.status = status
        }

        func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
            capturedRoom.wrappedValue = room
            status.wrappedValue = "Scanning room elements."
        }

        func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: (any Error)?) {
            if let error {
                status.wrappedValue = "Room capture ended: \(error.localizedDescription)"
            } else {
                status.wrappedValue = "Room capture ended. Processing final room."
            }
        }
    }
}

private struct RoomPlanSummaryCard: View {
    let room: CapturedRoom?
    let status: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(status)
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.75)

            HStack(spacing: 10) {
                metric("Walls", room?.walls.count ?? 0)
                metric("Doors", room?.doors.count ?? 0)
                metric("Windows", room?.windows.count ?? 0)
            }

            HStack(spacing: 10) {
                metric("Openings", room?.openings.count ?? 0)
                metric("Furniture", room?.objects.count ?? 0)
                metric("Floors", room?.floors.count ?? 0)
            }
        }
        .padding(16)
        .glassPanel(cornerRadius: 24)
    }

    private func metric(_ title: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.60))
            Text("\(value)")
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct RoomPlanActionButtonStyle: ButtonStyle {
    let isProminent: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold, design: .rounded))
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
            .foregroundStyle(isProminent ? .black : .white)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(isProminent ? Color.yellow.opacity(configuration.isPressed ? 0.76 : 0.95) : Color.white.opacity(configuration.isPressed ? 0.12 : 0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(isProminent ? 0.10 : 0.16), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.86 : 1)
    }
}
