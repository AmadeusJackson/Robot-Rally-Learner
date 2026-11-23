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
    var paper: Color { adaptive(0xEDF0F2, 0x141B23) }
    var ink: Color { adaptive(0x1A2633, 0xEDF1F5) }
    var muted: Color { adaptive(0x667078, 0xA9B5C2) }
    var orange: Color { adaptive(0xD94D1A, 0xFF9866) }
    var blue: Color { adaptive(0x2E57AB, 0x8DB6FF) }
    var surface: Color { adaptive(0xFAFBFC, 0x202B37) }
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
            RallyView().frame(minWidth: 640, minHeight: 560)
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
            .foregroundStyle(Color(red: 0.12, green: 0.15, blue: 0.18))
            .padding(.horizontal, 22).padding(.vertical, 15)
            .background(Color(red: 1, green: 0.57, blue: 0.30), in: RoundedRectangle(cornerRadius: 6))
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
                header(compact: geometry.size.width < 850)
                Rectangle().fill(style.ink.opacity(0.12)).frame(height: 1)
                if session.isDriving || session.phase == .feedback {
                    GeometryReader { gameSpace in
                        ScrollViewReader { proxy in
                        ScrollView(.vertical) {
                            game(compact: geometry.size.width < 850)
                                .frame(height: max(gameSpace.size.height, geometry.size.width < 850 ? 570 : 550))
                        }
                        .scrollBounceBehavior(.basedOnSize)
                        .onChange(of: session.focus) { _, target in
                            if session.controllerUsed { proxy.scrollTo(target, anchor: .center) }
                        }
                        }
                    }
                } else {
                ScrollViewReader { proxy in
                ScrollView {
                    Group {
                        switch session.phase {
                        case .welcome: welcome(compact: geometry.size.width < 980, narrow: geometry.size.width < 740)
                        case .results: results
                        default: lesson(compact: geometry.size.width < 980)
                        }
                    }
                    .padding(geometry.size.width < 740 ? 16 : geometry.size.width < 1000 ? 24 : 36)
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
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 12).padding(.vertical, 7).frame(maxWidth: .infinity)
                        .background(style.paper)
                }
            }
            .foregroundStyle(style.ink)
            .background(style.paper)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: session.phase)
            .onChange(of: reduceMotion, initial: true) { _, value in session.scene.reduceMotion = value }

            .sheet(isPresented: $session.showingControls, onDismiss: { session.closeControls() }) {
                ScrollViewReader { proxy in
                    ScrollView { controls }
                        .onChange(of: session.focus) { _, target in
                            if session.controllerUsed { proxy.scrollTo(target, anchor: .center) }
                        }
                    }
                    .frame(width: min(500, geometry.size.width - 40), height: min(620, geometry.size.height - 40))
                    .background(style.paper)
                    .environment(\.rallyStyle, style).environment(\.colorScheme, colorScheme)
                    .background(RallyWindowBridge(session: session, isModal: true))
                    .preferredColorScheme(session.appearance.colorScheme)
            }
            .onReceive(controllerTick) { date in controller.poll(session: session, time: date.timeIntervalSinceReferenceDate) }
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
                session.pause()
            }
        }
    }

    private func header(compact: Bool) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "gearshape.2.fill").font(.system(size: 24, weight: .medium)).foregroundStyle(style.orange)
            Text("ROBOT RALLY").font(.custom("AvenirNext-Heavy", size: 17)).tracking(1)
            Spacer()
            if session.phase == .practice {
                Text("Practice driving").font(.system(size: 13, weight: .medium)).foregroundStyle(style.muted)
                Spacer()
            } else if session.phase != .welcome && session.phase != .results {
                ForEach(0..<3) { index in
                    HStack(spacing: 6) {
                        Image(systemName: index < session.index ? "checkmark.circle.fill" : icons[index])
                        if !compact { Text(names[index]).font(.system(size: 12, weight: .semibold)) }
                    }
                    .accessibilityLabel(names[index])
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
                Text("PIT • TEST • DRIVE").font(.system(size: 11, weight: .medium, design: .monospaced)).tracking(1.5).foregroundStyle(style.muted)
            }
            if session.phase != .welcome {
                Button { session.home() } label: { Image(systemName: "house") }
                    .buttonStyle(.borderless).help("Return home").accessibilityLabel("Home")
                    .controllerFocus(.home, session: session)
            }
            Button { session.openControls() } label: { Image(systemName: "slider.horizontal.3") }
            .buttonStyle(.borderless).help("Appearance, controls, and feedback sounds")
            .accessibilityLabel("Appearance and controls")
            .controllerFocus(.settings, session: session)
        }
        .padding(.horizontal, 24).padding(.vertical, 16)
    }

    private func welcome(compact: Bool, narrow: Bool) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            let heroLayout = narrow ? AnyLayout(VStackLayout(alignment: .leading, spacing: 18)) : AnyLayout(HStackLayout(spacing: 12))
            heroLayout {
                VStack(alignment: .leading, spacing: 20) {
                    Text("ROBOTICS / FIELD LAB").font(.system(size: 11, weight: .semibold, design: .monospaced)).tracking(2).foregroundStyle(.white.opacity(0.6))
                    Text("Built in the pits.\nProven on the field.")
                        .font(.system(size: compact ? 34 : 46, weight: .heavy)).fontWidth(.condensed)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Explore the mechanics. Test your setup.\nPut your understanding behind the wheel.")
                        .font(.system(size: 15)).lineSpacing(5).foregroundStyle(.white.opacity(0.7))
                    Button { session.start() } label: {
                        HStack(spacing: 24) { Text("Start training"); Image(systemName: "arrow.right") }
                    }
                    .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("start-learning").controllerFocus(.start, session: session)
                    Button("Practice driving first →") { session.practice() }
                        .buttonStyle(.plain).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                        .accessibilityIdentifier("practice-driving").controllerFocus(.practice, session: session)
                }.frame(maxWidth: .infinity, alignment: .leading)
                RobotDisplay().frame(maxWidth: .infinity).frame(height: narrow ? 240 : compact ? 300 : 350)
            }
            .padding(compact ? 24 : 34).foregroundStyle(.white)
            .background(Color(red: 0.10, green: 0.14, blue: 0.18), in: RoundedRectangle(cornerRadius: 12))
            HStack {
                Text("TRAINING PROGRAM").font(.system(size: 11, weight: .bold, design: .monospaced)).tracking(1.5)
                Spacer()
                Text("03 BRIEFINGS  /  03 FIELD CHALLENGES").font(.system(size: 10, design: .monospaced)).foregroundStyle(style.muted)
            }
            let topicLayout = narrow ? AnyLayout(VStackLayout(alignment: .leading, spacing: 14)) : AnyLayout(HStackLayout(alignment: .top, spacing: 14))
            topicLayout {
                topic("Force & motion", number: "01", icon: icons[0], text: "Find the force that gets your robot moving.")
                topic("Gears & torque", number: "02", icon: icons[1], text: "Trade output speed for turning strength.")
                topic("Energy & runtime", number: "03", icon: icons[2], text: "Plan a run around the energy available.")
            }
            HStack {
                Label("Keyboard or Xbox controller", systemImage: "gamecontroller")
                Spacer()
                Label("Offline and ready", systemImage: "checkmark.circle.fill")
            }.font(.system(size: 12)).foregroundStyle(style.muted)
        }
    }

    private func topic(_ title: String, number: String, icon: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(number).font(.system(size: 12, weight: .semibold, design: .monospaced)).foregroundStyle(style.muted)
                Spacer()
                Image(systemName: icon).font(.system(size: 20)).foregroundStyle(style.orange)
            }
            Text(title).font(.system(size: 19, weight: .bold)).fontWidth(.condensed)
            Text(text).font(.system(size: 13)).lineSpacing(3).foregroundStyle(style.muted).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(20).pitPanel()
    }

    private func lesson(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                VStack(alignment: .leading, spacing: 9) {
                    Text("PIT BRIEFING / 0\(session.index + 1)")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced)).tracking(1.5).foregroundStyle(style.orange)
                    Text(session.challenge.topic).font(.system(size: 36, weight: .heavy)).fontWidth(.condensed)
                }
                Spacer()
                Image(systemName: icons[session.index]).font(.system(size: 34, weight: .light)).foregroundStyle(style.muted)
            }
            let layout = compact ? AnyLayout(VStackLayout(alignment: .leading, spacing: 20)) : AnyLayout(HStackLayout(alignment: .top, spacing: 24))
            layout {
                VStack(alignment: .leading, spacing: 24) {
                    Text(["OFF THE STARTING LINE", "AT THE GEARBOX", "BEFORE THE NEXT RUN"][session.index])
                        .font(.system(size: 11, weight: .bold, design: .monospaced)).tracking(1).foregroundStyle(style.muted)
                    Text(session.challenge.lesson).font(.system(size: 18)).lineSpacing(7)
                        .fixedSize(horizontal: false, vertical: true)
                    Divider()
                    Label("Adjust the bench test, then take it onto the field.", systemImage: "slider.horizontal.3")
                        .font(.system(size: 13)).foregroundStyle(style.muted)
                    Button { session.drive() } label: { Label("Take the wheel", systemImage: "arrow.right") }
                        .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                        .accessibilityIdentifier("try-challenge").controllerFocus(.start, session: session)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(26).pitPanel()
                LessonExperiment(index: session.index, setting: $session.experimentSetting)
                    .controllerFocus(.experiment, session: session).id(session.index)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func game(compact: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 28) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(session.phase == .practice ? "PRACTICE / DRIVER TRAINING" : "FIELD CHALLENGE / 0\(session.index + 1) / " + session.challenge.topic.uppercased())
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
            GeometryReader { arena in
            ZStack {
                let width = min(arena.size.width, arena.size.height * 840 / 520)
                FieldView(scene: session.scene, active: session.isDriving && !session.paused)
                    .frame(width: width, height: width * 520 / 840)
                    .accessibilityLabel("Driving arena. Choose an answer by driving or use Choose directly below.")
                if session.paused {
                    Color.black.opacity(0.65)
                    VStack(spacing: 18) {
                        Image(systemName: "pause.circle").font(.system(size: 38))
                        Text("DRIVE PAUSED").font(.system(size: 24, weight: .bold, design: .monospaced))
                        Button("Resume driving") { session.togglePause() }
                            .buttonStyle(.borderedProminent).tint(.white).foregroundStyle(Color(red: 0.10, green: 0.15, blue: 0.20))
                            .accessibilityIdentifier("resume-driving")
                        .controllerFocus(.resume, session: session)
                    }.foregroundStyle(.white)
                }
            }
            .frame(width: arena.size.width, height: arena.size.height)
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
            feedback(compact: compact).frame(height: compact ? 190 : 132).background(style.paper)
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

    @ViewBuilder
    private func feedback(compact: Bool) -> some View {
        let layout = compact ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10)) : AnyLayout(HStackLayout(alignment: .center, spacing: 22))
        layout {
            if session.phase == .practice {
                if !compact { Image(systemName: session.practiceVisits == 3 ? "checkmark.circle.fill" : "steeringwheel")
                    .font(.system(size: 28)).foregroundStyle(style.orange) }
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
                if !compact { Image(systemName: correct ? "checkmark.circle.fill" : "arrow.turn.up.right")
                    .font(.system(size: 28)).foregroundStyle(correct ? style.success : style.orange) }
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
                if !compact { Image(systemName: "steeringwheel").font(.system(size: 28)).foregroundStyle(style.orange) }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Drive to your answer").font(.system(size: 17, weight: .bold))
                    Text("Hold in a bay briefly to confirm your choice. The ring around your robot shows your progress.")
                        .font(.system(size: 14)).foregroundStyle(style.muted)
                }
                Spacer()
            }
        }
        .padding(.horizontal, 28).padding(.vertical, 18).frame(maxWidth: .infinity, minHeight: 120)
        .background(style.surface).overlay(alignment: .top) { Rectangle().fill(style.orange.opacity(0.65)).frame(height: 2) }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("DRIVER STATION").font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(1.5).foregroundStyle(style.orange)
            Text("Appearance & controls").font(.system(size: 26, weight: .bold)).fontWidth(.condensed)
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
        }.padding(28).frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(style.ink).background(style.paper)
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 28) {
            HStack {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Match review").font(.system(size: 40, weight: .heavy)).fontWidth(.condensed)
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
                    Label(session.selections[index] == Challenge.sample[index].correct ? "Correct" : "Review", systemImage: session.selections[index] == Challenge.sample[index].correct ? "checkmark.circle.fill" : "arrow.counterclockwise.circle")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(session.selections[index] == Challenge.sample[index].correct ? style.success : style.orange).fixedSize()
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                    .pitPanel()
                    .controllerFocus(.review(index), session: session)
            }
            Button { session.start() } label: { Label("Take another lap", systemImage: "arrow.counterclockwise") }
                .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                .controllerFocus(.start, session: session)
        }
    }
}

private struct PitPanel: ViewModifier {
    @Environment(\.rallyStyle) private var style
    func body(content: Content) -> some View {
        content.background(style.surface, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(style.ink.opacity(0.12), lineWidth: 1))
    }
}
extension View {
    func pitPanel() -> some View { modifier(PitPanel()) }
}

struct RobotDisplay: View {
    var body: some View {
        ZStack {
            Canvas { context, size in
                var grid = Path()
                for x in stride(from: 0.0, through: size.width, by: 24) {
                    grid.move(to: CGPoint(x: x, y: 0)); grid.addLine(to: CGPoint(x: x, y: size.height))
                }
                for y in stride(from: 0.0, through: size.height, by: 24) {
                    grid.move(to: CGPoint(x: 0, y: y)); grid.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(grid, with: .color(.white.opacity(0.055)), lineWidth: 0.5)
                let rect = CGRect(x: size.width * 0.15, y: size.height * 0.15, width: size.width * 0.7, height: size.height * 0.7)
                context.stroke(Path(ellipseIn: rect), with: .color(.white.opacity(0.15)), style: StrokeStyle(lineWidth: 1, dash: [4, 6]))
            }
            RobotPortrait().padding(12)
            VStack {
                HStack { Text("ROVER / 01"); Spacer(); Image(systemName: "plus") }
                Spacer()
                HStack { Text("MECANUM DRIVE"); Spacer(); Text("4 WHEELS") }
            }.font(.system(size: 9, weight: .medium, design: .monospaced)).tracking(1.5).foregroundStyle(.white.opacity(0.55)).padding(12)
        }.accessibilityElement(children: .ignore).accessibilityLabel("Competition rover with aluminum chassis, mecanum wheels, and orange bumpers")
    }
}
