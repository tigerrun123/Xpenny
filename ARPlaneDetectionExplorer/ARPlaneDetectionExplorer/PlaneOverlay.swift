import SwiftUI

struct CrosshairView: View {
    var body: some View {
        ZStack {
            Rectangle().fill(.white.opacity(0.9)).frame(width: 28, height: 2)
            Rectangle().fill(.white.opacity(0.9)).frame(width: 2, height: 28)
            Circle().stroke(.white.opacity(0.9), lineWidth: 1).frame(width: 8, height: 8)
        }
        .shadow(radius: 2)
        .allowsHitTesting(false)
    }
}

struct StatusPanel: View {
    @EnvironmentObject var viewModel: PlaneDetectionViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Tracking: \(viewModel.trackingState.displayText)")
            Text("Planes: \(viewModel.planeCount)")
            Text(String(format: "Camera: X %.2f  Y %.2f  Z %.2f", viewModel.cameraPosition.x, viewModel.cameraPosition.y, viewModel.cameraPosition.z))
            Text(String(format: "FPS: %.0f", viewModel.fps))
            if viewModel.developerMode {
                Divider().background(.white.opacity(0.5))
                Text(viewModel.sessionStatistics)
                Text("Developer: origin, axes, anchors, boundaries")
            }
        }
        .font(.caption.monospacedDigit())
        .foregroundStyle(.white)
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
