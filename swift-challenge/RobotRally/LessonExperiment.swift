import SwiftUI

struct RobotPortrait: View {
    var body: some View {
        if let url = Bundle.main.url(forResource: "Rover", withExtension: "png"),
           let image = NSImage(contentsOf: url) {
            Image(nsImage: image)
                .resizable().interpolation(.high).scaledToFit()
                .padding(18)
                .rotationEffect(.degrees(-16))
                .shadow(color: RallyStyle.ink.opacity(0.24), radius: 18, x: 10, y: 16)
        }
    }
}

struct GearShape: Shape {
    var teeth = 12
    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        var path = Path()
        for point in 0..<(teeth * 4) {
            let angle = Double(point) * .pi / Double(teeth * 2)
            let r = radius * (point % 4 < 2 ? 1 : 0.83)
            let position = CGPoint(x: center.x + cos(angle) * r, y: center.y + sin(angle) * r)
            if point == 0 { path.move(to: position) } else { path.addLine(to: position) }
        }
        path.closeSubpath()
        return path
    }
}

struct LessonExperiment: View {
    let index: Int
    @State private var setting = 1.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text(index == 0 ? "KEEP THE MASS. CHANGE THE FORCE." : index == 1 ? "TURN THE MOTOR. WATCH THE OUTPUT." : "SAME BATTERY. DIFFERENT DEMAND.")
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .tracking(0.8).foregroundStyle(RallyStyle.muted)
                .fixedSize(horizontal: false, vertical: true)
            switch index {
            case 0: force
            case 1: gears
            default: battery
            }
        }
        .padding(24)
        .background(RallyStyle.paper, in: RoundedRectangle(cornerRadius: 14))
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(.custom("AvenirNext-Bold", size: 29)).monospacedDigit().foregroundStyle(RallyStyle.blue)
            Text(label).font(.system(size: 12)).foregroundStyle(RallyStyle.muted)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var force: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 15) {
                Image(systemName: "arrow.right").font(.system(size: 22 + setting * 8, weight: .bold)).foregroundStyle(RallyStyle.orange)
                RobotPortrait().frame(width: 125, height: 120)
                Text("10 kg").font(.system(size: 13, weight: .medium, design: .monospaced))
            }.frame(maxWidth: .infinity)
            HStack { metric("\(Int(setting * 10)) N", "Net force"); metric("\(Int(setting)) m/s²", "Acceleration") }
            Picker("Net force", selection: $setting) {
                Text("10 N").tag(1.0)
                Text("20 N").tag(2.0)
                Text("30 N").tag(3.0)
            }.pickerStyle(.segmented).accessibilityIdentifier("force-control")
            Text("a = F ÷ m").font(.system(size: 13, design: .monospaced)).foregroundStyle(RallyStyle.muted)
        }
    }

    private var gears: some View {
        VStack(alignment: .leading, spacing: 20) {
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { timeline in
                let angle = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 360) * 60
                HStack(spacing: -5) {
                    gear(size: 44, teeth: 12, angle: angle, color: RallyStyle.orange)
                    gear(size: 44 * setting, teeth: 12 * Int(setting), angle: -angle / setting + 15 / setting, color: RallyStyle.blue)
                }.frame(maxWidth: .infinity).frame(height: 140)
            }.accessibilityLabel("Motor gear and output gear rotate at the selected ratio")
            HStack { metric(String(format: "%.0f rpm", 120 / setting), "Output speed"); metric(String(format: "%.0f N·m", setting), "Output torque") }
            Picker("Gear reduction", selection: $setting) {
                Text("1:1").tag(1.0)
                Text("2:1").tag(2.0)
                Text("3:1").tag(3.0)
            }.pickerStyle(.segmented).accessibilityIdentifier("gear-control")
            Text("Motor: 120 rpm, 1 N·m · Ideal, no losses")
                .font(.system(size: 11, design: .monospaced)).foregroundStyle(RallyStyle.muted)
        }
    }

    private func gear(size: CGFloat, teeth: Int, angle: Double, color: Color) -> some View {
        ZStack {
            GearShape(teeth: teeth).fill(color)
            Circle().fill(RallyStyle.paper).frame(width: size * 0.38, height: size * 0.38)
            Capsule().fill(RallyStyle.paper).frame(width: 5, height: size * 0.16).offset(y: -size * 0.31)
        }.frame(width: size, height: size).rotationEffect(.degrees(angle))
    }

    private var battery: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 4) {
                ForEach(0..<6) { _ in
                    RoundedRectangle(cornerRadius: 5).fill(RallyStyle.blue).frame(height: 60)
                }
                RoundedRectangle(cornerRadius: 2).fill(RallyStyle.blue).frame(width: 7, height: 24)
            }.padding(12).overlay(RoundedRectangle(cornerRadius: 12).stroke(RallyStyle.blue, lineWidth: 2)).padding(.vertical, 12)
            HStack { metric("60 Wh", "Usable energy"); metric("\(Int(60 / setting)) min", "Ideal runtime") }
            Picker("Average power", selection: $setting) {
                Text("60 W").tag(1.0)
                Text("120 W").tag(2.0)
                Text("180 W").tag(3.0)
            }.pickerStyle(.segmented).accessibilityIdentifier("power-control")
            Text("Runtime = energy ÷ average power")
                .font(.system(size: 12, design: .monospaced)).foregroundStyle(RallyStyle.muted)
        }
    }
}
