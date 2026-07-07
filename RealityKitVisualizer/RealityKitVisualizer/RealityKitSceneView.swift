import Combine
import RealityKit
import SwiftUI
import UIKit

struct RealityKitSceneView: UIViewRepresentable {
    @Binding var addCubeToken: Int
    @Binding var addSphereToken: Int
    @Binding var resetToken: Int
    @Binding var isAnimationEnabled: Bool
    @Binding var sceneStatus: String

    func makeCoordinator() -> Coordinator {
        Coordinator(
            addCubeToken: $addCubeToken,
            addSphereToken: $addSphereToken,
            resetToken: $resetToken,
            isAnimationEnabled: $isAnimationEnabled,
            sceneStatus: $sceneStatus
        )
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero, cameraMode: .nonAR, automaticallyConfigureSession: false)
        context.coordinator.installScene(in: arView)
        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.handleCommands()
    }

    static func dismantleUIView(_ uiView: ARView, coordinator: Coordinator) {
        coordinator.stop()
    }

    final class Coordinator {
        private var addCubeToken: Binding<Int>
        private var addSphereToken: Binding<Int>
        private var resetToken: Binding<Int>
        private var isAnimationEnabled: Binding<Bool>
        private var sceneStatus: Binding<String>
        private weak var arView: ARView?
        private let rootAnchor = AnchorEntity(world: .zero)
        private var updateSubscription: Cancellable?
        private var animatedCubes: [ModelEntity] = []
        private var spheres: [ModelEntity] = []
        private var dynamicEntities: [ModelEntity] = []
        private var lastAddCubeToken = 0
        private var lastAddSphereToken = 0
        private var lastResetToken = 0
        private var elapsedTime: Float = 0
        private var cubeIndex = 0
        private var sphereIndex = 0
        private let physicsMaterial = PhysicsMaterialResource.generate(friction: 0.55, restitution: 0.72)

        init(
            addCubeToken: Binding<Int>,
            addSphereToken: Binding<Int>,
            resetToken: Binding<Int>,
            isAnimationEnabled: Binding<Bool>,
            sceneStatus: Binding<String>
        ) {
            self.addCubeToken = addCubeToken
            self.addSphereToken = addSphereToken
            self.resetToken = resetToken
            self.isAnimationEnabled = isAnimationEnabled
            self.sceneStatus = sceneStatus
            self.lastAddCubeToken = addCubeToken.wrappedValue
            self.lastAddSphereToken = addSphereToken.wrappedValue
            self.lastResetToken = resetToken.wrappedValue
        }

        func installScene(in arView: ARView) {
            self.arView = arView
            arView.scene.addAnchor(rootAnchor)
            buildBaseScene()
            subscribeToUpdates(in: arView)
            sceneStatus.wrappedValue = "Pure 3D RealityKit scene"
        }

        func handleCommands() {
            if lastAddCubeToken != addCubeToken.wrappedValue {
                lastAddCubeToken = addCubeToken.wrappedValue
                addCube()
            }

            if lastAddSphereToken != addSphereToken.wrappedValue {
                lastAddSphereToken = addSphereToken.wrappedValue
                addSphere()
            }

            if lastResetToken != resetToken.wrappedValue {
                lastResetToken = resetToken.wrappedValue
                resetScene()
            }
        }

        func stop() {
            updateSubscription?.cancel()
            updateSubscription = nil
        }

        private func buildBaseScene() {
            addCamera()
            addDirectionalLight()
            addFloor()
            addCube(at: [-0.65, 0.5, 0])
            addSphere(at: [0.75, 1.65, 0])
        }

        private func resetScene() {
            dynamicEntities.forEach { $0.removeFromParent() }
            dynamicEntities.removeAll()
            animatedCubes.removeAll()
            spheres.removeAll()
            cubeIndex = 0
            sphereIndex = 0
            elapsedTime = 0
            addCube(at: [-0.65, 0.5, 0])
            addSphere(at: [0.75, 1.65, 0])
            sceneStatus.wrappedValue = "Scene reset"
        }

        private func addCamera() {
            let camera = PerspectiveCamera()
            camera.position = [0, 1.35, 4.2]
            camera.look(at: [0, 0.45, 0], from: camera.position, relativeTo: nil)
            rootAnchor.addChild(camera)
        }

        private func addDirectionalLight() {
            let light = DirectionalLight()
            light.light.intensity = 4_500
            light.light.color = .white
            light.position = [-2.0, 4.0, 3.0]
            light.look(at: [0, 0, 0], from: light.position, relativeTo: nil)
            rootAnchor.addChild(light)
        }

        private func addFloor() {
            let floor = ModelEntity(
                mesh: .generateBox(size: [7.0, 0.05, 7.0]),
                materials: [matteMaterial(color: UIColor(white: 0.18, alpha: 1.0))]
            )
            floor.name = "Matte Floor"
            floor.position = [0, -0.025, 0]
            floor.generateCollisionShapes(recursive: false)
            floor.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
                massProperties: .default,
                material: physicsMaterial,
                mode: .static
            )
            rootAnchor.addChild(floor)
        }

        private func addCube() {
            let x = -1.15 + Float(cubeIndex % 4) * 0.72
            let z = -0.45 - Float(cubeIndex / 4) * 0.48
            addCube(at: [x, 0.48, z])
            sceneStatus.wrappedValue = "Added metallic cube"
        }

        private func addCube(at position: SIMD3<Float>) {
            cubeIndex += 1
            let cube = ModelEntity(
                mesh: .generateBox(size: 0.45),
                materials: [metallicMaterial(color: UIColor.systemIndigo)]
            )
            cube.name = "Metallic Cube"
            cube.position = position
            cube.generateCollisionShapes(recursive: false)
            cube.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
                massProperties: .default,
                material: physicsMaterial,
                mode: .kinematic
            )
            rootAnchor.addChild(cube)
            animatedCubes.append(cube)
            dynamicEntities.append(cube)
        }

        private func addSphere() {
            let x = -0.85 + Float(sphereIndex % 5) * 0.42
            let z = 0.55 + Float(sphereIndex / 5) * 0.42
            addSphere(at: [x, 1.7, z])
            sceneStatus.wrappedValue = "Added glass sphere"
        }

        private func addSphere(at position: SIMD3<Float>) {
            sphereIndex += 1
            let sphere = ModelEntity(
                mesh: .generateSphere(radius: 0.22),
                materials: [glassMaterial(color: UIColor.systemCyan.withAlphaComponent(0.42))]
            )
            sphere.name = "Glass Sphere"
            sphere.position = position
            sphere.generateCollisionShapes(recursive: false)
            sphere.components[PhysicsBodyComponent.self] = PhysicsBodyComponent(
                massProperties: .default,
                material: physicsMaterial,
                mode: .dynamic
            )
            rootAnchor.addChild(sphere)
            spheres.append(sphere)
            dynamicEntities.append(sphere)
        }

        private func subscribeToUpdates(in arView: ARView) {
            updateSubscription = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] event in
                self?.update(deltaTime: Float(event.deltaTime))
            }
        }

        private func update(deltaTime: Float) {
            elapsedTime += deltaTime
            guard isAnimationEnabled.wrappedValue else { return }

            animatedCubes.forEach { cube in
                cube.transform.rotation *= simd_quatf(angle: deltaTime * 1.35, axis: [0, 1, 0])
                cube.transform.rotation *= simd_quatf(angle: deltaTime * 0.55, axis: [1, 0, 0])
            }

            spheres.forEach { sphere in
                sphere.transform.rotation *= simd_quatf(angle: deltaTime * 0.85, axis: [0, 1, 0])
            }
        }

        private func metallicMaterial(color: UIColor) -> RealityKit.Material {
            SimpleMaterial(color: color, roughness: 0.18, isMetallic: true)
        }

        private func glassMaterial(color: UIColor) -> RealityKit.Material {
            SimpleMaterial(color: color, roughness: 0.04, isMetallic: false)
        }

        private func matteMaterial(color: UIColor) -> RealityKit.Material {
            SimpleMaterial(color: color, roughness: 1.0, isMetallic: false)
        }
    }
}
