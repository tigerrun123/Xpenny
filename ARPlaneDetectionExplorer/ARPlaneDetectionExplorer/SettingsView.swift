import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var viewModel: PlaneDetectionViewModel
    let reset: () -> Void
    let clear: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Button("Reset Session", action: reset)
                Button("Clear All Planes", action: clear)
            }
            HStack {
                Button(viewModel.detectionPaused ? "Resume Detection" : "Pause Detection") {
                    viewModel.detectionPaused.toggle()
                }
                Button(viewModel.showPlaneMesh ? "Hide Plane Mesh" : "Show Plane Mesh") {
                    viewModel.showPlaneMesh.toggle()
                }
            }
            HStack {
                Button(viewModel.showPlaneLabels ? "Hide Labels" : "Show Labels") {
                    viewModel.showPlaneLabels.toggle()
                }
                Button(viewModel.developerMode ? "Developer Off" : "Developer Mode") {
                    viewModel.developerMode.toggle()
                }
            }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.small)
        .tint(.white.opacity(0.24))
        .foregroundStyle(.white)
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
