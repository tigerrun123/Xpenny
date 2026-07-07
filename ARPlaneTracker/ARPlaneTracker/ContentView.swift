import SwiftUI
import simd

enum ARDemoFeature: String, CaseIterable, Identifiable {
    case worldTracking = "World Tracking"
    case planeDetection = "Plane Detection"
    case raycast = "Raycast"
    case sceneReconstruction = "Scene Reconstruction"
    case anchors = "Anchors"
    case roomPlan = "RoomPlan"

    var id: String { rawValue }

    var iconName: String {
        switch self {
        case .worldTracking: "location.viewfinder"
        case .planeDetection: "square.3.layers.3d"
        case .raycast: "scope"
        case .sceneReconstruction: "cube.transparent"
        case .anchors: "mappin.and.ellipse"
        case .roomPlan: "house"
        }
    }
}

struct ContentView: View {
    @State private var cameraPosition = SIMD3<Float>(repeating: 0)
    @State private var trackingStatus = "Starting AR session"
    @State private var activeFeature: ARDemoFeature = .worldTracking
    @State private var isMeasureModeEnabled = false
    @State private var isDeveloperModeEnabled = false
    @State private var isMenuPresented = false
    @State private var isRoomPlanPresented = false
    @State private var measurementStatus = "Measure mode off"
    @State private var fivePointAreaStatus = "Area Mode off"
    @State private var fivePointAreaResult: Float?
    @State private var fivePointAreaResetToken = 0
    @State private var measurements = MeasurementHistoryStore.load()
    @State private var currentPlaneAreaInfo: PlaneAreaInfo?
    @State private var planeCount = 0
    @State private var raycastStatus = "Tap a detected surface."
    @State private var raycastDistance: Float?
    @State private var lidarStatus = "Open Scene Reconstruction to check LiDAR mesh support."
    @State private var meshAnchorCount = 0
    @State private var placedAnchorCount = 0
    @State private var clearToken = 0

    var body: some View {
        ZStack {
            ARViewContainer(
                cameraPosition: $cameraPosition,
                trackingStatus: $trackingStatus,
                activeFeature: $activeFeature,
                isMeasureModeEnabled: $isMeasureModeEnabled,
                isDebugModeEnabled: $isDeveloperModeEnabled,
                currentPlaneAreaInfo: $currentPlaneAreaInfo,
                measurementStatus: $measurementStatus,
                measurements: $measurements,
                isFivePointAreaModeEnabled: .constant(false),
                fivePointAreaStatus: $fivePointAreaStatus,
                fivePointAreaResult: $fivePointAreaResult,
                fivePointAreaResetToken: $fivePointAreaResetToken,
                planeCount: $planeCount,
                raycastStatus: $raycastStatus,
                raycastDistance: $raycastDistance,
                lidarStatus: $lidarStatus,
                meshAnchorCount: $meshAnchorCount,
                placedAnchorCount: $placedAnchorCount,
                clearToken: $clearToken
            )
            .ignoresSafeArea()

            CapabilityDemoOverlay(
                cameraPosition: cameraPosition,
                trackingStatus: trackingStatus,
                activeFeature: $activeFeature,
                isDeveloperModeEnabled: $isDeveloperModeEnabled,
                isMenuPresented: $isMenuPresented,
                planeCount: planeCount,
                currentPlaneAreaInfo: currentPlaneAreaInfo,
                raycastStatus: raycastStatus,
                raycastDistance: raycastDistance,
                lidarStatus: lidarStatus,
                meshAnchorCount: meshAnchorCount,
                placedAnchorCount: placedAnchorCount,
                onRoomPlan: {
                    activeFeature = .roomPlan
                    isRoomPlanPresented = true
                },
                onClear: {
                    clearToken += 1
                }
            )
        }
        .sheet(isPresented: $isRoomPlanPresented) {
            RoomPlanView()
        }
    }
}

private struct CapabilityDemoOverlay: View {
    let cameraPosition: SIMD3<Float>
    let trackingStatus: String
    @Binding var activeFeature: ARDemoFeature
    @Binding var isDeveloperModeEnabled: Bool
    @Binding var isMenuPresented: Bool
    let planeCount: Int
    let currentPlaneAreaInfo: PlaneAreaInfo?
    let raycastStatus: String
    let raycastDistance: Float?
    let lidarStatus: String
    let meshAnchorCount: Int
    let placedAnchorCount: Int
    let onRoomPlan: () -> Void
    let onClear: () -> Void

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                cameraLegibilityGradient
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                CenterCrosshair(isActive: activeFeature == .raycast || activeFeature == .anchors)
                    .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
                    .allowsHitTesting(false)

                VStack(spacing: 14) {
                    TopBar(
                        activeFeature: activeFeature,
                        isMenuPresented: $isMenuPresented,
                        isDeveloperModeEnabled: isDeveloperModeEnabled,
                        onClear: onClear
                    )
                    .padding(.top, geometry.safeAreaInsets.top + 12)
                    .padding(.horizontal, 18)

                    if isMenuPresented {
                        DeveloperMenu(isDeveloperModeEnabled: $isDeveloperModeEnabled)
                            .padding(.horizontal, 18)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    FeatureStatusCard(
                        activeFeature: activeFeature,
                        cameraPosition: cameraPosition,
                        trackingStatus: trackingStatus,
                        planeCount: planeCount,
                        currentPlaneAreaInfo: currentPlaneAreaInfo,
                        raycastStatus: raycastStatus,
                        raycastDistance: raycastDistance,
                        lidarStatus: lidarStatus,
                        meshAnchorCount: meshAnchorCount,
                        placedAnchorCount: placedAnchorCount
                    )
                    .padding(.horizontal, 18)

                    Spacer()

                    FeatureButtonGrid(
                        activeFeature: $activeFeature,
                        onRoomPlan: onRoomPlan
                    )
                    .padding(.horizontal, 14)
                    .padding(.bottom, max(geometry.safeAreaInsets.bottom, 12) + 10)
                }
            }
            .animation(.snappy(duration: 0.24), value: activeFeature)
            .animation(.snappy(duration: 0.22), value: isMenuPresented)
        }
        .foregroundStyle(.white)
    }

    private var cameraLegibilityGradient: some View {
        LinearGradient(
            colors: [
                .black.opacity(0.34),
                .clear,
                .clear,
                .black.opacity(0.50)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

private struct TopBar: View {
    let activeFeature: ARDemoFeature
    @Binding var isMenuPresented: Bool
    let isDeveloperModeEnabled: Bool
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button {
                isMenuPresented.toggle()
            } label: {
                Image(systemName: isMenuPresented ? "xmark" : "line.3.horizontal")
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 48, height: 48)
                    .glassCircle()
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isMenuPresented ? "Close menu" : "Open menu")

            VStack(spacing: 2) {
                Text(activeFeature.rawValue)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(isDeveloperModeEnabled ? "Developer overlays on" : "ARKit capability demo")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(isDeveloperModeEnabled ? .yellow : .white.opacity(0.70))
            }
            .frame(maxWidth: .infinity)
            .shadow(color: .black.opacity(0.30), radius: 8, y: 2)

            Button(action: onClear) {
                Image(systemName: "trash")
                    .font(.system(size: 19, weight: .semibold))
                    .frame(width: 48, height: 48)
                    .glassCircle()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Clear AR content")
        }
    }
}

private struct FeatureStatusCard: View {
    let activeFeature: ARDemoFeature
    let cameraPosition: SIMD3<Float>
    let trackingStatus: String
    let planeCount: Int
    let currentPlaneAreaInfo: PlaneAreaInfo?
    let raycastStatus: String
    let raycastDistance: Float?
    let lidarStatus: String
    let meshAnchorCount: Int
    let placedAnchorCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: activeFeature.iconName)
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Color.white.opacity(0.12)))
                VStack(alignment: .leading, spacing: 2) {
                    Text(primaryText)
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .lineLimit(2)
                        .minimumScaleFactor(0.78)
                    Text(secondaryText)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.70))
                        .lineLimit(2)
                        .minimumScaleFactor(0.72)
                }
            }

            if activeFeature == .worldTracking {
                CameraPositionRows(cameraPosition: cameraPosition)
            }
        }
        .padding(16)
        .frame(maxWidth: 430, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPanel(cornerRadius: 24)
    }

    private var primaryText: String {
        switch activeFeature {
        case .worldTracking:
            return trackingStatus.localizedCaseInsensitiveContains("normal") ? "Tracking Normal" : trackingStatus
        case .planeDetection:
            return "\(planeCount) planes detected"
        case .raycast:
            if let raycastDistance {
                return String(format: "Hit distance: %.2f m", raycastDistance)
            }
            return "Raycast ready"
        case .sceneReconstruction:
            return "\(meshAnchorCount) mesh anchors"
        case .anchors:
            return "\(placedAnchorCount) anchors placed"
        case .roomPlan:
            return "RoomPlan capture"
        }
    }

    private var secondaryText: String {
        switch activeFeature {
        case .worldTracking:
            "Live camera position and tracking state."
        case .planeDetection:
            currentPlaneAreaInfo.map { "\($0.type) largest plane, \($0.formattedArea)" } ?? "Move slowly to discover horizontal and vertical planes."
        case .raycast:
            raycastStatus
        case .sceneReconstruction:
            lidarStatus
        case .anchors:
            "Tap a detected plane to place a persistent visual anchor."
        case .roomPlan:
            "Use the RoomPlan sheet for capture and export."
        }
    }
}

private struct FeatureButtonGrid: View {
    @Binding var activeFeature: ARDemoFeature
    let onRoomPlan: () -> Void

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(ARDemoFeature.allCases) { feature in
                Button {
                    if feature == .roomPlan {
                        onRoomPlan()
                    } else {
                        activeFeature = feature
                    }
                } label: {
                    FeatureButtonLabel(
                        feature: feature,
                        isActive: activeFeature == feature
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .glassPanel(cornerRadius: 28)
        .frame(maxWidth: 520)
    }
}

private struct FeatureButtonLabel: View {
    let feature: ARDemoFeature
    let isActive: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: feature.iconName)
                .font(.system(size: 19, weight: .semibold))
                .frame(width: 30, height: 30)

            Text(feature.rawValue)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .frame(height: 64)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(isActive ? Color.yellow.opacity(0.94) : Color.white.opacity(0.08))
        )
        .foregroundStyle(isActive ? .black : .white)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(.white.opacity(isActive ? 0.10 : 0.16), lineWidth: 1)
        )
    }
}

private struct DeveloperMenu: View {
    @Binding var isDeveloperModeEnabled: Bool

    var body: some View {
        Toggle(isOn: $isDeveloperModeEnabled) {
            Label("Developer Mode", systemImage: "hammer")
                .font(.system(size: 17, weight: .semibold, design: .rounded))
        }
        .tint(.yellow)
        .padding(18)
        .glassPanel(cornerRadius: 24)
        .frame(maxWidth: 380, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct CenterCrosshair: View {
    let isActive: Bool

    var body: some View {
        ZStack {
            Circle()
                .stroke(.white.opacity(0.62), lineWidth: 1.5)
                .frame(width: 34, height: 34)

            Circle()
                .fill(isActive ? Color.yellow : Color.white)
                .frame(width: 5, height: 5)

            tick(rotation: 0)
            tick(rotation: 90)
            tick(rotation: 180)
            tick(rotation: 270)
        }
        .shadow(color: .black.opacity(0.32), radius: 6, y: 2)
        .accessibilityHidden(true)
    }

    private func tick(rotation: Double) -> some View {
        Capsule()
            .fill(.white.opacity(0.78))
            .frame(width: 2, height: 8)
            .offset(y: -25)
            .rotationEffect(.degrees(rotation))
    }
}

private struct CameraPositionRows: View {
    let cameraPosition: SIMD3<Float>

    var body: some View {
        HStack(spacing: 10) {
            coordinate("X", cameraPosition.x)
            coordinate("Y", cameraPosition.y)
            coordinate("Z", cameraPosition.z)
        }
    }

    private func coordinate(_ axis: String, _ value: Float) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(axis)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.58))
            Text(String(format: "% .2f m", value))
                .font(.system(size: 15, weight: .medium, design: .monospaced))
                .lineLimit(1)
                .minimumScaleFactor(0.70)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
                            .fill(Color.black.opacity(0.18))
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(.white.opacity(0.16), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.22), radius: 22, y: 10)
    }

    func glassCircle() -> some View {
        self
            .background(
                Circle()
                    .fill(.ultraThinMaterial)
                    .overlay(Circle().fill(Color.black.opacity(0.14)))
            )
            .overlay(
                Circle()
                    .stroke(.white.opacity(0.18), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.20), radius: 14, y: 7)
    }
}
