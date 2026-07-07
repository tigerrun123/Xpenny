# ARPlaneTracker

A native SwiftUI iOS app for iPhone 15 Pro Max on iOS 17.3.1.

The app uses ARKit and RealityKit to:

- start an `ARWorldTrackingConfiguration` session
- detect horizontal and vertical planes
- render detected planes as translucent RealityKit geometry
- show the current AR camera position on screen
- measure distances by tapping two points on detected planes
- save measurement history as JSON in the app Documents directory

## Run

1. Open `ARPlaneTracker.xcodeproj` in Xcode.
2. Select your iPhone 15 Pro Max as the run destination.
3. Set a development team in the target signing settings if Xcode asks.
4. Build and run on device.

ARKit requires a real device camera, so this app will not run meaningfully in the iOS Simulator.

## Measure mode

Turn on **Measure Mode**, then tap two locations on a visible detected plane. The app places markers, draws a line between the two points, shows the distance in meters, and appends the measurement to `measurements.json`.
