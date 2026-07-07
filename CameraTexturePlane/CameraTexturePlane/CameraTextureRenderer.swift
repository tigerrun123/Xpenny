import ARKit
import CoreImage
import CoreGraphics
import Metal
import RealityKit
import UIKit

final class CameraTextureRenderer {
    private let device: MTLDevice
    private let ciContext: CIContext
    private let colorSpace = CGColorSpaceCreateDeviceRGB()
    private var textureCache: CVMetalTextureCache?
    private var textureResource: TextureResource?
    private var drawableQueue: TextureResource.DrawableQueue?
    private var lastTimestamp: TimeInterval = 0
    private let minimumFrameInterval: TimeInterval = 1.0 / 30.0

    init?(device: MTLDevice?) {
        guard let device else { return nil }
        self.device = device
        self.ciContext = CIContext(mtlDevice: device)
        CVMetalTextureCacheCreate(nil, nil, device, nil, &textureCache)
    }

    @MainActor
    func updateTexture(from frame: ARFrame) -> TextureResource? {
        guard frame.timestamp - lastTimestamp >= minimumFrameInterval else {
            return nil
        }
        lastTimestamp = frame.timestamp

        let pixelBuffer = frame.capturedImage
        _ = makeMetalTexture(from: pixelBuffer)

        let ciImage = CIImage(cvPixelBuffer: pixelBuffer).oriented(.right)
        let width = Int(ciImage.extent.width)
        let height = Int(ciImage.extent.height)
        configureDrawableTextureIfNeeded(width: width, height: height)

        do {
            guard let drawable = try drawableQueue?.nextDrawable() else {
                return textureResource
            }

            ciContext.render(
                ciImage,
                to: drawable.texture,
                commandBuffer: nil,
                bounds: ciImage.extent,
                colorSpace: colorSpace
            )
            drawable.present()
            return textureResource
        } catch {
            return textureResource
        }
    }

    func flush() {
        if let textureCache {
            CVMetalTextureCacheFlush(textureCache, 0)
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

    @MainActor
    private func configureDrawableTextureIfNeeded(width: Int, height: Int) {
        guard width > 0, height > 0 else { return }
        if let drawableQueue, drawableQueue.width == width, drawableQueue.height == height {
            return
        }

        do {
            let descriptor = TextureResource.DrawableQueue.Descriptor(
                pixelFormat: .bgra8Unorm,
                width: width,
                height: height,
                usage: [.shaderRead, .renderTarget],
                mipmapsMode: .none
            )
            let queue = try TextureResource.DrawableQueue(descriptor)
            queue.allowsNextDrawableTimeout = false

            let seedTexture = try TextureResource.generate(
                from: Self.placeholderImage(),
                withName: "LiveCameraTexture",
                options: .init(semantic: .color, mipmapsMode: .none)
            )
            seedTexture.replace(withDrawables: queue)

            drawableQueue = queue
            textureResource = seedTexture
        } catch {
            drawableQueue = nil
            textureResource = nil
        }
    }

    private static func placeholderImage() -> CGImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 2, height: 2))
        return renderer.image { context in
            UIColor.black.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        }.cgImage!
    }
}
