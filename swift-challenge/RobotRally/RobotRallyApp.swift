import SwiftUI
import SpriteKit

@main
struct RobotRallyApp: App {
    var body: some Scene {
        WindowGroup("Robot Rally · Swift Edition") {
            RallyView()
                .frame(minWidth: 760, minHeight: 680)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1000, height: 830)
    }
}

@MainActor
@Observable
final class RallySession {
    enum Phase { case welcome, lesson, driving, feedback, results }
    var phase = Phase.welcome
    var index = 0
    var selections: [Int] = []
    let scene = RallyScene(size: CGSize(width: 840, height: 440))
    var challenge: Challenge { Challenge.sample[index] }
    var correctCount: Int {
        zip(Challenge.sample, selections).filter { $0.correct == $1 }.count
    }

    init() { scene.onAnswer = { [weak self] answer in self?.answer(answer) } }
    func start() {
        scene.enabled = false
        scene.reset()
        selections = []
        index = 0
        phase = .lesson
    }
    func drive() {
        scene.reset()
        scene.enabled = true
        phase = .driving
    }
    func answer(_ choice: Int) {
        guard phase == .driving, challenge.answers.indices.contains(choice) else { return }
        scene.enabled = false
        selections.append(choice)
        phase = .feedback
    }
    func next() {
        if index + 1 == Challenge.sample.count { phase = .results }
        else { index += 1; phase = .lesson }
    }
}

struct RallyView: View {
    @State private var session = RallySession()
    private let amber = Color(red: 0.96, green: 0.71, blue: 0.32)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Label("Robot Rally", systemImage: "steeringwheel")
                        .font(.title3.weight(.semibold))
                    Spacer()
                    Text("Swift Edition").foregroundStyle(.secondary)
                    if session.phase != .welcome {
                        Button("Start over") { session.start() }
                    }
                }
                Divider()
                switch session.phase {
                case .welcome: welcome
                case .results: results
                default: challenge
                }
            }
            .padding(32)
            .frame(maxWidth: 1080)
            .frame(maxWidth: .infinity)
        }
        .background(Color(red: 0.065, green: 0.09, blue: 0.105))
        .tint(amber)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 26) {
            Text("Learn it.\nDrive it.")
                .font(.system(size: 62, weight: .bold, design: .rounded))
                .fixedSize(horizontal: false, vertical: true)
            Text("Explore the physics behind a robot in three short challenges.")
                .font(.title2)
            HStack(alignment: .top, spacing: 28) {
                introduction("Read", symbol: "book", detail: "Start with a short lesson about force, gears, or battery energy.")
                introduction("Drive", symbol: "steeringwheel", detail: "Move your robot into the numbered zone that matches your answer.")
                introduction("Understand", symbol: "lightbulb", detail: "See why the answer works before moving to the next challenge.")
            }
            .padding(.vertical, 16)
            Button("Start learning") { session.start() }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
                .accessibilityIdentifier("start-learning")
            Text("About three minutes · Works offline")
                .font(.callout).foregroundStyle(.secondary)
        }
        .padding(.vertical, 28)
    }

    private func introduction(_ title: String, symbol: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: symbol).font(.title).foregroundStyle(amber)
            Text(title).font(.headline)
            Text(detail).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var challenge: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text(session.challenge.topic).font(.largeTitle.bold())
                Spacer()
                Text("\(session.index + 1) of \(Challenge.sample.count)")
                    .monospacedDigit().foregroundStyle(.secondary)
            }
            if session.phase == .lesson {
                Text(session.challenge.lesson)
                    .font(.title2).lineSpacing(7)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 30)
                Label("Apply this idea to a robot in the next challenge.", systemImage: "arrow.turn.down.right")
                    .foregroundStyle(.secondary)
                Button("Try the challenge") { session.drive() }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .keyboardShortcut(.defaultAction)
                    .accessibilityIdentifier("try-challenge")
            } else {
                Text(session.challenge.question)
                    .font(.title3.weight(.medium))
                    .fixedSize(horizontal: false, vertical: true)
                HStack(alignment: .top, spacing: 14) {
                    ForEach(0..<3) { option in
                        Button { session.answer(option) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("\(option + 1)").font(.title2.bold()).foregroundStyle(amber)
                                Text(session.challenge.answers[option])
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, minHeight: 62, alignment: .topLeading)
                            .padding(10)
                        }
                        .buttonStyle(.plain)
                        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 10))
                        .disabled(session.phase != .driving)
                        .accessibilityIdentifier("answer-\(option)")
                    }
                }
                FieldView(scene: session.scene, active: session.phase == .driving)
                    .aspectRatio(840 / 440, contentMode: .fit)
                    .frame(maxHeight: 350)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .accessibilityLabel("Robot driving field. Use the answer buttons above as an alternative to driving.")
                if session.phase == .feedback {
                    Text(session.selections.last == session.challenge.correct ? "Correct" : "Let’s look at why")
                        .font(.headline).foregroundStyle(amber)
                    Text(session.challenge.explanation)
                        .fixedSize(horizontal: false, vertical: true)
                    Button(session.index == 2 ? "See your results" : "Next lesson") { session.next() }
                        .buttonStyle(.borderedProminent)
                        .keyboardShortcut(.defaultAction)
                        .accessibilityIdentifier("next-lesson")
                } else {
                    Text("Drive with WASD, arrow keys, or a controller. You can also select an answer above.")
                        .font(.callout).foregroundStyle(.secondary)
                }
            }
        }
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Rally complete").font(.largeTitle.bold())
            Text("\(session.correctCount) of 3 correct")
                .font(.title2).foregroundStyle(amber)
                .accessibilityIdentifier("result-score")
            Text("Here are the ideas you put into practice.").foregroundStyle(.secondary)
            ForEach(Challenge.sample.indices, id: \.self) { index in
                VStack(alignment: .leading, spacing: 8) {
                    Label(Challenge.sample[index].topic,
                          systemImage: session.selections[index] == Challenge.sample[index].correct ? "checkmark.circle" : "arrow.counterclockwise.circle")
                        .font(.headline)
                    Text(Challenge.sample[index].explanation)
                        .foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                Divider()
            }
            Button("Drive again") { session.start() }
                .buttonStyle(.borderedProminent).controlSize(.large)
                .keyboardShortcut(.defaultAction)
        }
    }
}
