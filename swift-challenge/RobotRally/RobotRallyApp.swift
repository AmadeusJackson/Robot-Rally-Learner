import SwiftUI
import SpriteKit

enum RallyStyle {
    static let paper = Color(red: 0.95, green: 0.94, blue: 0.91)
    static let ink = Color(red: 0.10, green: 0.15, blue: 0.20)
    static let muted = Color(red: 0.40, green: 0.44, blue: 0.47)
    static let orange = Color(red: 0.85, green: 0.30, blue: 0.10)
    static let blue = Color(red: 0.18, green: 0.34, blue: 0.67)
}

@main
struct RobotRallyApp: App {
    var body: some Scene {
        WindowGroup("Robot Rally · Swift Edition") {
            RallyView().frame(minWidth: 820, minHeight: 660).preferredColorScheme(.light)
        }
        .defaultSize(width: 1180, height: 820)
        .windowStyle(.hiddenTitleBar)
    }
}

@MainActor
@Observable
final class RallySession {
    enum Phase { case welcome, lesson, driving, feedback, results }
    var phase = Phase.welcome
    var index = 0
    var selections: [Int] = []
    var paused = false
    let scene = RallyScene(size: CGSize(width: 840, height: 520))
    var challenge: Challenge { Challenge.sample[index] }
    var correctCount: Int { zip(Challenge.sample, selections).filter { $0.correct == $1 }.count }
    init() {
        scene.onAnswer = { [weak self] answer in self?.answer(answer) }
        scene.onPrimary = { [weak self] in self?.advance() }
        scene.onPause = { [weak self] in self?.togglePause() }
    }
    func start() {
        scene.enabled = false
        scene.reset()
        selections = []
        index = 0
        paused = false
        phase = .lesson
    }
    func drive() {
        scene.configure(answers: challenge.answers)
        scene.reset()
        scene.enabled = true
        phase = .driving
    }
    func answer(_ choice: Int) {
        guard phase == .driving, !paused, challenge.answers.indices.contains(choice) else { return }
        scene.enabled = false
        selections.append(choice)
        scene.showResult(selected: choice, correct: challenge.correct)
        phase = .feedback
    }
    func next() {
        if index + 1 == Challenge.sample.count { phase = .results }
        else { index += 1; phase = .lesson }
    }
    func advance() {
        if paused { togglePause(); return }
        switch phase {
        case .welcome, .results: start()
        case .lesson: drive()
        case .feedback: next()
        case .driving: break
        }
    }
    func togglePause() {
        guard phase == .driving else { return }
        paused.toggle()
        scene.enabled = !paused
    }
}

struct PrimaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 22).padding(.vertical, 15)
            .background(RallyStyle.ink, in: RoundedRectangle(cornerRadius: 10))
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

@MainActor
struct RallyView: View {
    @State private var session: RallySession
    init(session: RallySession? = nil) {
        _session = State(initialValue: session ?? RallySession())
    }
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let names = ["Force", "Gears", "Energy"]
    private let icons = ["arrow.right", "gearshape.2", "battery.75percent"]

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                header
                Rectangle().fill(RallyStyle.ink.opacity(0.12)).frame(height: 1)
                ScrollView {
                    Group {
                        switch session.phase {
                        case .welcome: welcome
                        case .results: results
                        default: challenge(compact: geometry.size.width < 1000, fieldHeight: max(210, min(400, geometry.size.height - 470)))
                        }
                    }
                    .padding(geometry.size.width < 1000 ? 24 : 36)
                    .frame(maxWidth: 1400)
                    .frame(maxWidth: .infinity)
                }
            }
            .foregroundStyle(RallyStyle.ink)
            .background(RallyStyle.paper)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: session.phase)
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
                if session.phase == .driving && !session.paused { session.togglePause() }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "steeringwheel").font(.system(size: 26, weight: .medium)).foregroundStyle(RallyStyle.orange)
            Text("ROBOT RALLY").font(.custom("AvenirNext-Heavy", size: 17)).tracking(1)
            Spacer()
            if session.phase != .welcome && session.phase != .results {
                ForEach(0..<3) { index in
                    HStack(spacing: 6) {
                        Image(systemName: index < session.index ? "checkmark.circle.fill" : icons[index])
                        Text(names[index]).font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(index == session.index ? RallyStyle.ink : RallyStyle.muted.opacity(0.65))
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(index == session.index ? Color.white : .clear, in: Capsule())
                }
                Spacer()
                Button("Restart", systemImage: "arrow.counterclockwise") { session.start() }
                    .buttonStyle(.plain).font(.system(size: 12)).foregroundStyle(RallyStyle.muted)
            } else {
                Text("THE ROBOTICS LAB").font(.system(size: 11, weight: .medium, design: .monospaced)).tracking(1.5).foregroundStyle(RallyStyle.muted)
            }
        }
        .padding(.horizontal, 32).padding(.top, 30).padding(.bottom, 20)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 32) {
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Put physics\nin the driver’s seat.")
                        .font(.custom("AvenirNext-Heavy", size: 47))
                        .lineSpacing(-4).fixedSize(horizontal: false, vertical: true)
                    Text("Meet your robot. Explore what makes it move.\nThen take what you’ve learned onto the field.")
                        .font(.system(size: 17)).lineSpacing(5).foregroundStyle(RallyStyle.muted)
                    Button { session.start() } label: {
                        HStack(spacing: 20) { Text("Enter the lab"); Image(systemName: "arrow.right") }
                    }
                    .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("start-learning")
                    Text("3 short challenges  /  About 3 minutes")
                        .font(.system(size: 11, design: .monospaced)).foregroundStyle(RallyStyle.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                RobotPortrait().frame(maxWidth: .infinity).frame(height: 360)
                    .accessibilityLabel("Orange four-wheel robot on a marked practice field")
            }
            Rectangle().fill(RallyStyle.ink.opacity(0.15)).frame(height: 1)
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
            .font(.system(size: 12)).foregroundStyle(RallyStyle.muted)
        }
    }

    private func topic(_ title: String, icon: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon).font(.system(size: 22)).foregroundStyle(RallyStyle.orange)
            Text(title).font(.custom("AvenirNext-DemiBold", size: 18))
            Text(text).font(.system(size: 14)).foregroundStyle(RallyStyle.muted).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func challenge(compact: Bool, fieldHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .firstTextBaseline) {
                Text(session.challenge.topic).font(.custom("AvenirNext-Bold", size: 30))
                Spacer()
                Text(session.phase == .lesson ? "EXPLORE" : "ON THE FIELD")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .tracking(1.5).foregroundStyle(RallyStyle.orange)
            }
            if session.phase == .lesson {
                HStack(alignment: .top, spacing: 32) {
                    VStack(alignment: .leading, spacing: 22) {
                        Text(session.challenge.lesson).font(.system(size: 17)).lineSpacing(6)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Try the controls in the experiment, then put the idea to work.")
                            .font(.system(size: 13)).foregroundStyle(RallyStyle.muted)
                        Button { session.drive() } label: { Label("Take the wheel", systemImage: "arrow.right") }
                            .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                            .accessibilityIdentifier("try-challenge")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    LessonExperiment(index: session.index).id(session.index)
                        .frame(maxWidth: .infinity).frame(minHeight: 340)
                }
                .padding(28).background(Color.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18))
                Label("Every answer comes with an explanation. Take your time.", systemImage: "lightbulb")
                    .font(.system(size: 13)).foregroundStyle(RallyStyle.muted)
            } else {
                let layout = AnyLayout(HStackLayout(alignment: .top, spacing: 24))
                layout {
                    VStack(alignment: .leading, spacing: 20) {
                        Text(session.challenge.question).font(.system(size: 17, weight: .medium)).lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                        answerButtons
                    }.frame(width: compact ? 220 : 280, alignment: .leading)
                    VStack(spacing: 0) {
                        ZStack {
                            FieldView(scene: session.scene, active: session.phase == .driving && !session.paused)
                                .aspectRatio(840.0 / 520.0, contentMode: .fit)
                                .frame(height: fieldHeight)
                                .frame(maxWidth: .infinity)
                                .background(Color(red: 0.075, green: 0.11, blue: 0.17))
                                .accessibilityLabel("Driving field. Answer buttons also let you choose without driving.")
                            if session.paused {
                                Color.black.opacity(0.55)
                                VStack(spacing: 16) {
                                    Image(systemName: "pause.circle").font(.system(size: 35))
                                    Text("Take a breather").font(.title2.bold())
                                    Button("Resume driving") { session.togglePause() }.buttonStyle(.borderedProminent)
                                        .tint(.white).foregroundStyle(RallyStyle.ink)
                                        .accessibilityIdentifier("resume-driving")
                                }.foregroundStyle(.white)
                            }
                        }
                        HStack {
                            Label("WASD / arrows / left stick", systemImage: "gamecontroller")
                            Spacer()
                            if session.phase == .driving {
                                Button(session.paused ? "Resume" : "Pause") { session.togglePause() }
                                    .buttonStyle(.plain).accessibilityIdentifier("pause-driving")
                            }
                        }
                        .font(.system(size: 11, weight: .medium)).foregroundStyle(.white.opacity(0.7))
                        .padding(15).background(Color(red: 0.075, green: 0.11, blue: 0.17))
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .frame(maxWidth: .infinity)
                }
                feedback
            }
        }
    }

    private var answerButtons: some View {
        VStack(spacing: 10) {
            ForEach(0..<3) { option in
                Button { session.answer(option) } label: {
                    HStack(alignment: .center, spacing: 12) {
                        Text("\(option + 1)")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .frame(width: 28, height: 28)
                            .background(RallyStyle.blue.opacity(0.09), in: RoundedRectangle(cornerRadius: 6))
                        Text(session.challenge.answers[option])
                            .font(.system(size: 14, weight: .medium)).fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        if session.phase == .feedback && option == session.challenge.correct {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color(red: 0.14, green: 0.45, blue: 0.35))
                        }
                    }.padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(RallyStyle.ink.opacity(0.1), lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(session.phase != .driving || session.paused)
                .accessibilityIdentifier("answer-\(option)")
            }
        }
    }

    private var feedback: some View {
        HStack(alignment: .center, spacing: 22) {
            if session.phase == .feedback {
                let correct = session.selections.last == session.challenge.correct
                Image(systemName: correct ? "checkmark.circle.fill" : "arrow.turn.up.right")
                    .font(.system(size: 28)).foregroundStyle(correct ? Color(red: 0.14, green: 0.45, blue: 0.35) : RallyStyle.orange)
                VStack(alignment: .leading, spacing: 6) {
                    Text(correct ? "You’ve got it." : "Here’s what happens.").font(.system(size: 17, weight: .bold))
                    Text(session.challenge.explanation).font(.system(size: 14)).lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Button(session.index == 2 ? "Finish rally" : "Next lesson") { session.next() }
                    .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("next-lesson")
            } else {
                Image(systemName: "steeringwheel").font(.system(size: 28)).foregroundStyle(RallyStyle.orange)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Your call. Your robot.").font(.system(size: 17, weight: .bold))
                    Text("Drive into an answer bay and hold briefly to collect it. You can also use the answer buttons.")
                        .font(.system(size: 14)).foregroundStyle(RallyStyle.muted)
                }
                Spacer()
            }
        }
        .padding(22).frame(minHeight: 120)
        .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 14))
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 28) {
            HStack {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Back in the pits.").font(.custom("AvenirNext-Heavy", size: 40))
                    Text("Three ideas to take into your next robot build.")
                        .font(.system(size: 17)).foregroundStyle(RallyStyle.muted)
                }
                Spacer()
                VStack(spacing: 2) {
                    Text("\(session.correctCount) / 3").font(.custom("AvenirNext-Heavy", size: 44)).foregroundStyle(RallyStyle.orange)
                    Text("CORRECT").font(.system(size: 10, weight: .medium, design: .monospaced)).tracking(2)
                }.accessibilityIdentifier("result-score")
            }
            ForEach(Challenge.sample.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 22) {
                    Image(systemName: icons[index]).font(.system(size: 25)).foregroundStyle(RallyStyle.orange).frame(width: 36)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(Challenge.sample[index].topic).font(.system(size: 19, weight: .bold))
                        Text(Challenge.sample[index].explanation).font(.system(size: 15)).lineSpacing(4).foregroundStyle(RallyStyle.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: session.selections[index] == Challenge.sample[index].correct ? "checkmark.circle.fill" : "arrow.counterclockwise.circle")
                        .foregroundStyle(RallyStyle.blue)
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 14))
            }
            Button { session.start() } label: { Label("Take another lap", systemImage: "arrow.counterclockwise") }
                .buttonStyle(PrimaryButton()).keyboardShortcut(.defaultAction)
        }
    }
}
