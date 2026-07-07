import ARKit
import RealityKit

final class CameraSession: NSObject, ARSessionDelegate {
    var onFrame: ((ARFrame) -> Void)?
    var onCameraUpdate: ((SIMD3<Float>, String) -> Void)?

    func run(on arView: ARView) {
        let configuration = ARWorldTrackingConfiguration()
        configuration.environmentTexturing = .none
        arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    func pause(_ arView: ARView) {
        arView.session.pause()
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        onFrame?(frame)

        let transform = frame.camera.transform
        let position = SIMD3<Float>(
            transform.columns.3.x,
            transform.columns.3.y,
            transform.columns.3.z
        )
        onCameraUpdate?(position, trackingDescription(frame.camera.trackingState))
    }

    private func trackingDescription(_ state: ARCamera.TrackingState) -> String {
        switch state {
        case .normal:
            return "Tracking normal"
        case .notAvailable:
            return "Tracking unavailable"
        case .limited(let reason):
            return "Tracking limited: \(reason)"
        }
    }
}
