import RealityKit
import UIKit

final class CubeController {
    private let cameraAnchor = AnchorEntity(.camera)
    private let cubeRoot = Entity()
    private var faceEntities: [ModelEntity] = []
    private var edgeEntities: [ModelEntity] = []
    private var currentScale: Float = 1.0
    private var offset = SIMD3<Float>(0, 0, -1)
    private var rotation = simd_quatf(angle: 0, axis: [0, 1, 0])
    private let minScale: Float = 0.3
    private let maxScale: Float = 3.0

    var zoom: Float { currentScale }

    func install(in arView: ARView) {
        arView.scene.addAnchor(cameraAnchor)
        cameraAnchor.addChild(cubeRoot)
        buildCube()
        reset()
    }

    func reset() {
        currentScale = 1.0
        offset = [0, 0, -1]
        rotation = simd_quatf(angle: 0, axis: [0, 1, 0])
        applyTransform()
    }

    func setScale(_ scale: Float) {
        currentScale = min(max(scale, minScale), maxScale)
        applyTransform()
    }

    func adjustScale(by multiplier: Float) {
        setScale(currentScale * multiplier)
    }

    func rotate(deltaX: CGFloat, deltaY: CGFloat) {
        let yaw = simd_quatf(angle: Float(deltaX) * 0.008, axis: [0, 1, 0])
        let pitch = simd_quatf(angle: Float(deltaY) * 0.008, axis: [1, 0, 0])
        rotation = yaw * pitch * rotation
        applyTransform()
    }

    func move(deltaX: CGFloat, deltaY: CGFloat) {
        offset.x += Float(deltaX) * 0.0015
        offset.y -= Float(deltaY) * 0.0015
        offset.x = min(max(offset.x, -1.2), 1.2)
        offset.y = min(max(offset.y, -0.8), 0.8)
        applyTransform()
    }

    func autoRotate(deltaTime: Float) {
        let spin = simd_quatf(angle: deltaTime * 0.85, axis: [0, 1, 0])
        rotation = spin * rotation
        applyTransform()
    }

    func apply(texture: TextureResource) {
        var material = UnlitMaterial()
        material.color = .init(texture: .init(texture))
        faceEntities.forEach { $0.model?.materials = [material] }
    }

    private func applyTransform() {
        cubeRoot.position = offset
        cubeRoot.orientation = rotation
        cubeRoot.scale = SIMD3<Float>(repeating: currentScale)
    }

    private func buildCube() {
        faceEntities.forEach { $0.removeFromParent() }
        edgeEntities.forEach { $0.removeFromParent() }
        faceEntities.removeAll()
        edgeEntities.removeAll()

        let faceMaterial = fallbackMaterial()
        addFace(name: "Front", position: [0, 0, 0.25], orientation: simd_quatf(angle: 0, axis: [0, 1, 0]), material: faceMaterial)
        addFace(name: "Back", position: [0, 0, -0.25], orientation: simd_quatf(angle: .pi, axis: [0, 1, 0]), material: faceMaterial)
        addFace(name: "Right", position: [0.25, 0, 0], orientation: simd_quatf(angle: .pi / 2, axis: [0, 1, 0]), material: faceMaterial)
        addFace(name: "Left", position: [-0.25, 0, 0], orientation: simd_quatf(angle: -.pi / 2, axis: [0, 1, 0]), material: faceMaterial)
        addFace(name: "Top", position: [0, 0.25, 0], orientation: simd_quatf(angle: -.pi / 2, axis: [1, 0, 0]), material: faceMaterial)
        addFace(name: "Bottom", position: [0, -0.25, 0], orientation: simd_quatf(angle: .pi / 2, axis: [1, 0, 0]), material: faceMaterial)
        addEdges()
    }

    private func addFace(name: String, position: SIMD3<Float>, orientation: simd_quatf, material: RealityKit.Material) {
        let face = ModelEntity(mesh: .generatePlane(width: 0.5, depth: 0.5), materials: [material])
        face.name = name
        face.position = position
        face.orientation = orientation
        cubeRoot.addChild(face)
        faceEntities.append(face)
    }

    private func addEdges() {
        let material = UnlitMaterial(color: .black)
        let positions: [(SIMD3<Float>, SIMD3<Float>)] = [
            ([-0.25, -0.25, 0.25], [0.25, -0.25, 0.25]),
            ([-0.25, 0.25, 0.25], [0.25, 0.25, 0.25]),
            ([-0.25, -0.25, -0.25], [0.25, -0.25, -0.25]),
            ([-0.25, 0.25, -0.25], [0.25, 0.25, -0.25]),
            ([-0.25, -0.25, 0.25], [-0.25, 0.25, 0.25]),
            ([0.25, -0.25, 0.25], [0.25, 0.25, 0.25]),
            ([-0.25, -0.25, -0.25], [-0.25, 0.25, -0.25]),
            ([0.25, -0.25, -0.25], [0.25, 0.25, -0.25]),
            ([-0.25, -0.25, 0.25], [-0.25, -0.25, -0.25]),
            ([0.25, -0.25, 0.25], [0.25, -0.25, -0.25]),
            ([-0.25, 0.25, 0.25], [-0.25, 0.25, -0.25]),
            ([0.25, 0.25, 0.25], [0.25, 0.25, -0.25])
        ]

        positions.forEach { start, end in
            let edge = makeLine(from: start, to: end, material: material)
            cubeRoot.addChild(edge)
            edgeEntities.append(edge)
        }
    }

    private func makeLine(from start: SIMD3<Float>, to end: SIMD3<Float>, material: RealityKit.Material) -> ModelEntity {
        let delta = end - start
        let length = simd_length(delta)
        let line = ModelEntity(
            mesh: .generateBox(size: [max(length, 0.001), 0.012, 0.012]),
            materials: [material]
        )
        line.position = (start + end) / 2
        if length > 0 {
            line.orientation = simd_quatf(from: [1, 0, 0], to: simd_normalize(delta))
        }
        return line
    }

    private func fallbackMaterial() -> RealityKit.Material {
        UnlitMaterial(color: UIColor.systemBlue.withAlphaComponent(0.82))
    }
}
