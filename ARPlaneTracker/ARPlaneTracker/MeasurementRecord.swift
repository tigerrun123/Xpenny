import Foundation
import simd

struct MeasurementRecord: Codable, Identifiable, Equatable {
    let id: UUID
    let timestamp: Date
    let start: Point3D
    let end: Point3D
    let distanceMeters: Float

    init(id: UUID = UUID(), timestamp: Date = Date(), start: SIMD3<Float>, end: SIMD3<Float>) {
        self.id = id
        self.timestamp = timestamp
        self.start = Point3D(start)
        self.end = Point3D(end)
        self.distanceMeters = simd_distance(start, end)
    }
}

struct Point3D: Codable, Equatable {
    let x: Float
    let y: Float
    let z: Float

    init(_ point: SIMD3<Float>) {
        x = point.x
        y = point.y
        z = point.z
    }

    var simdValue: SIMD3<Float> {
        SIMD3<Float>(x, y, z)
    }
}

struct PlaneAreaInfo: Equatable {
    let id: UUID
    let type: String
    let widthMeters: Float
    let depthMeters: Float
    let areaSquareMeters: Float

    var formattedArea: String {
        String(format: "%.2f m²", areaSquareMeters)
    }

    var formattedDimensions: String {
        String(format: "%.2f m × %.2f m", widthMeters, depthMeters)
    }
}

enum MeasurementHistoryStore {
    static let fileName = "measurements.json"

    static var fileURL: URL {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documents.appendingPathComponent(fileName)
    }

    static func load() -> [MeasurementRecord] {
        do {
            let data = try Data(contentsOf: fileURL)
            return try JSONDecoder.measurementDecoder.decode([MeasurementRecord].self, from: data)
        } catch CocoaError.fileReadNoSuchFile {
            return []
        } catch {
            print("Failed to load measurement history: \(error)")
            return []
        }
    }

    static func save(_ measurements: [MeasurementRecord]) {
        do {
            let data = try JSONEncoder.measurementEncoder.encode(measurements)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            print("Failed to save measurement history: \(error)")
        }
    }
}

private extension JSONEncoder {
    static var measurementEncoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static var measurementDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
