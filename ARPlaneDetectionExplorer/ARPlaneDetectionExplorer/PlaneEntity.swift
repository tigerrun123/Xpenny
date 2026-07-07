import ARKit
import RealityKit
import UIKit

final class PlaneEntity: Entity, HasAnchoring {
    private static let planeMaterial = UnlitMaterial(color: UIColor.systemBlue.withAlphaComponent(0.32))
    private static let borderMaterial = UnlitMaterial(color: .white)
    private static let labelMaterial = UnlitMaterial(color: .white)
    private static let axisMaterials = [
        UnlitMaterial(color: .systemRed),
        UnlitMaterial(color: .systemGreen),
        UnlitMaterial(color: .systemBlue)
    ]

    private let surface = ModelEntity()
    private let borderRoot = Entity()
    private let label = ModelEntity()
    private let anchorMarker = ModelEntity(mesh: .generateSphere(radius: 0.018), materials: [UnlitMaterial(color: .systemYellow)])
    private let axisRoot = Entity()

    private(set) var planeID: UUID

    required init() {
        fatalError("init() has not been implemented")
    }

    init(anchor: ARPlaneAnchor) {
        planeID = anchor.identifier
        super.init()
        anchoring = AnchoringComponent(anchor)
        addChild(surface)
        addChild(borderRoot)
        addChild(label)
        addChild(anchorMarker)
        addChild(axisRoot)
        configureAxis()
        update(with: anchor, showMesh: true, showLabel: true, developerMode: false)
    }

    func update(with anchor: ARPlaneAnchor, showMesh: Bool, showLabel: Bool, developerMode: Bool) {
        planeID = anchor.identifier
        let width = max(anchor.extent.x, 0.001)
        let length = max(anchor.extent.z, 0.001)
        surface.model = ModelComponent(mesh: .generatePlane(width: width, depth: length), materials: [Self.planeMaterial])
        surface.position = anchor.center
        surface.isEnabled = showMesh

        updateBorder(width: width, length: length, center: anchor.center)
        borderRoot.isEnabled = developerMode || showMesh

        label.model = ModelComponent(mesh: Self.makeLabelMesh(anchor: anchor), materials: [Self.labelMaterial])
        label.position = anchor.center + SIMD3<Float>(-width / 2, 0.08, -length / 2)
        label.scale = SIMD3<Float>(repeating: 0.0028)
        label.isEnabled = showLabel

        anchorMarker.position = anchor.center
        anchorMarker.isEnabled = developerMode
        axisRoot.position = anchor.center
        axisRoot.isEnabled = developerMode
    }

    private static func makeLabelMesh(anchor: ARPlaneAnchor) -> MeshResource {
        let width = anchor.extent.x
        let length = anchor.extent.z
        let area = width * length
        let alignment = anchor.alignment == .horizontal ? "Horizontal" : "Vertical"
        let text = "Plane \(String(anchor.identifier.uuidString.prefix(8)))\nW \(String(format: "%.2f", width))m  L \(String(format: "%.2f", length))m\nArea \(String(format: "%.2f", area))m²\n\(alignment)"
        return .generateText(text, extrusionDepth: 0.001, font: .systemFont(ofSize: 18, weight: .semibold), containerFrame: CGRect(x: 0, y: 0, width: 220, height: 92), alignment: .left, lineBreakMode: .byWordWrapping)
    }

    private func updateBorder(width: Float, length: Float, center: SIMD3<Float>) {
        borderRoot.children.removeAll()
        let thickness: Float = 0.008
        let front = ModelEntity(mesh: .generateBox(size: [width, thickness, thickness]), materials: [Self.borderMaterial])
        front.position = center + SIMD3<Float>(0, 0.002, length / 2)
        let back = ModelEntity(mesh: .generateBox(size: [width, thickness, thickness]), materials: [Self.borderMaterial])
        back.position = center + SIMD3<Float>(0, 0.002, -length / 2)
        let left = ModelEntity(mesh: .generateBox(size: [thickness, thickness, length]), materials: [Self.borderMaterial])
        left.position = center + SIMD3<Float>(-width / 2, 0.002, 0)
        let right = ModelEntity(mesh: .generateBox(size: [thickness, thickness, length]), materials: [Self.borderMaterial])
        right.position = center + SIMD3<Float>(width / 2, 0.002, 0)
        [front, back, left, right].forEach { borderRoot.addChild($0) }
    }

    private func configureAxis() {
        let length: Float = 0.25
        let thickness: Float = 0.01
        let x = ModelEntity(mesh: .generateBox(size: [length, thickness, thickness]), materials: [Self.axisMaterials[0]])
        x.position.x = length / 2
        let y = ModelEntity(mesh: .generateBox(size: [thickness, length, thickness]), materials: [Self.axisMaterials[1]])
        y.position.y = length / 2
        let z = ModelEntity(mesh: .generateBox(size: [thickness, thickness, length]), materials: [Self.axisMaterials[2]])
        z.position.z = length / 2
        [x, y, z].forEach { axisRoot.addChild($0) }
    }
}
