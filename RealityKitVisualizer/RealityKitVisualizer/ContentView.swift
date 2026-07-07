import SwiftUI

struct ContentView: View {
    @State private var addCubeToken = 0
    @State private var addSphereToken = 0
    @State private var resetToken = 0
    @State private var isAnimationEnabled = true
    @State private var sceneStatus = "RealityKit scene ready"

    var body: some View {
        ZStack {
            RealityKitSceneView(
                addCubeToken: $addCubeToken,
                addSphereToken: $addSphereToken,
                resetToken: $resetToken,
                isAnimationEnabled: $isAnimationEnabled,
                sceneStatus: $sceneStatus
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                HeaderView(sceneStatus: sceneStatus)
                    .padding(.top, 18)
                    .padding(.horizontal, 18)

                Spacer()

                ControlPanel(
                    isAnimationEnabled: $isAnimationEnabled,
                    onAddCube: { addCubeToken += 1 },
                    onAddSphere: { addSphereToken += 1 },
                    onReset: { resetToken += 1 }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 18)
            }
        }
    }
}

private struct HeaderView: View {
    let sceneStatus: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("RealityKit Visualizer")
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                Text(sceneStatus)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }

            Spacer()

            Image(systemName: "cube.transparent")
                .font(.system(size: 22, weight: .semibold))
                .frame(width: 48, height: 48)
                .glassCircle()
        }
        .foregroundStyle(.white)
        .padding(16)
        .glassPanel(cornerRadius: 24)
    }
}

private struct ControlPanel: View {
    @Binding var isAnimationEnabled: Bool
    let onAddCube: () -> Void
    let onAddSphere: () -> Void
    let onReset: () -> Void

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            Button(action: onAddCube) {
                ControlButtonLabel(title: "Add Cube", icon: "cube")
            }

            Button(action: onAddSphere) {
                ControlButtonLabel(title: "Add Sphere", icon: "circle")
            }

            Button {
                isAnimationEnabled.toggle()
            } label: {
                ControlButtonLabel(
                    title: isAnimationEnabled ? "Pause Animation" : "Start Animation",
                    icon: isAnimationEnabled ? "pause.fill" : "play.fill"
                )
            }

            Button(action: onReset) {
                ControlButtonLabel(title: "Reset Scene", icon: "arrow.counterclockwise")
            }
        }
        .buttonStyle(SceneControlButtonStyle())
        .padding(10)
        .glassPanel(cornerRadius: 28)
        .frame(maxWidth: 520)
    }
}

private struct ControlButtonLabel: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .semibold))
                .frame(width: 28, height: 28)

            Text(title)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: 58)
    }
}

private struct SceneControlButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 12)
            .foregroundStyle(.white)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(configuration.isPressed ? 0.16 : 0.09))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.16), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.84 : 1)
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
