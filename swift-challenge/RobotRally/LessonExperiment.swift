import SwiftUI

struct RobotPortrait: View {
    var body: some View {
        Canvas { context, size in
            let scale = min(size.width / 400, size.height / 360)
            context.translateBy(x: size.width / 2, y: size.height / 2)
            context.scaleBy(x: scale, y: scale)
            let orbit = Path(ellipseIn: CGRect(x: -145, y: -145, width: 290, height: 290))
            context.stroke(orbit, with: .color(RallyStyle.ink.opacity(0.12)), style: StrokeStyle(lineWidth: 1, dash: [4, 8]))
            context.stroke(Path(ellipseIn: CGRect(x: -180, y: -180, width: 360, height: 360)), with: .color(RallyStyle.ink.opacity(0.06)), lineWidth: 1)
            context.rotate(by: .degrees(-22))
            func panel(_ rect: CGRect, _ color: Color, radius: CGFloat = 10) {
                context.fill(Path(roundedRect: rect, cornerRadius: radius), with: .color(color))
            }
            panel(CGRect(x: -68, y: -85, width: 151, height: 196), RallyStyle.ink.opacity(0.08), radius: 30)
            for x in [-86, 55] {
                for y in [-70, 30] {
                    panel(CGRect(x: x, y: y, width: 31, height: 58), RallyStyle.ink, radius: 8)
                    for line in 0..<5 {
                        panel(CGRect(x: x + 4, y: y + 6 + line * 10, width: 23, height: 3), .white.opacity(0.20), radius: 1)
                    }
                }
            }
            panel(CGRect(x: -64, y: -99, width: 128, height: 198), Color(red: 0.98, green: 0.48, blue: 0.24), radius: 26)
            panel(CGRect(x: -48, y: -8, width: 96, height: 80), Color(red: 0.80, green: 0.29, blue: 0.13), radius: 13)
            panel(CGRect(x: -45, y: -72, width: 90, height: 32), RallyStyle.ink, radius: 12)
            for x in [-23, 17] {
                panel(CGRect(x: x, y: -63, width: 9, height: 13), Color(red: 0.73, green: 0.89, blue: 1), radius: 4)
            }
            context.draw(Text("R").font(.custom("AvenirNext-Heavy", size: 45)).foregroundColor(.white), at: CGPoint(x: 0, y: 30))
            for x in [-47, 47] {
                for y in [-84, 84] {
                    context.fill(Path(ellipseIn: CGRect(x: x - 3, y: y - 3, width: 6, height: 6)), with: .color(.white.opacity(0.6)))
                }
            }
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
