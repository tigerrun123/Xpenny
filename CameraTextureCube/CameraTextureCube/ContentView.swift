import SwiftUI

struct ContentView: View {
    @State private var zoom: Float = 1.0
    @State private var isTexturePaused = false
    @State private var isAutoRotateEnabled = false
    @State private var resetToken = 0
    @State private var zoomOutToken = 0
    @State private var zoomInToken = 0
    @State private var trackingStatus = "Starting AR session"

    var body: some View {
        ZStack {
            RealityKitView(
                zoom: $zoom,
                isTexturePaused: $isTexturePaused,
                isAutoRotateEnabled: $isAutoRotateEnabled,
                resetToken: $resetToken,
                zoomOutToken: $zoomOutToken,
                zoomInToken: $zoomInToken,
                trackingStatus: $trackingStatus
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                HeaderView(trackingStatus: trackingStatus)
                    .padding(.top, 18)
                    .padding(.horizontal, 18)

                Spacer()

                ControlBar(
                    zoom: zoom,
                    isTexturePaused: $isTexturePaused,
                    isAutoRotateEnabled: $isAutoRotateEnabled,
                    onZoomOut: { zoomOutToken += 1 },
                    onZoomIn: { zoomInToken += 1 },
                    onReset: { resetToken += 1 }
                )
                .padding(.horizontal, 12)
                .padding(.bottom, 18)
            }
        }
    }
}

private struct HeaderView: View {
    let trackingStatus: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "camera.viewfinder")
                .font(.system(size: 20, weight: .semibold))
                .frame(width: 46, height: 46)
                .glassCircle()

            VStack(alignment: .leading, spacing: 3) {
                Text("Camera Texture Cube")
                    .font(.system(size: 19, weight: .semibold, design: .rounded))
                Text(trackingStatus)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
                    .minimumScaleFactor(0.70)
            }

            Spacer()
        }
        .foregroundStyle(.white)
        .padding(14)
        .glassPanel(cornerRadius: 24)
    }
}

private struct ControlBar: View {
    let zoom: Float
    @Binding var isTexturePaused: Bool
    @Binding var isAutoRotateEnabled: Bool
    let onZoomOut: () -> Void
    let onZoomIn: () -> Void
    let onReset: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button(action: onZoomOut) {
                Image(systemName: "minus")
                    .frame(width: 38, height: 44)
            }
            .accessibilityLabel("Zoom out")

            Text("\(Int((zoom * 100).rounded()))%")
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .frame(width: 58)

            Button(action: onZoomIn) {
                Image(systemName: "plus")
                    .frame(width: 38, height: 44)
            }
            .accessibilityLabel("Zoom in")

            Divider()
                .frame(height: 28)
                .overlay(.white.opacity(0.22))

            Button(action: onReset) {
                Label("Reset", systemImage: "arrow.counterclockwise")
                    .labelStyle(.iconOnly)
                    .frame(width: 42, height: 44)
            }
            .accessibilityLabel("Reset cube")

            Button {
                isTexturePaused.toggle()
            } label: {
                Label(isTexturePaused ? "Resume" : "Pause", systemImage: isTexturePaused ? "play.fill" : "pause.fill")
                    .labelStyle(.iconOnly)
                    .frame(width: 42, height: 44)
            }
            .accessibilityLabel(isTexturePaused ? "Resume camera texture" : "Pause camera texture")

            Button {
                isAutoRotateEnabled.toggle()
            } label: {
                Image(systemName: isAutoRotateEnabled ? "rotate.3d.fill" : "rotate.3d")
                    .frame(width: 42, height: 44)
                    .foregroundStyle(isAutoRotateEnabled ? .yellow : .white)
            }
            .accessibilityLabel("Toggle auto rotate")
        }
        .font(.system(size: 17, weight: .semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .buttonStyle(ControlButtonStyle())
        .glassPanel(cornerRadius: 26)
    }
}

private struct ControlButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(configuration.isPressed ? 0.18 : 0.08))
            )
            .opacity(configuration.isPressed ? 0.82 : 1.0)
    }
}

extension View {
    func glassPanel(cornerRadius: CGFloat) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .fill(Color.black.opacity(0.20))
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(.white.opacity(0.16), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.24), radius: 22, y: 10)
    }

    func glassCircle() -> some View {
        self
            .background(
                Circle()
                    .fill(.ultraThinMaterial)
                    .overlay(Circle().fill(Color.black.opacity(0.16)))
            )
            .overlay(
                Circle()
                    .stroke(.white.opacity(0.18), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.22), radius: 14, y: 7)
    }
}
