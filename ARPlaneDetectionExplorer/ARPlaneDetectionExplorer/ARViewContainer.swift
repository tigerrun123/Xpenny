import ARKit
import RealityKit
import SwiftUI

struct ARViewContainer: UIViewRepresentable {
    @EnvironmentObject var viewModel: PlaneDetectionViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        arView.automaticallyConfigureSession = false
        arView.environment.sceneUnderstanding.options = []
        context.coordinator.install(on: arView)
        context.coordinator.runSession(reset: true)
        return arView
    }

    func updateUIView(_ arView: ARView, context: Context) {
        context.coordinator.viewModel = viewModel
        context.coordinator.applyVisibility()
        viewModel.detectionPaused ? context.coordinator.pauseDetection() : context.coordinator.resumeDetection()
    }

    final class Coordinator: NSObject, ARSessionDelegate {
        var viewModel: PlaneDetectionViewModel
        private weak var arView: ARView?
        private var planeEntities: [UUID: PlaneEntity] = [:]
        private var worldOrigin: AnchorEntity?
        private var lastFrameTimestamp: TimeInterval = 0

        init(viewModel: PlaneDetectionViewModel) {
            self.viewModel = viewModel
        }

        deinit {
            NotificationCenter.default.removeObserver(self)
        }

        func install(on arView: ARView) {
            self.arView = arView
            arView.session.delegate = self
            NotificationCenter.default.addObserver(self, selector: #selector(handleReset), name: .resetARSession, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(handleClear), name: .clearARPlanes, object: nil)
            addWorldOrigin(to: arView)
        }

        func runSession(reset: Bool) {
            guard ARWorldTrackingConfiguration.isSupported else { return }
            let configuration = ARWorldTrackingConfiguration()
            configuration.planeDetection = [.horizontal, .vertical]
            configuration.environmentTexturing = .automatic
            var options: ARSession.RunOptions = []
            if reset { options = [.resetTracking, .removeExistingAnchors] }
            arView?.session.run(configuration, options: options)
        }

        func pauseDetection() {
            guard let configuration = arView?.session.configuration as? ARWorldTrackingConfiguration else { return }
            guard !configuration.planeDetection.isEmpty else { return }
            configuration.planeDetection = []
            arView?.session.run(configuration)
        }

        func resumeDetection() {
            guard let configuration = arView?.session.configuration as? ARWorldTrackingConfiguration else { return }
            guard configuration.planeDetection.isEmpty else { return }
            configuration.planeDetection = [.horizontal, .vertical]
            arView?.session.run(configuration)
        }

        @objc private func handleReset() {
            resetSession()
        }

        @objc private func handleClear() {
            clearPlanes()
        }

        func resetSession() {
            planeEntities.values.forEach { $0.removeFromParent() }
            planeEntities.removeAll()
            Task { @MainActor in viewModel.removeAllPlanes() }
            runSession(reset: true)
        }

        func clearPlanes() {
            planeEntities.values.forEach { $0.removeFromParent() }
            planeEntities.removeAll()
            Task { @MainActor in viewModel.removeAllPlanes() }
        }

        func applyVisibility() {
            worldOrigin?.isEnabled = viewModel.developerMode
            for entity in planeEntities.values {
                entity.isEnabled = true
            }
        }

        func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
            for case let anchor as ARPlaneAnchor in anchors {
                let entity = PlaneEntity(anchor: anchor)
                arView?.scene.addAnchor(entity)
                planeEntities[anchor.identifier] = entity
                publish(anchor)
            }
        }

        func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
            for case let anchor as ARPlaneAnchor in anchors {
                planeEntities[anchor.identifier]?.update(with: anchor, showMesh: viewModel.showPlaneMesh, showLabel: viewModel.showPlaneLabels, developerMode: viewModel.developerMode)
                publish(anchor)
            }
        }

        func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
            for anchor in anchors {
                planeEntities[anchor.identifier]?.removeFromParent()
                planeEntities.removeValue(forKey: anchor.identifier)
                Task { @MainActor in viewModel.removePlane(id: anchor.identifier) }
            }
        }

        func session(_ session: ARSession, didUpdate frame: ARFrame) {
            let transform = frame.camera.transform
            let position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let fps = lastFrameTimestamp > 0 ? 1.0 / (frame.timestamp - lastFrameTimestamp) : 0
            lastFrameTimestamp = frame.timestamp
            Task { @MainActor in
                viewModel.cameraPosition = position
                viewModel.updateTrackingState(frame.camera.trackingState)
                viewModel.fps = fps
                viewModel.sessionStatistics = "Anchors: \(frame.anchors.count) • Mapping: \(frame.worldMappingStatus.description)"
            }
        }

        private func publish(_ anchor: ARPlaneAnchor) {
            Task { @MainActor in
                viewModel.updatePlane(id: anchor.identifier, width: anchor.extent.x, length: anchor.extent.z, alignment: anchor.alignment, center: anchor.center)
            }
        }

        private func addWorldOrigin(to arView: ARView) {
            let origin = AnchorEntity(world: .zero)
            let materials = [UnlitMaterial(color: .red), UnlitMaterial(color: .green), UnlitMaterial(color: .blue)]
            let x = ModelEntity(mesh: .generateBox(size: [0.4, 0.01, 0.01]), materials: [materials[0]])
            x.position.x = 0.2
            let y = ModelEntity(mesh: .generateBox(size: [0.01, 0.4, 0.01]), materials: [materials[1]])
            y.position.y = 0.2
            let z = ModelEntity(mesh: .generateBox(size: [0.01, 0.01, 0.4]), materials: [materials[2]])
            z.position.z = 0.2
            [x, y, z].forEach { origin.addChild($0) }
            origin.isEnabled = false
            arView.scene.addAnchor(origin)
            worldOrigin = origin
        }
    }
}

private extension ARFrame.WorldMappingStatus {
    var description: String {
        switch self {
        case .notAvailable: return "Not Available"
        case .limited: return "Limited"
        case .extending: return "Extending"
        case .mapped: return "Mapped"
        @unknown default: return "Unknown"
        }
    }
}
