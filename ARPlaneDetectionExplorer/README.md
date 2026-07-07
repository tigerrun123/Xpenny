# ARPlaneDetectionExplorer

A native iOS 17+ SwiftUI, ARKit, and RealityKit reference project focused on one ARKit capability: **Plane Detection**.

## What it demonstrates

- Starts an `ARWorldTrackingConfiguration` session.
- Enables both horizontal and vertical plane detection.
- Visualizes each detected `ARPlaneAnchor` with a translucent blue RealityKit mesh and a white boundary.
- Updates plane meshes, borders, and labels as ARKit refines surface estimates.
- Shows a non-blocking Measure-style overlay with a crosshair, status panel, and controls.
- Includes Developer Mode for world origin axes, per-anchor positions, plane boundaries, and session statistics.

## How ARKit Plane Detection works

ARKit plane detection runs as part of world tracking. The camera feed and motion sensors are fused to estimate device pose while ARKit identifies feature points that appear to lie on real-world flat surfaces. When enough evidence supports a surface, ARKit creates an `ARPlaneAnchor`.

Each plane anchor reports:

- `alignment`: horizontal or vertical.
- `extent`: the current estimated width and length in meters.
- `center`: the center of the estimated plane relative to the anchor.
- `identifier`: a stable UUID used by this app as the Plane ID.

Plane anchors are estimates. As the user moves the phone, ARKit can grow, shrink, shift, merge, or remove anchors. This project handles `didAdd`, `didUpdate`, and `didRemove` callbacks so the visualization stays synchronized with ARKit's latest estimate.

## How RealityKit visualizes the planes

`ARViewContainer` owns the `ARView`, configures `ARSession`, and receives `ARSessionDelegate` callbacks. Every detected `ARPlaneAnchor` gets one reusable `PlaneEntity` anchored to ARKit's plane anchor.

`PlaneEntity` contains:

- A semi-transparent blue `ModelEntity` generated from the plane extent.
- Four thin white box meshes that form the border.
- A text mesh label showing Plane ID, width, length, estimated area, and alignment.
- Developer-only anchor marker and coordinate axes.

Materials are static and reused to avoid recreating them every frame. Plane entities are updated in place as ARKit refines anchors.

## Get the project onto your Mac

Use Git as the source of truth and clone the repository into a normal local folder before opening it in Xcode:

```bash
git clone <github-repository-url>
cd <repository-folder>
git checkout feature/arkit-plane-detection
open ARPlaneDetectionExplorer/ARPlaneDetectionExplorer.xcodeproj
```

The project includes a shared Xcode scheme named `ARPlaneDetectionExplorer`, so Xcode and `xcodebuild` can discover the app target from a fresh clone.

## Running and deploying from Xcode

1. Open `ARPlaneDetectionExplorer/ARPlaneDetectionExplorer.xcodeproj` in Xcode 15 or later.
2. Select the shared `ARPlaneDetectionExplorer` scheme.
3. Select an iPhone running iOS 17 or later. ARKit camera world tracking requires a physical iOS device.
4. In **Signing & Capabilities**, choose your Apple Development Team if Xcode asks for signing configuration.
5. Build and run.
6. Move the phone slowly around horizontal and vertical surfaces until translucent blue planes appear.

## Verification

From a macOS machine with Xcode installed:

```bash
xcodebuild -project ARPlaneDetectionExplorer.xcodeproj -scheme ARPlaneDetectionExplorer -destination 'generic/platform=iOS' build
```

## Controls

- **Reset Session**: resets world tracking and removes anchors.
- **Clear All Planes**: removes local visualizations while the session continues.
- **Pause Detection / Resume Detection**: toggles ARKit plane detection.
- **Toggle Plane Mesh**: shows or hides translucent plane surfaces.
- **Toggle Plane Labels**: shows or hides floating labels.
- **Developer Mode**: shows world origin, axes, anchor markers, boundaries, and AR session statistics.
