import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: PlaneDetectionViewModel
    @State private var coordinator: ARViewContainer.Coordinator?

    var body: some View {
        ZStack {
            ARViewContainer()
                .ignoresSafeArea()
            CrosshairView()
            VStack {
                HStack(alignment: .top) {
                    StatusPanel()
                    Spacer()
                }
                Spacer()
                SettingsView(reset: { NotificationCenter.default.post(name: .resetARSession, object: nil) }, clear: { NotificationCenter.default.post(name: .clearARPlanes, object: nil) })
            }
            .padding()
        }
        .onReceive(NotificationCenter.default.publisher(for: .resetARSession)) { _ in }
        .preferredColorScheme(.dark)
    }
}

extension Notification.Name {
    static let resetARSession = Notification.Name("resetARSession")
    static let clearARPlanes = Notification.Name("clearARPlanes")
}
