import AppKit
import SwiftUI

@main
struct ControllerChecks {
    @MainActor static func main() throws {
        _ = NSApplication.shared
        let suite = "org.robotrally.checks.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let session = RallySession(preferences: defaults)
        let input = RallyController()
        let device = NSObject()
        let deviceID = ObjectIdentifier(device)
        var clock = 0.0
        func send(_ snapshot: ControllerSnapshot = .init(), active: Bool = true, connected: Bool = true) {
            clock += 0.02
            input.ingest(session: session, snapshot: connected ? snapshot : nil,
                         deviceID: connected ? deviceID : nil, active: active, time: clock)
        }
        func press(_ button: RallyInput) {
            send()
            send(.init(buttons: [button]))
            send()
        }
        func direction(_ x: CGFloat, _ y: CGFloat) {
            send(); send(.init(x: x, y: y)); send()
        }
        // Held A on connection must not skip the welcome or lesson screen.
        send(.init(buttons: [.select]))
        precondition(session.phase == .welcome)
        send()
        send(.init(buttons: [.select]))
        for _ in 0..<60 { send(.init(buttons: [.select])) }
        precondition(session.phase == .lesson && !session.scene.enabled)
        send()
        direction(0, -1)
        precondition(session.focus == .experiment)
        direction(1, 0)
        precondition(session.experimentSetting == 2)
        press(.settings)
        precondition(session.showingControls && session.focus == .appearance)
        direction(1, 0)
        precondition(session.appearance == .light)
        direction(1, 0)
        precondition(session.appearance == .dark)
        precondition(session.experimentSetting == 2 && session.phase == .lesson)
        direction(0, -1)
        press(.select)
        precondition(session.feedbackSound && session.scene.soundEnabled)
        let reloaded = RallySession(preferences: defaults)
        precondition(reloaded.appearance == .dark && reloaded.feedbackSound)
        press(.back)
        precondition(!session.showingControls && session.focus == .experiment)
        direction(0, 1)
        press(.select)
        precondition(session.phase == .driving && session.scene.enabled)
        send(.init(x: 0.8))
        precondition(session.scene.controllerMotion.dx == 0.8)
        press(.settings)
        precondition(session.paused && !session.scene.enabled && session.showingControls)
        press(.select) // Cycle appearance, never advance the underlying game.
        precondition(session.selections.isEmpty && session.appearance == .system)
        press(.menu) // Dismiss settings, remain paused.
        precondition(session.paused && !session.showingControls)
        press(.select)
        precondition(!session.paused && session.scene.enabled)
        press(.direct)
        precondition(session.choosingDirectly && !session.scene.enabled)
        direction(0, -1)
        precondition(session.focus == .answer(1))
        press(.select)
        precondition(session.phase == .feedback && session.selections == [1])
        precondition(!session.choosingDirectly && !session.scene.enabled)
        press(.select)
        precondition(session.phase == .lesson && session.index == 1)
        press(.select)
        press(.direct)
        press(.back)
        precondition(!session.choosingDirectly && session.scene.enabled)
        send(.init(x: 1))
        send(connected: false)
        precondition(session.paused && !session.scene.enabled && session.scene.controllerMotion == .zero)
        // Reconnect with a held button; require release before resuming.
        send(.init(buttons: [.select]))
        precondition(session.paused)
        press(.select)
        precondition(!session.paused)
        send(.init(x: 1), active: false)
        precondition(session.paused && session.scene.controllerMotion == .zero)
        send(.init(buttons: [.select]))
        precondition(session.paused)
        press(.select)
        press(.direct)
        direction(0, -1)
        press(.select)
        press(.select)
        precondition(session.phase == .lesson && session.index == 2)
        press(.select)
        press(.direct)
        direction(0, -1); direction(0, -1)
        press(.select)
        press(.select)
        precondition(session.phase == .results && session.correctCount == 2)
        precondition(session.focus == .review(0))
        direction(0, -1); direction(0, -1); direction(0, -1)
        precondition(session.focus == .start)
        press(.select)
        precondition(session.phase == .lesson && session.selections.isEmpty)
        press(.back)
        precondition(session.phase == .welcome)
        direction(0, -1)
        press(.select)
        precondition(session.phase == .practice)
        press(.menu)
        precondition(session.paused)
        direction(0, -1)
        press(.select)
        precondition(session.phase == .lesson && !session.paused)
        // Holding a steering direction across an answer cannot navigate feedback.
        session.drive()
        send()
        send(.init(y: 1))
        session.answer(1)
        for _ in 0..<60 { send(.init(y: 1)) }
        precondition(session.focus == .next && session.phase == .feedback)
        send()
        press(.select)
        // Theme regression: mutate the preference on the SAME hosting view.
        // This catches a switcher that changes its label without repainting content.
        session.appearance = .light
        session.experimentSetting = 2
        let host = NSHostingView(rootView: RallyView(session: session).frame(width: 820, height: 660))
        host.frame = CGRect(x: 0, y: 0, width: 820, height: 660)
        func pixel() -> NSColor {
            RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.1))
            host.layoutSubtreeIfNeeded()
            let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
            host.cacheDisplay(in: host.bounds, to: bitmap)
            return bitmap.colorAt(x: 5, y: 150)!.usingColorSpace(.sRGB)!
        }
        let light = pixel()
        session.appearance = .dark
        let dark = pixel()
        session.appearance = .light
        let lightAgain = pixel()
        precondition(light.redComponent > 0.8 && dark.redComponent < 0.2 && lightAgain.redComponent > 0.8)
        precondition(session.phase == .lesson && session.experimentSetting == 2)
        // Direction repeats are deliberate, while buttons remain edge-triggered.
        var edges = ControllerEdges()
        _ = edges.events(.init(), time: 0)
        precondition(edges.events(.init(y: -1), time: 0.1) == [.down])
        precondition(edges.events(.init(y: -1), time: 0.2).isEmpty)
        precondition(edges.events(.init(y: -1), time: 0.51) == [.down])
        precondition(edges.events(.init(x: 0.12), time: 0.7).isEmpty)
        print("PASS: controller-only lessons, practice, settings, answers, results, restart, focus, disconnect, held inputs, saved preferences, and live light/dark/light repaint")
    }
}
