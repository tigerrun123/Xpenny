import SwiftUI

@main
struct ARPlaneDetectionExplorerApp: App {
    @StateObject private var viewModel = PlaneDetectionViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
        }
    }
}
