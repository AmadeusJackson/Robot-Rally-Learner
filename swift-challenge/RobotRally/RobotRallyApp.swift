import SwiftUI
import SpriteKit
import Combine

struct RallyStyle {
    let dark: Bool
    private func adaptive(_ light: UInt32, _ darkColor: UInt32) -> Color {
        let rgb = dark ? darkColor : light
        return Color(.sRGB, red: Double((rgb >> 16) & 255) / 255,
                     green: Double((rgb >> 8) & 255) / 255,
                     blue: Double(rgb & 255) / 255, opacity: 1)
    }
    var paper: Color { adaptive(0xF2F0E8, 0x141B23) }
    var ink: Color { adaptive(0x1A2633, 0xEDF1F5) }
    var muted: Color { adaptive(0x667078, 0xA9B5C2) }
    var orange: Color { adaptive(0xD94D1A, 0xFF9866) }
    var blue: Color { adaptive(0x2E57AB, 0x8DB6FF) }
    var surface: Color { adaptive(0xFCFBF9, 0x202B37) }
    var success: Color { adaptive(0x247359, 0x75DEB1) }
}

private struct RallyStyleKey: EnvironmentKey {
    static let defaultValue = RallyStyle(dark: false)
}
extension EnvironmentValues {
    var rallyStyle: RallyStyle {
        get { self[RallyStyleKey.self] }
        set { self[RallyStyleKey.self] = newValue }
    }
}

enum RallyAppearance: String, CaseIterable {
    case system, light, dark
    var title: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

@main
struct RobotRallyApp: App {
    var body: some Scene {
        WindowGroup("Robot Rally · Swift Edition") {
            RallyView().frame(minWidth: 820, minHeight: 660)
        }
        .defaultSize(width: 1180, height: 820)
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unifiedCompact)
    }
}

struct PrimaryButton: ButtonStyle {
    @Environment(\.rallyStyle) private var style
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(style.paper)
            .padding(.horizontal, 22).padding(.vertical, 15)
            .background(style.ink, in: RoundedRectangle(cornerRadius: 10))
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

@MainActor
struct RallyView: View {
    @State private var session: RallySession
    @Environment(\.colorScheme) private var systemScheme
    init(session: RallySession? = nil) {
        _session = State(initialValue: session ?? RallySession())
    }
    var body: some View {
        let scheme = session.appearance.colorScheme ?? systemScheme
        RallyContent(session: session)
            .environment(\.rallyStyle, RallyStyle(dark: scheme == .dark))
            .environment(\.colorScheme, scheme)
            .preferredColorScheme(session.appearance.colorScheme)
            .background(RallyWindowBridge(session: session))
    }
}

@MainActor
struct RallyContent: View {
    @Bindable var session: RallySession
    @State private var controller = RallyController()
    @Environment(\.rallyStyle) private var style
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let controllerTick = Timer.publish(every: 1.0 / 60, on: .main, in: .common).autoconnect()
    private let names = ["Force", "Gears", "Energy"]
    private let icons = ["arrow.right", "gearshape.2", "battery.75percent"]

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                header
                Rectangle().fill(style.ink.opacity(0.12)).frame(height: 1)
                if session.isDriving || session.phase == .feedback {
                    game
                } else {
                ScrollViewReader { proxy in
                ScrollView {
                    Group {
                        switch session.phase {
                        case .welcome: welcome
                        case .results: results
                        default: lesson
                        }
                    }
                    .padding(geometry.size.width < 1000 ? 24 : 36)
                    .frame(maxWidth: 1400)
                    .frame(maxWidth: .infinity)
                }
                .onChange(of: session.focus) { _, target in
                    if session.controllerUsed { proxy.scrollTo(target, anchor: .center) }
                }
                }
                }
                if session.controllerConnected {
                    Text(session.controllerHint)
                        .font(.system(size: 11, weight: .medium)).foregroundStyle(style.muted)
                        .padding(.vertical, 7).frame(maxWidth: .infinity)
                        .background(style.paper)
                }
            }
            .foregroundStyle(style.ink)
            .background(style.paper)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: session.phase)
            .onChange(of: reduceMotion, initial: true) { _, value in session.scene.reduceMotion = value }

            .sheet(isPresented: $session.showingControls, onDismiss: { session.closeControls() }) {
                controls.environment(\.rallyStyle, style).environment(\.colorScheme, colorScheme)
                    .background(RallyWindowBridge(session: session, isModal: true))
                    .preferredColorScheme(session.appearance.colorScheme)
            }
            .onReceive(controllerTick) { date in controller.poll(session: session, time: date.timeIntervalSinceReferenceDate) }
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
                session.pause()
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "steeringwheel").font(.system(size: 26, weight: .medium)).foregroundStyle(style.orange)
            Text("ROBOT RALLY").font(.custom("AvenirNext-Heavy", size: 17)).tracking(1)
            Spacer()
            if session.phase == .practice {
                Text("Practice driving").font(.system(size: 13, weight: .medium)).foregroundStyle(style.muted)
                Spacer()
            } else if session.phase != .welcome && session.phase != .results {
                ForEach(0..<3) { index in
                    HStack(spacing: 6) {
                        Image(systemName: index < session.index ? "checkmark.circle.fill" : icons[index])
                        Text(names[index]).font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(index == session.index ? style.ink : style.muted.opacity(0.65))
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(index == session.index ? style.surface : .clear, in: Capsule())
                }
                Spacer()
                Button("Restart", systemImage: "arrow.counterclockwise") { session.start() }
                    .keyboardShortcut("r", modifiers: .command).help("Restart the three lessons (⌘R)")
                    .buttonStyle(.plain).font(.system(size: 12)).foregroundStyle(style.muted)
                    .controllerFocus(.restart, session: session)
            } else {
                Text("THE ROBOTICS LAB").font(.system(size: 11, weight: .medium, design: .monospaced)).tracking(1.5).foregroundStyle(style.muted)
            }
            if session.phase != .welcome {
                Button { session.home() } label: { Image(systemName: "house") }
                    .buttonStyle(.borderless).help("Return home").accessibilityLabel("Home")
                    .controllerFocus(.home, session: session)
            }
            Button { session.openControls() } label: { Image(systemName: "keyboard") }
            .buttonStyle(.borderless).help("Appearance, controls, and feedback sounds")
            .accessibilityLabel("Appearance and controls")
            .controllerFocus(.settings, session: session)
        }
        .padding(.horizontal, 24).padding(.vertical, 16)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 32) {
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Put physics\nin the driver’s seat.")
                        .font(.custom("AvenirNext-Heavy", size: 47))
                        .lineSpacing(-4).fixedSize(horizontal: false, vertical: true)
                    Text("Meet your robot. Explore what makes it move.\nThen take what you’ve learned onto the field.")
                        .font(.system(size: 17)).lineSpacing(5).foregroundStyle(style.muted)
                    Button { session.start() } label: {
                        HStack(spacing: 20) { Text("Enter the lab"); Image(systemName: "arrow.right") }
                    }
                    .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("start-learning")
                        .controllerFocus(.start, session: session)
                    Button("Practice driving first") { session.practice() }
                        .buttonStyle(.link).foregroundStyle(style.blue)
                        .accessibilityIdentifier("practice-driving")
                        .controllerFocus(.practice, session: session)
                    Text("3 short challenges  /  About 3 minutes")
                        .font(.system(size: 11, design: .monospaced)).foregroundStyle(style.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                RobotPortrait().frame(maxWidth: .infinity).frame(height: 360)
                    .accessibilityLabel("Competition rover with mecanum wheels and orange bumpers")
            }
            Rectangle().fill(style.ink.opacity(0.15)).frame(height: 1)
            HStack(alignment: .top, spacing: 30) {
                topic("Force & motion", icon: icons[0], text: "What changes when your robot pushes harder?")
                topic("Gears & torque", icon: icons[1], text: "Trade speed for the strength to turn.")
                topic("Energy & runtime", icon: icons[2], text: "Find out how long your battery can last.")
            }
            HStack {
                Label("Keyboard or controller", systemImage: "gamecontroller")
                Spacer()
                Label("Ready to play offline", systemImage: "checkmark.circle")
            }
            .font(.system(size: 12)).foregroundStyle(style.muted)
        }
    }

    private func topic(_ title: String, icon: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon).font(.system(size: 22)).foregroundStyle(style.orange)
            Text(title).font(.custom("AvenirNext-DemiBold", size: 18))
            Text(text).font(.system(size: 14)).foregroundStyle(style.muted).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var lesson: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text(session.challenge.topic).font(.custom("AvenirNext-Bold", size: 32))
            HStack(alignment: .top, spacing: 32) {
                VStack(alignment: .leading, spacing: 22) {
                    Text(session.challenge.lesson).font(.system(size: 18)).lineSpacing(7)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Change a setting and watch what happens.")
                        .font(.system(size: 14)).foregroundStyle(style.muted)
                    Button { session.drive() } label: { Label("Take the wheel", systemImage: "arrow.right") }
                        .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                        .accessibilityIdentifier("try-challenge")
                        .controllerFocus(.start, session: session)
                }.frame(maxWidth: .infinity, alignment: .leading)
                LessonExperiment(index: session.index, setting: $session.experimentSetting)
                    .controllerFocus(.experiment, session: session).id(session.index)
                    .frame(maxWidth: .infinity).frame(minHeight: 340)
            }
            .padding(28).background(style.surface, in: RoundedRectangle(cornerRadius: 18))
        }
    }

    private var game: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 28) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(session.phase == .practice ? "PRACTICE ARENA" : session.challenge.topic.uppercased())
                        .font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(1.2)
                        .foregroundStyle(Color.white.opacity(0.55))
                    Text(session.phase == .practice ? "Get comfortable at the controls. Drive into each of the three bays." : session.challenge.question)
                        .font(.system(size: 19, weight: .medium)).lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                        .foregroundStyle(.white)
                }
                Spacer(minLength: 0)
                Button(session.paused ? "Resume" : "Pause", systemImage: session.paused ? "play.fill" : "pause.fill") { session.togglePause() }
                    .buttonStyle(.bordered).tint(.white).foregroundStyle(.white)
                    .disabled(!session.isDriving)
                    .accessibilityIdentifier("pause-driving")
            }.padding(.horizontal, 28).padding(.vertical, 18)
            ZStack {
                FieldView(scene: session.scene, active: session.isDriving && !session.paused)
                    .aspectRatio(840.0 / 520.0, contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Driving arena. Choose an answer by driving or use Choose directly below.")
                if session.paused {
                    Color.black.opacity(0.65)
                    VStack(spacing: 18) {
                        Image(systemName: "pause.circle").font(.system(size: 38))
                        Text("Paused").font(.title.bold())
                        Button("Resume driving") { session.togglePause() }
                            .buttonStyle(.borderedProminent).tint(.white).foregroundStyle(Color(red: 0.10, green: 0.15, blue: 0.20))
                            .accessibilityIdentifier("resume-driving")
                        .controllerFocus(.resume, session: session)
                    }.foregroundStyle(.white)
                }
            }
            HStack {
                Label("WASD / arrows / left stick", systemImage: "gamecontroller")
                Spacer()
                Button("Choose directly") { session.openDirect() }
                    .buttonStyle(.plain)
                    .disabled(session.phase != .driving || session.paused)
                    .popover(isPresented: $session.choosingDirectly) {
                        answerButtons.padding(16).frame(width: 320).background(style.paper)
                            .background(RallyWindowBridge(session: session, isModal: true))
                            .environment(\.colorScheme, colorScheme)
                            .onDisappear { session.closeDirect() }
                    }
                Text("·")
                Text("ESC to pause")
            }
            .foregroundStyle(.white.opacity(0.65)).font(.system(size: 12))
            .padding(.horizontal, 28).padding(.vertical, 12)
            feedback.frame(height: 132).background(style.paper)
        }
        .background(Color(red: 0.075, green: 0.11, blue: 0.17))
    }

    private var answerButtons: some View {
        VStack(spacing: 10) {
            ForEach(0..<3) { option in
                Button { session.answer(option) } label: {
                    HStack(alignment: .center, spacing: 12) {
                        Text("\(option + 1)")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .frame(width: 28, height: 28)
                            .background(style.blue.opacity(0.09), in: RoundedRectangle(cornerRadius: 6))
                        Text(session.challenge.answers[option])
                            .font(.system(size: 14, weight: .medium)).fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        if session.phase == .feedback && option == session.challenge.correct {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(style.success)
                        }
                    }.padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(style.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(style.ink.opacity(0.1), lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(session.phase != .driving || session.paused)
                .accessibilityIdentifier("answer-\(option)")
                .controllerFocus(.answer(option), session: session)
            }
        }.foregroundStyle(style.ink)
    }

    private var feedback: some View {
        HStack(alignment: .center, spacing: 22) {
            if session.phase == .practice {
                Image(systemName: session.practiceVisits == 3 ? "checkmark.circle.fill" : "steeringwheel")
                    .font(.system(size: 28)).foregroundStyle(style.orange)
                VStack(alignment: .leading, spacing: 6) {
                    Text(session.practiceVisits == 3 ? "Ready for the rally." : "\(session.practiceVisits) of 3 bays reached")
                        .font(.system(size: 17, weight: .bold))
                    Text("Use WASD, arrow keys, or your controller. Hold briefly inside each bay.")
                        .font(.system(size: 14)).foregroundStyle(style.muted)
                }
                Spacer()
                Button("Start learning") { session.start() }
                    .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("finish-practice")
                        .controllerFocus(.start, session: session)
            } else if session.phase == .feedback {
                let correct = session.selections.last == session.challenge.correct
                Image(systemName: correct ? "checkmark.circle.fill" : "arrow.turn.up.right")
                    .font(.system(size: 28)).foregroundStyle(correct ? style.success : style.orange)
                VStack(alignment: .leading, spacing: 6) {
                    Text(correct ? "You’ve got it." : "Here’s what happens.").font(.system(size: 17, weight: .bold))
                    Text(session.challenge.explanation).font(.system(size: 14)).lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Button(session.index == 2 ? "Finish rally" : "Next lesson") { session.next() }
                    .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("next-lesson")
                        .controllerFocus(.next, session: session)
            } else {
                Image(systemName: "steeringwheel").font(.system(size: 28)).foregroundStyle(style.orange)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Drive to your answer").font(.system(size: 17, weight: .bold))
                    Text("Hold in a bay briefly to confirm your choice. The ring around your robot shows your progress.")
                        .font(.system(size: 14)).foregroundStyle(style.muted)
                }
                Spacer()
            }
        }
        .padding(.horizontal, 28).padding(.vertical, 18).frame(maxWidth: .infinity, minHeight: 120)
        .background(style.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Appearance & controls").font(.title2.bold())
            Picker("Appearance", selection: $session.appearance) {
                ForEach(RallyAppearance.allCases, id: \.rawValue) { option in
                    Text(option.title).tag(option)
                }
            }.pickerStyle(.segmented).accessibilityIdentifier("appearance-control")
                .controllerFocus(.appearance, session: session)
            Divider()
            Grid(alignment: .leading, horizontalSpacing: 36, verticalSpacing: 16) {
                GridRow { Text("Drive"); Text("WASD · Arrow keys · Left stick").foregroundStyle(.secondary) }
                GridRow { Text("Navigate / select"); Text("D-pad or stick · A to select").foregroundStyle(.secondary) }
                GridRow { Text("Change setting"); Text("D-pad left / right").foregroundStyle(.secondary) }
                GridRow { Text("Back / settings"); Text("B · Y for settings").foregroundStyle(.secondary) }
                GridRow { Text("Direct answers"); Text("X while driving").foregroundStyle(.secondary) }
                GridRow { Text("Pause / resume"); Text("Escape · B or Menu").foregroundStyle(.secondary) }
                GridRow { Text("Restart lessons"); Text("⌘R").foregroundStyle(.secondary) }
            }
            Divider()
            Toggle("Play feedback sounds", isOn: $session.feedbackSound)
                .controllerFocus(.sound, session: session)
            Text("You can also select answers with Choose directly. Motion follows your Mac’s Reduce Motion setting.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            HStack { Spacer(); Button("Done") { session.closeControls() }.keyboardShortcut(.defaultAction)
                .controllerFocus(.done, session: session) }
            if session.controllerConnected {
                Text("↑↓ Move   ←→ Adjust   A Select   B Back")
                    .font(.caption).foregroundStyle(style.muted)
            }
        }.padding(28).frame(width: 500)
            .foregroundStyle(style.ink).background(style.paper)
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 28) {
            HStack {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Back in the pits.").font(.custom("AvenirNext-Heavy", size: 40))
                    Text("Three ideas to take into your next robot build.")
                        .font(.system(size: 17)).foregroundStyle(style.muted)
                }
                Spacer()
                VStack(spacing: 2) {
                    Text("\(session.correctCount) / 3").font(.custom("AvenirNext-Heavy", size: 44)).foregroundStyle(style.orange)
                    Text("CORRECT").font(.system(size: 10, weight: .medium, design: .monospaced)).tracking(2)
                }.accessibilityIdentifier("result-score")
            }
            ForEach(Challenge.sample.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 22) {
                    Image(systemName: icons[index]).font(.system(size: 25)).foregroundStyle(style.orange).frame(width: 36)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(Challenge.sample[index].topic).font(.system(size: 19, weight: .bold))
                        Text(Challenge.sample[index].explanation).font(.system(size: 15)).lineSpacing(4).foregroundStyle(style.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: session.selections[index] == Challenge.sample[index].correct ? "checkmark.circle.fill" : "arrow.counterclockwise.circle")
                        .foregroundStyle(style.blue)
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                    .background(style.surface, in: RoundedRectangle(cornerRadius: 14))
                    .controllerFocus(.review(index), session: session)
            }
            Button { session.start() } label: { Label("Take another lap", systemImage: "arrow.counterclockwise") }
                .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                .controllerFocus(.start, session: session)
        }
    }
}
