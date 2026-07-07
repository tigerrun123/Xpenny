import ARKit
import Combine
import Metal
import RealityKit
import SwiftUI

struct RealityKitView: UIViewRepresentable {
    @Binding var zoom: Float
    @Binding var isTexturePaused: Bool
    @Binding var isAutoRotateEnabled: Bool
    @Binding var resetToken: Int
    @Binding var zoomOutToken: Int
    @Binding var zoomInToken: Int
    @Binding var trackingStatus: String

    func makeCoordinator() -> Coordinator {
        Coordinator(
            zoom: $zoom,
            isTexturePaused: $isTexturePaused,
            isAutoRotateEnabled: $isAutoRotateEnabled,
            resetToken: $resetToken,
            zoomOutToken: $zoomOutToken,
            zoomInToken: $zoomInToken,
            trackingStatus: $trackingStatus
        )
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        arView.automaticallyConfigureSession = false
        arView.session.delegate = context.coordinator
        context.coordinator.install(in: arView)
        context.coordinator.runSession(on: arView)
        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.handleCommands()
    }

    static func dismantleUIView(_ uiView: ARView, coordinator: Coordinator) {
        coordinator.stop()
        uiView.session.pause()
    }

    final class Coordinator: NSObject, ARSessionDelegate, UIGestureRecognizerDelegate {
        private var zoom: Binding<Float>
        private var isTexturePaused: Binding<Bool>
        private var isAutoRotateEnabled: Binding<Bool>
        private var resetToken: Binding<Int>
        private var zoomOutToken: Binding<Int>
        private var zoomInToken: Binding<Int>
        private var trackingStatus: Binding<String>
        private let cubeController = CubeController()
        private var textureRenderer: CameraTextureRenderer?
        private var updateSubscription: Cancellable?
        private var lastResetToken = 0
        private var lastZoomOutToken = 0
        private var lastZoomInToken = 0
        private var lastPinchScale: CGFloat = 1
        private var lastOneFingerTranslation = CGPoint.zero
        private var lastTwoFingerTranslation = CGPoint.zero

        init(
            zoom: Binding<Float>,
            isTexturePaused: Binding<Bool>,
            isAutoRotateEnabled: Binding<Bool>,
            resetToken: Binding<Int>,
            zoomOutToken: Binding<Int>,
            zoomInToken: Binding<Int>,
            trackingStatus: Binding<String>
        ) {
            self.zoom = zoom
            self.isTexturePaused = isTexturePaused
            self.isAutoRotateEnabled = isAutoRotateEnabled
            self.resetToken = resetToken
            self.zoomOutToken = zoomOutToken
            self.zoomInToken = zoomInToken
            self.trackingStatus = trackingStatus
            self.lastResetToken = resetToken.wrappedValue
            self.lastZoomOutToken = zoomOutToken.wrappedValue
            self.lastZoomInToken = zoomInToken.wrappedValue
        }

        func install(in arView: ARView) {
            textureRenderer = CameraTextureRenderer(device: MTLCreateSystemDefaultDevice())
            cubeController.install(in: arView)
            installGestures(on: arView)
            updateSubscription = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] event in
                self?.update(deltaTime: Float(event.deltaTime))
            }
        }

        func runSession(on arView: ARView) {
            let configuration = ARWorldTrackingConfiguration()
            configuration.environmentTexturing = .automatic
            arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
        }

        func stop() {
            updateSubscription?.cancel()
            updateSubscription = nil
        }

        func handleCommands() {
            if lastResetToken != resetToken.wrappedValue {
                lastResetToken = resetToken.wrappedValue
                cubeController.reset()
                zoom.wrappedValue = cubeController.zoom
            }

            if lastZoomOutToken != zoomOutToken.wrappedValue {
                lastZoomOutToken = zoomOutToken.wrappedValue
                cubeController.adjustScale(by: 0.9)
                zoom.wrappedValue = cubeController.zoom
            }

            if lastZoomInToken != zoomInToken.wrappedValue {
                lastZoomInToken = zoomInToken.wrappedValue
                cubeController.adjustScale(by: 1.1)
                zoom.wrappedValue = cubeController.zoom
            }
        }

        func session(_ session: ARSession, didUpdate frame: ARFrame) {
            trackingStatus.wrappedValue = trackingDescription(frame.camera.trackingState)
            guard !isTexturePaused.wrappedValue else { return }
            guard let texture = textureRenderer?.textureResource(from: frame) else { return }
            cubeController.apply(texture: texture)
        }

        private func update(deltaTime: Float) {
            if isAutoRotateEnabled.wrappedValue {
                cubeController.autoRotate(deltaTime: deltaTime)
            }
        }

        private func installGestures(on arView: ARView) {
            let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
            pinch.delegate = self
            arView.addGestureRecognizer(pinch)

            let oneFingerPan = UIPanGestureRecognizer(target: self, action: #selector(handleOneFingerPan(_:)))
            oneFingerPan.minimumNumberOfTouches = 1
            oneFingerPan.maximumNumberOfTouches = 1
            oneFingerPan.delegate = self
            arView.addGestureRecognizer(oneFingerPan)

            let twoFingerPan = UIPanGestureRecognizer(target: self, action: #selector(handleTwoFingerPan(_:)))
            twoFingerPan.minimumNumberOfTouches = 2
            twoFingerPan.maximumNumberOfTouches = 2
            twoFingerPan.delegate = self
            arView.addGestureRecognizer(twoFingerPan)
        }

        @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            switch gesture.state {
            case .began:
                lastPinchScale = gesture.scale
            case .changed:
                let multiplier = Float(gesture.scale / max(lastPinchScale, 0.001))
                cubeController.adjustScale(by: multiplier)
                zoom.wrappedValue = cubeController.zoom
                lastPinchScale = gesture.scale
            default:
                lastPinchScale = 1
            }
        }

        @objc private func handleOneFingerPan(_ gesture: UIPanGestureRecognizer) {
            let translation = gesture.translation(in: gesture.view)
            switch gesture.state {
            case .began:
                lastOneFingerTranslation = translation
            case .changed:
                let delta = CGPoint(
                    x: translation.x - lastOneFingerTranslation.x,
                    y: translation.y - lastOneFingerTranslation.y
                )
                cubeController.rotate(deltaX: delta.x, deltaY: delta.y)
                lastOneFingerTranslation = translation
            default:
                lastOneFingerTranslation = .zero
            }
        }

        @objc private func handleTwoFingerPan(_ gesture: UIPanGestureRecognizer) {
            let translation = gesture.translation(in: gesture.view)
            switch gesture.state {
            case .began:
                lastTwoFingerTranslation = translation
            case .changed:
                let delta = CGPoint(
                    x: translation.x - lastTwoFingerTranslation.x,
                    y: translation.y - lastTwoFingerTranslation.y
                )
                cubeController.move(deltaX: delta.x, deltaY: delta.y)
                lastTwoFingerTranslation = translation
            default:
                lastTwoFingerTranslation = .zero
            }
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }

        private func trackingDescription(_ trackingState: ARCamera.TrackingState) -> String {
            switch trackingState {
            case .normal:
                return "Tracking normal"
            case .notAvailable:
                return "Tracking unavailable"
            case .limited(let reason):
                return "Tracking limited: \(reason)"
            }
        }
    }
}
