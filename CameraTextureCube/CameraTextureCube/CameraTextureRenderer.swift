import ARKit
import CoreImage
import Metal
import RealityKit

final class CameraTextureRenderer {
    private let device: MTLDevice
    private var textureCache: CVMetalTextureCache?
    private let ciContext: CIContext
    private var lastTexture: TextureResource?

    init?(device: MTLDevice?) {
        guard let device else { return nil }

        self.device = device
        ciContext = CIContext(mtlDevice: device)
        CVMetalTextureCacheCreate(nil, nil, device, nil, &textureCache)
    }

    func textureResource(from frame: ARFrame) -> TextureResource? {
        let pixelBuffer = frame.capturedImage
        _ = makeMetalTexture(from: pixelBuffer)

        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let orientedImage = ciImage.oriented(.right)
        guard let cgImage = ciContext.createCGImage(orientedImage, from: orientedImage.extent) else {
            return lastTexture
        }

        do {
            let texture = try TextureResource.generate(from: cgImage, options: .init(semantic: .color))
            lastTexture = texture
            return texture
        } catch {
            return lastTexture
        }
    }

    private func makeMetalTexture(from pixelBuffer: CVPixelBuffer) -> MTLTexture? {
        guard let textureCache else { return nil }

        let width = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
        let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
        var imageTexture: CVMetalTexture?

        CVMetalTextureCacheCreateTextureFromImage(
            nil,
            textureCache,
            pixelBuffer,
            nil,
            .r8Unorm,
            width,
            height,
            0,
            &imageTexture
        )

        guard let imageTexture else { return nil }
        return CVMetalTextureGetTexture(imageTexture)
    }
}
