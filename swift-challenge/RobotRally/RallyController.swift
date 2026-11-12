import AppKit
import SwiftUI
import GameController

// The same semantic events drive the app and the controller regression checks.
enum RallyInput: Hashable { case up, down, left, right, select, back, settings, menu, direct }
enum RallyControl: Hashable {
    case start, practice, settings, restart, home, experiment, resume, next
    case appearance, sound, done, answer(Int), review(Int)
}

struct ControllerSnapshot {
    var buttons: Set<RallyInput> = []
    var x: CGFloat = 0
    var y: CGFloat = 0
    var isNeutral: Bool { buttons.isEmpty && abs(x) < 0.3 && abs(y) < 0.3 }
}

struct ControllerEdges {
    private var previous = Set<RallyInput>()
    private var direction: RallyInput?
    private var nextRepeat = 0.0
    private var needsNeutral = true

    var isReady: Bool { !needsNeutral }
    mutating func reset() { self = ControllerEdges() }
    mutating func events(_ snapshot: ControllerSnapshot, time: Double) -> [RallyInput] {
        // Connecting or returning to this window must not activate a held button.
        if needsNeutral {
            if snapshot.isNeutral { needsNeutral = false }
            return []
        }
        let order: [RallyInput] = [.back, .settings, .menu, .direct, .select]
        let pressed = order.filter { snapshot.buttons.contains($0) && !previous.contains($0) }
        previous = snapshot.buttons
        let next: RallyInput?
        if max(abs(snapshot.x), abs(snapshot.y)) < 0.55 { next = nil }
        else if abs(snapshot.x) > abs(snapshot.y) { next = snapshot.x > 0 ? .right : .left }
        else { next = snapshot.y > 0 ? .up : .down }
        var events = pressed
        if let next {
            if next != direction {
                events.append(next)
                nextRepeat = time + 0.4
            } else if time >= nextRepeat {
                events.append(next)
                nextRepeat = time + 0.16
            }
        }
        direction = next
        // Never confirm a selection and move focus in the same frame.
        return pressed.isEmpty ? events : Array(pressed.prefix(1))
    }
}

@MainActor
final class RallyController {
    private var edges = ControllerEdges()
    private var device: ObjectIdentifier?
    private var wasActive = false
    private var context: RallySession.InputContext?

    func poll(session: RallySession, time: Double) {
        let controller = GCController.controllers().first { $0.extendedGamepad != nil }
        let keyWindow = NSApp.keyWindow
        let active = NSApp.isActive && session.window != nil &&
            (keyWindow === session.window || keyWindow === session.modalWindow || keyWindow?.sheetParent === session.window ||
             keyWindow?.parent === session.window)
        guard let pad = controller?.extendedGamepad else {
            ingest(session: session, snapshot: nil, deviceID: nil, active: active, time: time)
            return
        }
        var snapshot = ControllerSnapshot()
        if pad.buttonA.isPressed { snapshot.buttons.insert(.select) }
        if pad.buttonB.isPressed { snapshot.buttons.insert(.back) }
        if pad.buttonY.isPressed { snapshot.buttons.insert(.settings) }
        if pad.buttonX.isPressed { snapshot.buttons.insert(.direct) }
        if pad.buttonMenu.isPressed { snapshot.buttons.insert(.menu) }
        let stickX = CGFloat(pad.leftThumbstick.xAxis.value)
        let stickY = CGFloat(pad.leftThumbstick.yAxis.value)
        let dpadX = CGFloat(pad.dpad.xAxis.value)
        let dpadY = CGFloat(pad.dpad.yAxis.value)
        snapshot.x = abs(dpadX) > 0.1 ? dpadX : stickX
        snapshot.y = abs(dpadY) > 0.1 ? dpadY : stickY
        ingest(session: session, snapshot: snapshot, deviceID: controller.map(ObjectIdentifier.init), active: active, time: time)
    }

    func ingest(session: RallySession, snapshot: ControllerSnapshot?, deviceID: ObjectIdentifier?, active: Bool, time: Double) {
        session.controllerConnected = snapshot != nil
        if deviceID != device {
            session.pause()
            device = deviceID
            edges.reset()
            session.scene.controllerMotion = .zero
        }
        guard active, let snapshot else {
            if wasActive { session.pause() }
            wasActive = false
            edges.reset()
            session.scene.controllerMotion = .zero
            return
        }
        wasActive = true
        if context != session.inputContext { edges.reset(); context = session.inputContext }
        for event in edges.events(snapshot, time: time) { session.handle(event) }
        // A held stick must not scroll a menu that just replaced the arena.
        if context != session.inputContext { edges.reset(); context = session.inputContext }
        session.scene.controllerMotion = session.scene.enabled && edges.isReady
            ? CGVector(dx: abs(snapshot.x) > 0.18 ? snapshot.x : 0,
                       dy: abs(snapshot.y) > 0.18 ? snapshot.y : 0) : .zero
    }

}

@MainActor
@Observable
final class RallySession {
    struct InputContext: Equatable {
        let phase: Phase
        let index: Int
        let paused: Bool
        let settings: Bool
        let answers: Bool
    }
    var inputContext: InputContext {
        InputContext(phase: phase, index: index, paused: paused, settings: showingControls, answers: choosingDirectly)
    }
    enum Phase { case welcome, practice, lesson, driving, feedback, results }
    var phase = Phase.welcome { didSet { resetFocus() } }
    var index = 0
    var selections: [Int] = []
    var paused = false
    var practiceVisits = 0
    var experimentSetting = 1.0
    var showingControls = false
    var choosingDirectly = false
    var controllerConnected = false
    var controllerUsed = false
    var focus = RallyControl.start
    @ObservationIgnored weak var window: NSWindow?
    @ObservationIgnored weak var modalWindow: NSWindow?
    @ObservationIgnored private let preferences: UserDefaults
    private var focusBeforeSettings = RallyControl.start
    var appearance: RallyAppearance {
        didSet { preferences.set(appearance.rawValue, forKey: "appearance") }
    }
    var feedbackSound: Bool {
        didSet {
            preferences.set(feedbackSound, forKey: "feedbackSound")
            scene.soundEnabled = feedbackSound
        }
    }
    var isDriving: Bool { phase == .driving || phase == .practice }
    let scene = RallyScene(size: CGSize(width: 840, height: 520))
    var challenge: Challenge { Challenge.sample[index] }
    var correctCount: Int { zip(Challenge.sample, selections).filter { $0.correct == $1 }.count }
    init(preferences: UserDefaults = .standard) {
        self.preferences = preferences
        appearance = RallyAppearance(rawValue: preferences.string(forKey: "appearance") ?? "") ?? .system
        feedbackSound = preferences.bool(forKey: "feedbackSound")
        scene.soundEnabled = feedbackSound
        scene.onAnswer = { [weak self] answer in self?.answer(answer) }
        scene.onPrimary = { [weak self] in self?.advance() }
        scene.onPause = { [weak self] in self?.handle(.back) }
        scene.onPracticeVisit = { [weak self] count in self?.practiceVisits = count }
    }
    var targets: [RallyControl] {
        if showingControls { return [.appearance, .sound, .done] }
        if choosingDirectly { return [.answer(0), .answer(1), .answer(2)] }
        switch phase {
        case .welcome: return [.start, .practice, .settings]
        case .lesson: return [.start, .experiment, .settings, .restart, .home]
        case .practice: return paused ? [.resume, .start, .settings, .home] : []
        case .driving: return paused ? [.resume, .settings, .restart, .home] : []
        case .feedback: return [.next, .settings, .restart, .home]
        case .results: return [.review(0), .review(1), .review(2), .start, .settings, .home]
        }
    }
    var controllerHint: String {
        if showingControls { return "↑↓ Navigate   ·   ←→ Adjust   ·   A Select   ·   B Back" }
        if isDriving && !paused && !choosingDirectly {
            return phase == .practice
                ? "Stick / D-pad Drive   ·   B / Menu Pause   ·   Y Settings   ·   X Start lessons"
                : "Stick / D-pad Drive   ·   B / Menu Pause   ·   Y Settings   ·   X Choose directly"
        }
        return "Stick / D-pad Navigate   ·   A Select   ·   B Back   ·   Y Settings"
    }
    private func resetFocus() { focus = targets.first ?? .resume }
    private func syncDriving() {
        scene.enabled = isDriving && !paused && !showingControls && !choosingDirectly
    }
    func home() {
        scene.enabled = false
        showingControls = false
        choosingDirectly = false
        paused = false
        phase = .welcome
    }
    func start() {
        scene.enabled = false
        scene.reset()
        selections = []
        index = 0
        experimentSetting = 1
        paused = false
        choosingDirectly = false
        phase = .lesson
    }
    func practice() {
        scene.enabled = false
        scene.configure(answers: ["Steer left", "Drive forward", "Steer right"], practice: true)
        scene.reset()
        practiceVisits = 0
        paused = false
        phase = .practice
        syncDriving()
    }
    func drive() {
        scene.configure(answers: challenge.answers)
        scene.reset()
        paused = false
        phase = .driving
        syncDriving()
    }
    func answer(_ choice: Int) {
        guard phase == .driving, !paused, !showingControls, challenge.answers.indices.contains(choice) else { return }
        scene.enabled = false
        choosingDirectly = false
        selections.append(choice)
        scene.showResult(selected: choice, correct: challenge.correct)
        phase = .feedback
    }
    func next() {
        guard phase == .feedback else { return }
        if index + 1 == Challenge.sample.count { phase = .results }
        else { index += 1; experimentSetting = 1; phase = .lesson }
    }
    func advance() {
        if showingControls || choosingDirectly { return }
        if paused { togglePause(); return }
        switch phase {
        case .welcome, .results, .practice: start()
        case .lesson: drive()
        case .feedback: next()
        case .driving: break
        }
    }
    func pause() {
        guard isDriving else { return }
        paused = true
        syncDriving()
        resetFocus()
    }
    func togglePause() {
        guard isDriving, !showingControls, !choosingDirectly else { return }
        paused.toggle()
        syncDriving()
        resetFocus()
    }
    func openControls() {
        guard !showingControls else { return }
        closeDirect()
        pause()
        focusBeforeSettings = focus
        showingControls = true
        syncDriving()
        resetFocus()
    }
    func closeControls() {
        showingControls = false
        focus = targets.contains(focusBeforeSettings) ? focusBeforeSettings : targets.first ?? .resume
        syncDriving()
    }
    func openDirect() {
        guard phase == .driving, !paused, !showingControls else { return }
        choosingDirectly = true
        syncDriving()
        resetFocus()
    }
    func closeDirect() {
        let wasChoosing: Bool
        if case .answer = focus { wasChoosing = true } else { wasChoosing = choosingDirectly }
        choosingDirectly = false
        syncDriving()
        if wasChoosing { resetFocus() }
    }
    func handle(_ input: RallyInput) {
        controllerUsed = true
        if showingControls {
            if input == .back || input == .settings || input == .menu { closeControls(); return }
        } else if choosingDirectly {
            if input == .back || input == .direct { closeDirect(); return }
            if input == .settings { openControls(); return }
            if input == .menu { closeDirect(); pause(); return }
        } else {
            if input == .settings { openControls(); return }
            if input == .back || input == .menu {
                if isDriving { togglePause() }
                else if input == .back { home() }
                else { openControls() }
                return
            }
            if isDriving && !paused {
                if input == .direct {
                    if phase == .practice { start() } else { openDirect() }
                }
                return
            }
        }
        let available = targets
        guard !available.isEmpty else { return }
        if !available.contains(focus) { resetFocus() }
        if input == .select { activate(); return }
        if (input == .left || input == .right) && (focus == .appearance || focus == .experiment || focus == .sound) {
            adjust(input == .right ? 1 : -1)
            return
        }
        let direction: Int
        switch input {
        case .up, .left: direction = -1
        case .down, .right: direction = 1
        default: return
        }
        let current = available.firstIndex(of: focus) ?? 0
        focus = available[(current + direction + available.count) % available.count]
    }
    private func adjust(_ delta: Int) {
        switch focus {
        case .appearance:
            let options = RallyAppearance.allCases
            let current = options.firstIndex(of: appearance) ?? 0
            appearance = options[(current + delta + options.count) % options.count]
        case .experiment:
            experimentSetting = Double((Int(experimentSetting) - 1 + delta + 3) % 3 + 1)
        case .sound: feedbackSound.toggle()
        default: break
        }
    }
    private func activate() {
        switch focus {
        case .start:
            if phase == .practice { start() } else { advance() }
        case .practice: practice()
        case .settings: openControls()
        case .restart: start()
        case .home: home()
        case .resume: togglePause()
        case .next: next()
        case .appearance, .experiment, .sound: adjust(1)
        case .done: closeControls()
        case .answer(let choice): answer(choice)
        case .review: break
        }
    }
}

private struct ControllerFocus: ViewModifier {
    let target: RallyControl
    let session: RallySession
    @Environment(\.rallyStyle) private var style
    func body(content: Content) -> some View {
        content.overlay {
            if session.controllerConnected && session.controllerUsed && session.focus == target {
                RoundedRectangle(cornerRadius: 10).stroke(style.orange, lineWidth: 3)
                    .padding(-5).allowsHitTesting(false).accessibilityHidden(true)
            }
        }.id(target)
    }
}
extension View {
    func controllerFocus(_ target: RallyControl, session: RallySession) -> some View {
        modifier(ControllerFocus(target: target, session: session))
    }
}

// Explicitly update AppKit chrome as well as SwiftUI's palette. No view is recreated,
// so changing appearance preserves the lesson, focus, and live SpriteKit scene.
struct RallyWindowBridge: NSViewRepresentable {
    let session: RallySession
    var isModal = false
    final class WindowProbe: NSView {
        var onWindow: ((NSWindow) -> Void)?
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if let window { onWindow?(window) }
        }
    }
    func makeNSView(context: Context) -> WindowProbe { WindowProbe() }
    func updateNSView(_ view: WindowProbe, context: Context) {
        let appearance = session.appearance
        let apply: (NSWindow) -> Void = { window in
            if isModal { session.modalWindow = window } else { session.window = window }
            window.appearance = appearance == .system ? nil : NSAppearance(named: appearance == .dark ? .darkAqua : .aqua)
            window.attachedSheet?.appearance = window.appearance
        }
        view.onWindow = apply
        if let window = view.window { apply(window) }
    }
}
