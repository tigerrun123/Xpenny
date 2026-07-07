import ARKit
import Combine
import simd

@MainActor
final class PlaneDetectionViewModel: ObservableObject {
    enum TrackingSummary: Equatable {
        case unavailable
        case normal
        case limited(String)
        case notAvailable

        var displayText: String {
            switch self {
            case .unavailable: return "Starting"
            case .normal: return "Normal"
            case .limited(let reason): return "Limited: \(reason)"
            case .notAvailable: return "Not Available"
            }
        }
    }

    struct PlaneSnapshot: Identifiable, Equatable {
        let id: UUID
        let shortID: String
        var width: Float
        var length: Float
        var alignment: ARPlaneAnchor.Alignment
        var center: SIMD3<Float>

        var area: Float { width * length }
        var alignmentName: String { alignment == .horizontal ? "Horizontal" : "Vertical" }
    }

    @Published var trackingState: TrackingSummary = .unavailable
    @Published var cameraPosition = SIMD3<Float>(repeating: 0)
    @Published var fps: Double = 0
    @Published var planes: [UUID: PlaneSnapshot] = [:]
    @Published var showPlaneMesh = true
    @Published var showPlaneLabels = true
    @Published var developerMode = false
    @Published var detectionPaused = false
    @Published var sessionStatistics = "Waiting for ARSession statistics"

    var planeCount: Int { planes.count }

    func updatePlane(id: UUID, width: Float, length: Float, alignment: ARPlaneAnchor.Alignment, center: SIMD3<Float>) {
        let shortID = String(id.uuidString.prefix(8)).uppercased()
        planes[id] = PlaneSnapshot(id: id, shortID: shortID, width: width, length: length, alignment: alignment, center: center)
    }

    func removePlane(id: UUID) {
        planes.removeValue(forKey: id)
    }

    func removeAllPlanes() {
        planes.removeAll()
    }

    func updateTrackingState(_ state: ARCamera.TrackingState) {
        switch state {
        case .normal:
            trackingState = .normal
        case .notAvailable:
            trackingState = .notAvailable
        case .limited(let reason):
            trackingState = .limited(reason.description)
        }
    }
}

private extension ARCamera.TrackingState.Reason {
    var description: String {
        switch self {
        case .excessiveMotion: return "Excessive Motion"
        case .insufficientFeatures: return "Insufficient Features"
        case .initializing: return "Initializing"
        case .relocalizing: return "Relocalizing"
        @unknown default: return "Unknown"
        }
    }
}
