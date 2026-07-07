import ARKit
import Combine
import Metal
import RealityKit
import SwiftUI

struct CameraRealityView: UIViewRepresentable {
    @Binding var isCameraPaused: Bool
    @Binding var isDeveloperModeEnabled: Bool
    @Binding var resetToken: Int
    @Binding var cameraPosition: SIMD3<Float>
    @Binding var trackingStatus: String

    func makeCoordinator() -> Coordinator {
        Coordinator(
            isCameraPaused: $isCameraPaused,
            isDeveloperModeEnabled: $isDeveloperModeEnabled,
            resetToken: $resetToken,
            cameraPosition: $cameraPosition,
            trackingStatus: $trackingStatus
        )
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        arView.automaticallyConfigureSession = false
        arView.renderOptions.insert(.disableMotionBlur)
        arView.session.delegate = context.coordinator.cameraSession
        context.coordinator.install(in: arView)
        context.coordinator.cameraSession.run(on: arView)
        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.updateCommands(on: uiView)
    }

    static func dismantleUIView(_ uiView: ARView, coordinator: Coordinator) {
        coordinator.stop()
        coordinator.cameraSession.pause(uiView)
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let cameraSession = CameraSession()

        private var isCameraPaused: Binding<Bool>
        private var isDeveloperModeEnabled: Binding<Bool>
        private var resetToken: Binding<Int>
        private var cameraPosition: Binding<SIMD3<Float>>
        private var trackingStatus: Binding<String>

        private let cameraAnchor = AnchorEntity(.camera)
        private let planeRoot = Entity()
        private let planeEntity: ModelEntity
        private let developerAnchor = AnchorEntity(world: .zero)
        private let planeAxesRoot = Entity()

        private var textureRenderer: CameraTextureRenderer?
        private var updateSubscription: Cancellable?
        private var lastResetToken = 0
        private var lastPinchScale: CGFloat = 1
        private var lastRotationTranslation = CGPoint.zero
        private var lastMoveTranslation = CGPoint.zero
        private var currentScale: Float = 1
        private var planeOffset = SIMD3<Float>(0, 0, -1)
        private var planeRotation = simd_quatf(angle: 0, axis: [0, 1, 0])
        private var appliedTexture: TextureResource?
        private var isDeveloperVisible = false

        private let minScale: Float = 0.3
        private let maxScale: Float = 3.0

        init(
            isCameraPaused: Binding<Bool>,
            isDeveloperModeEnabled: Binding<Bool>,
            resetToken: Binding<Int>,
            cameraPosition: Binding<SIMD3<Float>>,
            trackingStatus: Binding<String>
        ) {
            self.isCameraPaused = isCameraPaused
            self.isDeveloperModeEnabled = isDeveloperModeEnabled
            self.resetToken = resetToken
            self.cameraPosition = cameraPosition
            self.trackingStatus = trackingStatus

            var material = UnlitMaterial(color: .black)
            material.color.tint = .white
            self.planeEntity = ModelEntity(
                mesh: .generatePlane(width: 0.6, depth: 0.4),
                materials: [material]
            )
            self.lastResetToken = resetToken.wrappedValue
        }

        func install(in arView: ARView) {
            textureRenderer = CameraTextureRenderer(device: MTLCreateSystemDefaultDevice())

            arView.scene.addAnchor(cameraAnchor)
            cameraAnchor.addChild(planeRoot)
            planeRoot.addChild(planeEntity)
            planeRoot.addChild(planeAxesRoot)
            planeEntity.orientation = simd_quatf(angle: -.pi / 2, axis: [1, 0, 0])

            arView.scene.addAnchor(developerAnchor)
            buildDeveloperOverlays()
            setDeveloperVisible(false, on: arView)
            resetPlane()
            installGestures(on: arView)

            cameraSession.onFrame = { [weak self] frame in
                self?.handleFrame(frame)
            }
            cameraSession.onCameraUpdate = { [weak self] position, status in
                DispatchQueue.main.async {
                    self?.cameraPosition.wrappedValue = position
                    self?.trackingStatus.wrappedValue = status
                }
            }
        }

        func stop() {
            updateSubscription?.cancel()
            updateSubscription = nil
            textureRenderer?.flush()
        }

        func updateCommands(on arView: ARView) {
            if lastResetToken != resetToken.wrappedValue {
                lastResetToken = resetToken.wrappedValue
                resetPlane()
            }

            if isDeveloperVisible != isDeveloperModeEnabled.wrappedValue {
                setDeveloperVisible(isDeveloperModeEnabled.wrappedValue, on: arView)
            }
        }

        private func handleFrame(_ frame: ARFrame) {
            guard !isCameraPaused.wrappedValue else { return }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard !self.isCameraPaused.wrappedValue else { return }
                guard let texture = self.textureRenderer?.updateTexture(from: frame) else { return }
                if self.appliedTexture !== texture {
                    self.apply(texture: texture)
                    self.appliedTexture = texture
                }
            }
        }

        private func apply(texture: TextureResource) {
            var material = UnlitMaterial()
            material.color = .init(texture: .init(texture))
            planeEntity.model?.materials = [material]
        }

        private func resetPlane() {
            currentScale = 1
            planeOffset = [0, 0, -1]
            planeRotation = simd_quatf(angle: 0, axis: [0, 1, 0])
            applyPlaneTransform()
        }

        private func applyPlaneTransform() {
            planeRoot.position = planeOffset
            planeRoot.orientation = planeRotation
            planeRoot.scale = SIMD3<Float>(repeating: currentScale)
        }

        private func setScale(_ scale: Float) {
            currentScale = min(max(scale, minScale), maxScale)
            applyPlaneTransform()
        }

        private func rotate(deltaX: CGFloat, deltaY: CGFloat) {
            let yaw = simd_quatf(angle: Float(deltaX) * 0.006, axis: [0, 1, 0])
            let pitch = simd_quatf(angle: Float(deltaY) * 0.006, axis: [1, 0, 0])
            planeRotation = yaw * pitch * planeRotation
            applyPlaneTransform()
        }

        private func move(deltaX: CGFloat, deltaY: CGFloat) {
            planeOffset.x += Float(deltaX) * 0.0015
            planeOffset.y -= Float(deltaY) * 0.0015
            planeOffset.x = min(max(planeOffset.x, -1.25), 1.25)
            planeOffset.y = min(max(planeOffset.y, -0.9), 0.9)
            applyPlaneTransform()
        }

        private func installGestures(on arView: ARView) {
            let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
            pinch.delegate = self
            arView.addGestureRecognizer(pinch)

            let rotatePan = UIPanGestureRecognizer(target: self, action: #selector(handleRotatePan(_:)))
            rotatePan.minimumNumberOfTouches = 1
            rotatePan.maximumNumberOfTouches = 1
            rotatePan.delegate = self
            arView.addGestureRecognizer(rotatePan)

            let movePan = UIPanGestureRecognizer(target: self, action: #selector(handleMovePan(_:)))
            movePan.minimumNumberOfTouches = 2
            movePan.maximumNumberOfTouches = 2
            movePan.delegate = self
            arView.addGestureRecognizer(movePan)

            let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
            doubleTap.numberOfTapsRequired = 2
            doubleTap.delegate = self
            arView.addGestureRecognizer(doubleTap)
        }

        @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            switch gesture.state {
            case .began:
                lastPinchScale = gesture.scale
            case .changed:
                let multiplier = Float(gesture.scale / max(lastPinchScale, 0.001))
                setScale(currentScale * multiplier)
                lastPinchScale = gesture.scale
            default:
                lastPinchScale = 1
            }
        }

        @objc private func handleRotatePan(_ gesture: UIPanGestureRecognizer) {
            let translation = gesture.translation(in: gesture.view)
            switch gesture.state {
            case .began:
                lastRotationTranslation = translation
            case .changed:
                let delta = CGPoint(
                    x: translation.x - lastRotationTranslation.x,
                    y: translation.y - lastRotationTranslation.y
                )
                rotate(deltaX: delta.x, deltaY: delta.y)
                lastRotationTranslation = translation
            default:
                lastRotationTranslation = .zero
            }
        }

        @objc private func handleMovePan(_ gesture: UIPanGestureRecognizer) {
            let translation = gesture.translation(in: gesture.view)
            switch gesture.state {
            case .began:
                lastMoveTranslation = translation
            case .changed:
                let delta = CGPoint(
                    x: translation.x - lastMoveTranslation.x,
                    y: translation.y - lastMoveTranslation.y
                )
                move(deltaX: delta.x, deltaY: delta.y)
                lastMoveTranslation = translation
            default:
                lastMoveTranslation = .zero
            }
        }

        @objc private func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            resetPlane()
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }

        private func buildDeveloperOverlays() {
            developerAnchor.addChild(makeAxes(length: 0.35, thickness: 0.01))
            planeAxesRoot.addChild(makeAxes(length: 0.18, thickness: 0.006))
        }

        private func setDeveloperVisible(_ isVisible: Bool, on arView: ARView) {
            isDeveloperVisible = isVisible
            developerAnchor.isEnabled = isVisible
            planeAxesRoot.isEnabled = isVisible
            arView.debugOptions = isVisible ? [.showAnchorOrigins, .showFeaturePoints] : []
        }

        private func makeAxes(length: Float, thickness: Float) -> Entity {
            let root = Entity()
            root.addChild(makeAxis(length: length, thickness: thickness, color: .systemRed, direction: [1, 0, 0]))
            root.addChild(makeAxis(length: length, thickness: thickness, color: .systemGreen, direction: [0, 1, 0]))
            root.addChild(makeAxis(length: length, thickness: thickness, color: .systemBlue, direction: [0, 0, 1]))
            return root
        }

        private func makeAxis(length: Float, thickness: Float, color: UIColor, direction: SIMD3<Float>) -> ModelEntity {
            let entity = ModelEntity(
                mesh: .generateBox(size: [length, thickness, thickness]),
                materials: [UnlitMaterial(color: color)]
            )
            entity.position = direction * (length / 2)
            entity.orientation = simd_quatf(from: [1, 0, 0], to: direction)
            return entity
        }
    }
}
