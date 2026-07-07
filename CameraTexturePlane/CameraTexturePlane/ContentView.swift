import SwiftUI

struct ContentView: View {
    @State private var isCameraPaused = false
    @State private var isDeveloperModeEnabled = false
    @State private var resetToken = 0
    @State private var cameraPosition = SIMD3<Float>(repeating: 0)
    @State private var trackingStatus = "Starting"

    var body: some View {
        ZStack {
            CameraRealityView(
                isCameraPaused: $isCameraPaused,
                isDeveloperModeEnabled: $isDeveloperModeEnabled,
                resetToken: $resetToken,
                cameraPosition: $cameraPosition,
                trackingStatus: $trackingStatus
            )
            .ignoresSafeArea()

            if isDeveloperModeEnabled {
                developerPanel
            }

            VStack {
                Spacer()
                toolbar
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
    }

    private var developerPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Developer Mode")
                .font(.headline)
            Text(trackingStatus)
            Text(String(format: "Camera X %.3f  Y %.3f  Z %.3f", cameraPosition.x, cameraPosition.y, cameraPosition.z))
            Text("World origin, plane anchor, and axes visible")
                .foregroundStyle(.secondary)
        }
        .font(.system(.subheadline, design: .rounded))
        .foregroundStyle(.white)
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.top, 58)
        .padding(.horizontal, 16)
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            Button("Reset") {
                resetToken += 1
            }

            Button("Pause Camera") {
                isCameraPaused = true
            }
            .disabled(isCameraPaused)

            Button("Resume Camera") {
                isCameraPaused = false
            }
            .disabled(!isCameraPaused)

            Toggle("Developer Mode", isOn: $isDeveloperModeEnabled)
                .toggleStyle(.button)
        }
        .font(.system(.callout, design: .rounded).weight(.semibold))
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .tint(.white)
        .padding(12)
        .background(.ultraThinMaterial, in: Capsule())
        .foregroundStyle(.white)
    }
}
