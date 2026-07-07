import ARKit
import RealityKit
import SwiftUI

struct ARViewContainer: UIViewRepresentable {
    @Binding var cameraPosition: SIMD3<Float>
    @Binding var trackingStatus: String
    @Binding var activeFeature: ARDemoFeature
    @Binding var isMeasureModeEnabled: Bool
    @Binding var isDebugModeEnabled: Bool
    @Binding var currentPlaneAreaInfo: PlaneAreaInfo?
    @Binding var measurementStatus: String
    @Binding var measurements: [MeasurementRecord]
    @Binding var isFivePointAreaModeEnabled: Bool
    @Binding var fivePointAreaStatus: String
    @Binding var fivePointAreaResult: Float?
    @Binding var fivePointAreaResetToken: Int
    @Binding var planeCount: Int
    @Binding var raycastStatus: String
    @Binding var raycastDistance: Float?
    @Binding var lidarStatus: String
    @Binding var meshAnchorCount: Int
    @Binding var placedAnchorCount: Int
    @Binding var clearToken: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(
            cameraPosition: $cameraPosition,
            trackingStatus: $trackingStatus,
            activeFeature: $activeFeature,
            isMeasureModeEnabled: $isMeasureModeEnabled,
            isDebugModeEnabled: $isDebugModeEnabled,
            currentPlaneAreaInfo: $currentPlaneAreaInfo,
            measurementStatus: $measurementStatus,
            measurements: $measurements,
            isFivePointAreaModeEnabled: $isFivePointAreaModeEnabled,
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
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        arView.automaticallyConfigureSession = false
        arView.session.delegate = context.coordinator
        context.coordinator.arView = arView
        context.coordinator.installTapGesture(on: arView)

        arView.debugOptions = []

        runSession(on: arView)
        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.setActiveFeature(activeFeature)
        context.coordinator.setMeasureMode(isMeasureModeEnabled)
        context.coordinator.setFivePointAreaMode(isFivePointAreaModeEnabled)
        context.coordinator.setDebugMode(isDebugModeEnabled)
        context.coordinator.handleFivePointAreaResetIfNeeded(fivePointAreaResetToken)
        context.coordinator.handleClearIfNeeded(clearToken)
    }

    static func dismantleUIView(_ uiView: ARView, coordinator: Coordinator) {
        uiView.session.pause()
    }

    private func runSession(on arView: ARView) {
        guard ARWorldTrackingConfiguration.isSupported else {
            trackingStatus = "World tracking is not supported on this device."
            return
        }

        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }

        arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    final class Coordinator: NSObject, ARSessionDelegate {
        weak var arView: ARView?

        private var cameraPosition: Binding<SIMD3<Float>>
        private var trackingStatus: Binding<String>
        private var activeFeature: Binding<ARDemoFeature>
        private var isMeasureModeEnabled: Binding<Bool>
        private var isDebugModeEnabled: Binding<Bool>
        private var currentPlaneAreaInfo: Binding<PlaneAreaInfo?>
        private var measurementStatus: Binding<String>
        private var measurements: Binding<[MeasurementRecord]>
        private var isFivePointAreaModeEnabled: Binding<Bool>
        private var fivePointAreaStatus: Binding<String>
        private var fivePointAreaResult: Binding<Float?>
        private var fivePointAreaResetToken: Binding<Int>
        private var planeCount: Binding<Int>
        private var raycastStatus: Binding<String>
        private var raycastDistance: Binding<Float?>
        private var lidarStatus: Binding<String>
        private var meshAnchorCount: Binding<Int>
        private var placedAnchorCount: Binding<Int>
        private var clearToken: Binding<Int>
        private var planeAnchorsByID: [UUID: AnchorEntity] = [:]
        private var planeModelsByID: [UUID: ModelEntity] = [:]
        private var planeAreaInfoByID: [UUID: PlaneAreaInfo] = [:]
        private var meshAnchorsByID: [UUID: AnchorEntity] = [:]
        private var meshModelsByID: [UUID: ModelEntity] = [:]
        private var raycastMarkerEntities: [AnchorEntity] = []
        private var placedAnchorEntities: [AnchorEntity] = []
        private var pendingStartPoint: SIMD3<Float>?
        private var pendingStartEntity: AnchorEntity?
        private var measurementEntities: [AnchorEntity] = []
        private var distanceLabelEntities: [ModelEntity] = []
        private var fivePointAreaPoints: [SIMD3<Float>] = []
        private var fivePointAreaDraftEntities: [AnchorEntity] = []
        private var fivePointAreaResultEntity: AnchorEntity?
        private var fivePointAreaLabelEntity: ModelEntity?
        private var fivePointAreaPlaneAnchorID: UUID?
        private var lastFivePointAreaResetToken = 0
        private var lastClearToken = 0
        private var isMeasureModeActive = false
        private var isFivePointAreaModeActive = false
        private var isDebugModeActive = false
        private var currentFeature: ARDemoFeature = .worldTracking

        private struct PlaneRaycastHit {
            let worldPosition: SIMD3<Float>
            let planeAnchorID: UUID
        }

        init(
            cameraPosition: Binding<SIMD3<Float>>,
            trackingStatus: Binding<String>,
            activeFeature: Binding<ARDemoFeature>,
            isMeasureModeEnabled: Binding<Bool>,
            isDebugModeEnabled: Binding<Bool>,
            currentPlaneAreaInfo: Binding<PlaneAreaInfo?>,
            measurementStatus: Binding<String>,
            measurements: Binding<[MeasurementRecord]>,
            isFivePointAreaModeEnabled: Binding<Bool>,
            fivePointAreaStatus: Binding<String>,
            fivePointAreaResult: Binding<Float?>,
            fivePointAreaResetToken: Binding<Int>,
            planeCount: Binding<Int>,
            raycastStatus: Binding<String>,
            raycastDistance: Binding<Float?>,
            lidarStatus: Binding<String>,
            meshAnchorCount: Binding<Int>,
            placedAnchorCount: Binding<Int>,
            clearToken: Binding<Int>
        ) {
            self.cameraPosition = cameraPosition
            self.trackingStatus = trackingStatus
            self.activeFeature = activeFeature
            self.isMeasureModeEnabled = isMeasureModeEnabled
            self.isDebugModeEnabled = isDebugModeEnabled
            self.currentPlaneAreaInfo = currentPlaneAreaInfo
            self.measurementStatus = measurementStatus
            self.measurements = measurements
            self.isFivePointAreaModeEnabled = isFivePointAreaModeEnabled
            self.fivePointAreaStatus = fivePointAreaStatus
            self.fivePointAreaResult = fivePointAreaResult
            self.fivePointAreaResetToken = fivePointAreaResetToken
            self.planeCount = planeCount
            self.raycastStatus = raycastStatus
            self.raycastDistance = raycastDistance
            self.lidarStatus = lidarStatus
            self.meshAnchorCount = meshAnchorCount
            self.placedAnchorCount = placedAnchorCount
            self.clearToken = clearToken
            self.lastFivePointAreaResetToken = fivePointAreaResetToken.wrappedValue
            self.lastClearToken = clearToken.wrappedValue
            self.currentFeature = activeFeature.wrappedValue
        }

        func installTapGesture(on arView: ARView) {
            let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
            arView.addGestureRecognizer(tapGesture)
        }

        func setMeasureMode(_ isEnabled: Bool) {
            guard isMeasureModeActive != isEnabled else { return }

            isMeasureModeActive = isEnabled
            pendingStartPoint = nil
            removePendingStartEntity()
            measurementStatus.wrappedValue = isEnabled
                ? "Tap a detected plane to set the first point."
                : "Measure mode off"
        }

        func setActiveFeature(_ feature: ARDemoFeature) {
            guard currentFeature != feature else {
                updateOverlayVisibility()
                return
            }

            currentFeature = feature
            activeFeature.wrappedValue = feature
            updateOverlayVisibility()

            if feature == .raycast {
                raycastStatus.wrappedValue = "Tap a detected surface."
            }

            if feature == .sceneReconstruction {
                lidarStatus.wrappedValue = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
                    ? "LiDAR mesh active."
                    : "LiDAR mesh not supported on this device."
            }
        }

        func setFivePointAreaMode(_ isEnabled: Bool) {
            guard isFivePointAreaModeActive != isEnabled else { return }

            isFivePointAreaModeActive = isEnabled
            if isEnabled {
                clearFivePointAreaMeasurement()
                fivePointAreaStatus.wrappedValue = "Area Mode: tap 5 points on one detected plane."
            } else if fivePointAreaResult.wrappedValue == nil {
                clearFivePointAreaMeasurement()
                fivePointAreaStatus.wrappedValue = "Area Mode off"
            }
        }

        func handleFivePointAreaResetIfNeeded(_ resetToken: Int) {
            guard lastFivePointAreaResetToken != resetToken else { return }

            lastFivePointAreaResetToken = resetToken
            clearFivePointAreaMeasurement()
            fivePointAreaStatus.wrappedValue = isFivePointAreaModeActive
                ? "Area Mode: tap 5 points on one detected plane."
                : "Area Mode off"
        }

        func setDebugMode(_ isEnabled: Bool) {
            guard isDebugModeActive != isEnabled else { return }

            isDebugModeActive = isEnabled
            isDebugModeEnabled.wrappedValue = isEnabled
            arView?.debugOptions = isEnabled
                ? [.showFeaturePoints, .showAnchorOrigins]
                : []
            updateOverlayVisibility()
        }

        func handleClearIfNeeded(_ token: Int) {
            guard lastClearToken != token else { return }

            lastClearToken = token
            clearRaycastMarkers()
            clearPlacedAnchors()
            clearMeasurementEntities()
            clearFivePointAreaMeasurement()
            raycastStatus.wrappedValue = "Tap a detected surface."
            raycastDistance.wrappedValue = nil
            measurementStatus.wrappedValue = "Measure mode off"
        }

        private func updateOverlayVisibility() {
            let showPlanes = isDebugModeActive || currentFeature == .planeDetection
            planeModelsByID.values.forEach { $0.isEnabled = showPlanes }

            let showMeshes = isDebugModeActive || currentFeature == .sceneReconstruction
            meshModelsByID.values.forEach { $0.isEnabled = showMeshes }
        }

        func session(_ session: ARSession, didUpdate frame: ARFrame) {
            let transform = frame.camera.transform
            let position = SIMD3<Float>(
                transform.columns.3.x,
                transform.columns.3.y,
                transform.columns.3.z
            )
            let status = description(for: frame.camera.trackingState)

            DispatchQueue.main.async {
                self.cameraPosition.wrappedValue = position
                self.trackingStatus.wrappedValue = status
            }

            updateDistanceLabels(cameraTransform: transform)
        }

        func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
            anchors.compactMap { $0 as? ARPlaneAnchor }.forEach(addPlane)
            anchors.compactMap { $0 as? ARMeshAnchor }.forEach(addMesh)
        }

        func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
            anchors.compactMap { $0 as? ARPlaneAnchor }.forEach(updatePlane)
            anchors.compactMap { $0 as? ARMeshAnchor }.forEach(updateMesh)
        }

        func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
            anchors.forEach { anchor in
                if let anchorEntity = planeAnchorsByID.removeValue(forKey: anchor.identifier) {
                    arView?.scene.removeAnchor(anchorEntity)
                    planeModelsByID.removeValue(forKey: anchor.identifier)
                    planeAreaInfoByID.removeValue(forKey: anchor.identifier)
                    publishLargestPlaneArea()
                    planeCount.wrappedValue = planeAnchorsByID.count
                }

                if let anchorEntity = meshAnchorsByID.removeValue(forKey: anchor.identifier) {
                    arView?.scene.removeAnchor(anchorEntity)
                    meshModelsByID.removeValue(forKey: anchor.identifier)
                    meshAnchorCount.wrappedValue = meshAnchorsByID.count
                }
            }
        }

        @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let arView else { return }
            guard isFivePointAreaModeEnabled.wrappedValue
                || isMeasureModeEnabled.wrappedValue
                || currentFeature == .raycast
                || currentFeature == .anchors
            else { return }

            let tapLocation = gesture.location(in: arView)
            guard let hit = raycastPlaneHit(from: tapLocation, in: arView) else {
                if isFivePointAreaModeEnabled.wrappedValue {
                    fivePointAreaStatus.wrappedValue = "No detected plane at tap. Aim at a tracked flat surface."
                } else if currentFeature == .raycast {
                    raycastStatus.wrappedValue = "No raycast hit. Aim at a detected plane."
                } else if currentFeature == .anchors {
                    raycastStatus.wrappedValue = "No anchor point found. Aim at a detected plane."
                } else {
                    measurementStatus.wrappedValue = "No detected plane at tap. Try a flat, well-lit surface."
                }
                return
            }

            if currentFeature == .raycast {
                addRaycastMarker(at: hit.worldPosition)
                return
            }

            if currentFeature == .anchors {
                placeVisualAnchor(at: hit.worldPosition)
                return
            }

            if isFivePointAreaModeEnabled.wrappedValue {
                addFivePointAreaPoint(hit)
                return
            }

            if let startPoint = pendingStartPoint {
                finishMeasurement(from: startPoint, to: hit.worldPosition)
            } else {
                startMeasurement(at: hit.worldPosition)
            }
        }

        private func raycastPlaneHit(from point: CGPoint, in arView: ARView) -> PlaneRaycastHit? {
            guard let result = arView.raycast(
                from: point,
                allowing: .existingPlaneGeometry,
                alignment: .any
            ).first else {
                return nil
            }

            guard let planeAnchor = result.anchor as? ARPlaneAnchor else {
                return nil
            }

            let transform = result.worldTransform
            let worldPosition = SIMD3<Float>(
                transform.columns.3.x,
                transform.columns.3.y,
                transform.columns.3.z
            )

            return PlaneRaycastHit(
                worldPosition: worldPosition,
                planeAnchorID: planeAnchor.identifier
            )
        }

        private func startMeasurement(at point: SIMD3<Float>) {
            pendingStartPoint = point
            pendingStartEntity = addMarker(at: point, color: .systemYellow)
            measurementStatus.wrappedValue = "First point set. Tap a second point on a detected plane."
        }

        private func finishMeasurement(from startPoint: SIMD3<Float>, to endPoint: SIMD3<Float>) {
            guard let arView else { return }

            removePendingStartEntity()
            pendingStartPoint = nil

            let measurement = MeasurementRecord(start: startPoint, end: endPoint)
            var updatedMeasurements = measurements.wrappedValue
            updatedMeasurements.append(measurement)
            measurements.wrappedValue = updatedMeasurements
            MeasurementHistoryStore.save(updatedMeasurements)

            let anchorEntity = AnchorEntity(world: .zero)
            anchorEntity.addChild(makeMarker(at: startPoint, color: .systemYellow))
            anchorEntity.addChild(makeMarker(at: endPoint, color: .systemOrange))
            anchorEntity.addChild(makeLine(from: startPoint, to: endPoint))

            let label = makeDistanceLabel(for: measurement)
            anchorEntity.addChild(label)
            distanceLabelEntities.append(label)

            arView.scene.addAnchor(anchorEntity)
            measurementEntities.append(anchorEntity)
            measurementStatus.wrappedValue = String(format: "Saved %.3f m to %@.", measurement.distanceMeters, MeasurementHistoryStore.fileName)
        }

        private func addMarker(at point: SIMD3<Float>, color: UIColor) -> AnchorEntity? {
            guard let arView else { return nil }

            let anchorEntity = AnchorEntity(world: .zero)
            anchorEntity.addChild(makeMarker(at: point, color: color))
            arView.scene.addAnchor(anchorEntity)
            return anchorEntity
        }

        private func addRaycastMarker(at point: SIMD3<Float>) {
            guard let arView else { return }

            let anchorEntity = AnchorEntity(world: .zero)
            anchorEntity.addChild(makeMarker(at: point, color: .systemCyan))
            arView.scene.addAnchor(anchorEntity)
            raycastMarkerEntities.append(anchorEntity)

            let distance = simd_distance(cameraPosition.wrappedValue, point)
            raycastDistance.wrappedValue = distance
            raycastStatus.wrappedValue = String(format: "Hit %.2f m away.", distance)
        }

        private func placeVisualAnchor(at point: SIMD3<Float>) {
            guard let arView else { return }

            let anchorEntity = AnchorEntity(world: point)
            let material = SimpleMaterial(color: .systemPurple, roughness: 0.25, isMetallic: false)
            let marker = ModelEntity(
                mesh: .generateBox(size: [0.045, 0.045, 0.045]),
                materials: [material]
            )
            anchorEntity.addChild(marker)
            arView.scene.addAnchor(anchorEntity)
            placedAnchorEntities.append(anchorEntity)
            placedAnchorCount.wrappedValue = placedAnchorEntities.count
        }

        private func placeCenterVisualAnchor() {
            guard let arView else { return }

            let centerPoint = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
            guard let hit = raycastPlaneHit(from: centerPoint, in: arView) else {
                raycastStatus.wrappedValue = "No center plane hit for anchor."
                return
            }

            placeVisualAnchor(at: hit.worldPosition)
        }

        private func removePendingStartEntity() {
            guard let pendingStartEntity else { return }

            arView?.scene.removeAnchor(pendingStartEntity)
            self.pendingStartEntity = nil
        }

        private func clearRaycastMarkers() {
            raycastMarkerEntities.forEach { arView?.scene.removeAnchor($0) }
            raycastMarkerEntities.removeAll()
        }

        private func clearPlacedAnchors() {
            placedAnchorEntities.forEach { arView?.scene.removeAnchor($0) }
            placedAnchorEntities.removeAll()
            placedAnchorCount.wrappedValue = 0
        }

        private func clearMeasurementEntities() {
            removePendingStartEntity()
            pendingStartPoint = nil
            measurementEntities.forEach { arView?.scene.removeAnchor($0) }
            measurementEntities.removeAll()
            distanceLabelEntities.removeAll { label in
                fivePointAreaLabelEntity.map { label !== $0 } ?? true
            }
        }

        private func makeMarker(at point: SIMD3<Float>, color: UIColor) -> ModelEntity {
            let material = SimpleMaterial(color: color, roughness: 0.35, isMetallic: false)
            let entity = ModelEntity(
                mesh: .generateSphere(radius: 0.018),
                materials: [material]
            )
            entity.position = point
            return entity
        }

        private func makeLine(from start: SIMD3<Float>, to end: SIMD3<Float>) -> ModelEntity {
            let delta = end - start
            let length = simd_length(delta)
            let midpoint = (start + end) / 2
            let material = SimpleMaterial(color: .systemOrange, roughness: 0.2, isMetallic: false)
            let entity = ModelEntity(
                mesh: .generateBox(size: [max(length, 0.001), 0.006, 0.006]),
                materials: [material]
            )

            entity.position = midpoint
            if length > 0 {
                entity.orientation = simd_quatf(from: [1, 0, 0], to: simd_normalize(delta))
            }

            return entity
        }

        private func makeLine(from start: SIMD3<Float>, to end: SIMD3<Float>, color: UIColor, thickness: Float) -> ModelEntity {
            let delta = end - start
            let length = simd_length(delta)
            let midpoint = (start + end) / 2
            let material = SimpleMaterial(color: color, roughness: 0.2, isMetallic: false)
            let entity = ModelEntity(
                mesh: .generateBox(size: [max(length, 0.001), thickness, thickness]),
                materials: [material]
            )

            entity.position = midpoint
            if length > 0 {
                entity.orientation = simd_quatf(from: [1, 0, 0], to: simd_normalize(delta))
            }

            return entity
        }

        private func makeDistanceLabel(for measurement: MeasurementRecord) -> ModelEntity {
            let midpoint = (measurement.start.simdValue + measurement.end.simdValue) / 2
            let labelText = String(format: "%.3f m", measurement.distanceMeters)
            let mesh = MeshResource.generateText(
                labelText,
                extrusionDepth: 0.002,
                font: .systemFont(ofSize: 0.12, weight: .semibold),
                containerFrame: .zero,
                alignment: .center,
                lineBreakMode: .byWordWrapping
            )
            let material = SimpleMaterial(color: .white, roughness: 0.2, isMetallic: false)
            let entity = ModelEntity(mesh: mesh, materials: [material])
            entity.position = midpoint + SIMD3<Float>(0, 0.04, 0)
            entity.scale = SIMD3<Float>(repeating: 0.2)
            return entity
        }

        private func updateDistanceLabels(cameraTransform: simd_float4x4) {
            guard !distanceLabelEntities.isEmpty else { return }

            let cameraPosition = SIMD3<Float>(
                cameraTransform.columns.3.x,
                cameraTransform.columns.3.y,
                cameraTransform.columns.3.z
            )

            distanceLabelEntities.forEach { label in
                label.look(at: cameraPosition, from: label.position, relativeTo: nil)
            }
        }

        private func addFivePointAreaPoint(_ hit: PlaneRaycastHit) {
            guard fivePointAreaPoints.count < 5 else { return }

            if fivePointAreaPoints.isEmpty, fivePointAreaResultEntity != nil {
                clearFivePointAreaMeasurement()
            }

            if let fivePointAreaPlaneAnchorID, fivePointAreaPlaneAnchorID != hit.planeAnchorID {
                fivePointAreaStatus.wrappedValue = "Stay on the same detected plane for all 5 points."
                return
            }

            if fivePointAreaPoints.isEmpty {
                fivePointAreaPlaneAnchorID = hit.planeAnchorID
            }

            let point = hit.worldPosition
            let previousPoint = fivePointAreaPoints.last
            fivePointAreaPoints.append(point)

            let anchorEntity = AnchorEntity(world: .zero)
            anchorEntity.addChild(makeMarker(at: point, color: .systemYellow))
            if let previousPoint {
                anchorEntity.addChild(makeLine(from: previousPoint, to: point, color: .systemYellow, thickness: 0.008))
            }

            arView?.scene.addAnchor(anchorEntity)
            fivePointAreaDraftEntities.append(anchorEntity)

            if fivePointAreaPoints.count == 5 {
                finishFivePointAreaMeasurement()
            } else {
                fivePointAreaResult.wrappedValue = nil
                fivePointAreaStatus.wrappedValue = "Area Mode: point \(fivePointAreaPoints.count) of 5 set."
            }
        }

        private func finishFivePointAreaMeasurement() {
            guard let arView, fivePointAreaPoints.count == 5 else { return }

            let area = polygonArea(for: fivePointAreaPoints)
            fivePointAreaResult.wrappedValue = area
            fivePointAreaStatus.wrappedValue = String(format: "Area: %.2f m²", area)

            let anchorEntity = AnchorEntity(world: .zero)
            for index in fivePointAreaPoints.indices {
                let point = fivePointAreaPoints[index]
                let nextPoint = fivePointAreaPoints[(index + 1) % fivePointAreaPoints.count]
                anchorEntity.addChild(makeMarker(at: point, color: .systemYellow))
                anchorEntity.addChild(makeLine(from: point, to: nextPoint, color: .systemYellow, thickness: 0.01))
            }

            let label = makeAreaLabel(area: area, points: fivePointAreaPoints)
            anchorEntity.addChild(label)
            distanceLabelEntities.append(label)

            fivePointAreaDraftEntities.forEach { arView.scene.removeAnchor($0) }
            fivePointAreaDraftEntities.removeAll()

            if let fivePointAreaResultEntity {
                arView.scene.removeAnchor(fivePointAreaResultEntity)
            }

            arView.scene.addAnchor(anchorEntity)
            fivePointAreaResultEntity = anchorEntity
            fivePointAreaLabelEntity = label
            fivePointAreaPoints.removeAll()
            fivePointAreaPlaneAnchorID = nil
        }

        private func clearFivePointAreaMeasurement() {
            guard let arView else {
                fivePointAreaPoints.removeAll()
                fivePointAreaDraftEntities.removeAll()
                fivePointAreaResultEntity = nil
                fivePointAreaLabelEntity = nil
                fivePointAreaPlaneAnchorID = nil
                fivePointAreaResult.wrappedValue = nil
                return
            }

            fivePointAreaDraftEntities.forEach { arView.scene.removeAnchor($0) }
            fivePointAreaDraftEntities.removeAll()

            if let fivePointAreaResultEntity {
                arView.scene.removeAnchor(fivePointAreaResultEntity)
                self.fivePointAreaResultEntity = nil
            }

            if let fivePointAreaLabelEntity {
                distanceLabelEntities.removeAll { $0 === fivePointAreaLabelEntity }
                self.fivePointAreaLabelEntity = nil
            }

            fivePointAreaPoints.removeAll()
            fivePointAreaPlaneAnchorID = nil
            fivePointAreaResult.wrappedValue = nil
        }

        private func polygonArea(for points: [SIMD3<Float>]) -> Float {
            guard points.count >= 3 else { return 0 }

            guard let normal = polygonNormal(for: points) else { return 0 }

            var crossSum = SIMD3<Float>(repeating: 0)
            for index in points.indices {
                crossSum += simd_cross(points[index], points[(index + 1) % points.count])
            }

            return 0.5 * abs(simd_dot(crossSum, normal))
        }

        private func polygonNormal(for points: [SIMD3<Float>]) -> SIMD3<Float>? {
            let origin = points[0]

            for firstIndex in 1..<(points.count - 1) {
                for secondIndex in (firstIndex + 1)..<points.count {
                    let normal = simd_cross(points[firstIndex] - origin, points[secondIndex] - origin)
                    let length = simd_length(normal)

                    if length > 0.0001 {
                        return normal / length
                    }
                }
            }

            return nil
        }

        private func makeAreaLabel(area: Float, points: [SIMD3<Float>]) -> ModelEntity {
            let centroid = points.reduce(SIMD3<Float>(repeating: 0), +) / Float(points.count)
            let labelText = String(format: "%.2f m²", area)
            let mesh = MeshResource.generateText(
                labelText,
                extrusionDepth: 0.002,
                font: .systemFont(ofSize: 0.13, weight: .bold),
                containerFrame: .zero,
                alignment: .center,
                lineBreakMode: .byWordWrapping
            )
            let material = SimpleMaterial(color: .white, roughness: 0.2, isMetallic: false)
            let entity = ModelEntity(mesh: mesh, materials: [material])
            entity.position = centroid + SIMD3<Float>(0, 0.05, 0)
            entity.scale = SIMD3<Float>(repeating: 0.22)
            return entity
        }

        private func addPlane(_ planeAnchor: ARPlaneAnchor) {
            guard let arView else { return }

            let anchorEntity = AnchorEntity(anchor: planeAnchor)
            let modelEntity = makePlaneModel(for: planeAnchor)
            modelEntity.isEnabled = isDebugModeActive
            anchorEntity.addChild(modelEntity)

            planeAnchorsByID[planeAnchor.identifier] = anchorEntity
            planeModelsByID[planeAnchor.identifier] = modelEntity
            planeAreaInfoByID[planeAnchor.identifier] = areaInfo(for: planeAnchor)
            publishLargestPlaneArea()
            planeCount.wrappedValue = planeAnchorsByID.count
            arView.scene.addAnchor(anchorEntity)
        }

        private func updatePlane(_ planeAnchor: ARPlaneAnchor) {
            guard let modelEntity = planeModelsByID[planeAnchor.identifier] else {
                addPlane(planeAnchor)
                return
            }

            modelEntity.position = planeCenter(for: planeAnchor)
            modelEntity.orientation = planeOrientation(for: planeAnchor)
            modelEntity.model?.mesh = planeMesh(for: planeAnchor)
            modelEntity.model?.materials = [planeMaterial(for: planeAnchor)]
            modelEntity.isEnabled = isDebugModeActive
            planeAreaInfoByID[planeAnchor.identifier] = areaInfo(for: planeAnchor)
            publishLargestPlaneArea()
            planeCount.wrappedValue = planeAnchorsByID.count
            updateOverlayVisibility()
        }

        private func addMesh(_ meshAnchor: ARMeshAnchor) {
            guard let arView else { return }
            guard let modelEntity = makeMeshModel(for: meshAnchor) else { return }

            modelEntity.isEnabled = isDebugModeActive || currentFeature == .sceneReconstruction
            let anchorEntity = AnchorEntity(anchor: meshAnchor)
            anchorEntity.addChild(modelEntity)

            meshAnchorsByID[meshAnchor.identifier] = anchorEntity
            meshModelsByID[meshAnchor.identifier] = modelEntity
            meshAnchorCount.wrappedValue = meshAnchorsByID.count
            arView.scene.addAnchor(anchorEntity)
        }

        private func updateMesh(_ meshAnchor: ARMeshAnchor) {
            guard let modelEntity = meshModelsByID[meshAnchor.identifier] else {
                addMesh(meshAnchor)
                return
            }

            modelEntity.model?.mesh = meshResource(for: meshAnchor)
            modelEntity.model?.materials = [meshMaterial()]
            modelEntity.isEnabled = isDebugModeActive || currentFeature == .sceneReconstruction
            meshAnchorCount.wrappedValue = meshAnchorsByID.count
        }

        private func makePlaneModel(for planeAnchor: ARPlaneAnchor) -> ModelEntity {
            let entity = ModelEntity(
                mesh: planeMesh(for: planeAnchor),
                materials: [planeMaterial(for: planeAnchor)]
            )
            entity.position = planeCenter(for: planeAnchor)
            entity.orientation = planeOrientation(for: planeAnchor)
            return entity
        }

        private func makeMeshModel(for meshAnchor: ARMeshAnchor) -> ModelEntity? {
            let mesh = meshResource(for: meshAnchor)
            return ModelEntity(mesh: mesh, materials: [meshMaterial()])
        }

        private func meshResource(for meshAnchor: ARMeshAnchor) -> MeshResource {
            let geometry = meshAnchor.geometry
            var vertices: [SIMD3<Float>] = []
            vertices.reserveCapacity(geometry.vertices.count)

            for index in 0..<geometry.vertices.count {
                vertices.append(vertex(at: index, in: geometry.vertices))
            }

            var indices: [UInt32] = []
            indices.reserveCapacity(geometry.faces.count * 3)

            for faceIndex in 0..<geometry.faces.count {
                for vertexIndex in 0..<3 {
                    indices.append(faceVertexIndex(faceIndex: faceIndex, vertexIndex: vertexIndex, in: geometry.faces))
                }
            }

            var descriptor = MeshDescriptor(name: "Scene Reconstruction Mesh")
            descriptor.positions = MeshBuffers.Positions(vertices)
            descriptor.primitives = .triangles(indices)

            do {
                return try MeshResource.generate(from: [descriptor])
            } catch {
                return .generateBox(size: 0.001)
            }
        }

        private func vertex(at index: Int, in source: ARGeometrySource) -> SIMD3<Float> {
            let stride = source.stride
            let offset = source.offset + index * stride
            let pointer = source.buffer.contents().advanced(by: offset)
            return pointer.assumingMemoryBound(to: SIMD3<Float>.self).pointee
        }

        private func faceVertexIndex(faceIndex: Int, vertexIndex: Int, in faces: ARGeometryElement) -> UInt32 {
            let indexOffset = (faceIndex * 3 + vertexIndex) * faces.bytesPerIndex
            let pointer = faces.buffer.contents().advanced(by: indexOffset)

            if faces.bytesPerIndex == MemoryLayout<UInt16>.size {
                return UInt32(pointer.assumingMemoryBound(to: UInt16.self).pointee)
            }

            return pointer.assumingMemoryBound(to: UInt32.self).pointee
        }

        private func planeMesh(for planeAnchor: ARPlaneAnchor) -> MeshResource {
            MeshResource.generatePlane(
                width: max(planeAnchor.planeExtent.width, 0.02),
                depth: max(planeAnchor.planeExtent.height, 0.02)
            )
        }

        private func planeCenter(for planeAnchor: ARPlaneAnchor) -> SIMD3<Float> {
            SIMD3<Float>(
                planeAnchor.center.x,
                planeAnchor.center.y,
                planeAnchor.center.z
            )
        }

        private func planeOrientation(for planeAnchor: ARPlaneAnchor) -> simd_quatf {
            simd_quatf(angle: planeAnchor.planeExtent.rotationOnYAxis, axis: [0, 1, 0])
        }

        private func areaInfo(for planeAnchor: ARPlaneAnchor) -> PlaneAreaInfo {
            let width = abs(planeAnchor.extent.x)
            let depth = abs(planeAnchor.extent.z)
            let type = planeAnchor.alignment == .horizontal ? "Horizontal" : "Vertical"

            return PlaneAreaInfo(
                id: planeAnchor.identifier,
                type: type,
                widthMeters: width,
                depthMeters: depth,
                areaSquareMeters: width * depth
            )
        }

        private func publishLargestPlaneArea() {
            let largestPlane = planeAreaInfoByID.values.max {
                $0.areaSquareMeters < $1.areaSquareMeters
            }

            DispatchQueue.main.async {
                self.currentPlaneAreaInfo.wrappedValue = largestPlane
            }
        }

        private func planeMaterial(for planeAnchor: ARPlaneAnchor) -> RealityKit.Material {
            let color: UIColor = planeAnchor.alignment == .horizontal
                ? UIColor.systemGreen.withAlphaComponent(0.32)
                : UIColor.systemBlue.withAlphaComponent(0.32)

            var material = UnlitMaterial(color: color)
            material.blending = .transparent(opacity: 0.32)
            return material
        }

        private func meshMaterial() -> RealityKit.Material {
            var material = UnlitMaterial(color: UIColor.systemTeal.withAlphaComponent(0.22))
            material.blending = .transparent(opacity: 0.22)
            return material
        }

        private func description(for trackingState: ARCamera.TrackingState) -> String {
            switch trackingState {
            case .normal:
                return "Tracking normal. Move slowly to discover more planes."
            case .notAvailable:
                return "Tracking unavailable."
            case .limited(let reason):
                return "Tracking limited: \(description(for: reason))."
            }
        }

        private func description(for reason: ARCamera.TrackingState.Reason) -> String {
            switch reason {
            case .excessiveMotion:
                return "excessive motion"
            case .insufficientFeatures:
                return "insufficient surface detail"
            case .initializing:
                return "initializing"
            case .relocalizing:
                return "relocalizing"
            @unknown default:
                return "unknown reason"
            }
        }
    }
}
