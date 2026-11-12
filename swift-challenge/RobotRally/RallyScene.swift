import AppKit
import SpriteKit
import SwiftUI
import GameController

@MainActor
final class RallyScene: SKScene {
    var onPracticeVisit: ((Int) -> Void)?
    var reduceMotion = false
    var soundEnabled = false
    private var practiceMode = false
    private var visited = Set<Int>()
    var onAnswer: ((Int) -> Void)?
    var onPrimary: (() -> Void)?
    var onPause: (() -> Void)?
    var enabled = false { didSet { if !enabled { clearInput() } } }
    private var keys = Set<UInt16>()
    private var lastTime: TimeInterval = 0
    private var velocity = CGVector.zero
    private let robot = SKNode()
    private let chassis = SKNode()
    private let bays = SKNode()
    private var zones: [SKShapeNode] = []
    private let destinations = [CGPoint(x: 160, y: 386), CGPoint(x: 420, y: 386), CGPoint(x: 680, y: 386)]
    private let amber = NSColor(red: 1, green: 0.53, blue: 0.27, alpha: 1)
    private let blue = NSColor(red: 0.46, green: 0.70, blue: 1, alpha: 1)
    private var hovering: Int?
    private var dwell: TimeInterval = 0
    private var trailTime: TimeInterval = 0
    var controllerMotion = CGVector.zero
    private let progress = SKShapeNode()
    private let instruction = SKLabelNode(fontNamed: "AvenirNext-Medium")

    override init(size: CGSize) {
        super.init(size: size)
        scaleMode = .aspectFit
        backgroundColor = NSColor(red: 0.075, green: 0.11, blue: 0.17, alpha: 1)
        buildField()
        buildRobot()
        addChild(bays)
        progress.lineWidth = 3
        progress.strokeColor = amber
        progress.fillColor = .clear
        progress.zPosition = 4
        addChild(progress)
        instruction.fontSize = 13
        instruction.fontColor = NSColor.white.withAlphaComponent(0.5)
        instruction.position = CGPoint(x: 420, y: 22)
        addChild(instruction)
        configure(answers: ["Force", "Gears", "Energy"])
        reset()
    }

    required init?(coder: NSCoder) { fatalError("Use init(size:)") }

    private func box(_ size: CGSize, at point: CGPoint, fill: NSColor, radius: CGFloat = 8) -> SKShapeNode {
        let node = SKShapeNode(rectOf: size, cornerRadius: radius)
        node.position = point
        node.fillColor = fill
        node.strokeColor = .clear
        return node
    }

    private func buildField() {
        // Individual floor panels and rails give the arena depth without
        // changing the flat, predictable driving surface.
        let floor = box(CGSize(width: 796, height: 450), at: CGPoint(x: 420, y: 271), fill: NSColor(red: 0.18, green: 0.23, blue: 0.27, alpha: 1), radius: 18)
        addChild(floor)
        for column in 0..<8 {
            for row in 0..<5 {
                let light = (column + row) % 2 == 0
                let panel = box(CGSize(width: 96, height: 85), at: CGPoint(x: 72 + column * 99, y: 92 + row * 88), fill: NSColor(white: light ? 0.36 : 0.32, alpha: 0.11), radius: 2)
                addChild(panel)
            }
        }
        let railShadow = SKShapeNode(rect: CGRect(x: 19, y: 40, width: 802, height: 456), cornerRadius: 22)
        railShadow.strokeColor = .black.withAlphaComponent(0.6)
        railShadow.lineWidth = 12
        addChild(railShadow)
        let border = SKShapeNode(rect: CGRect(x: 22, y: 46, width: 796, height: 450), cornerRadius: 22)
        border.strokeColor = NSColor(red: 0.48, green: 0.54, blue: 0.59, alpha: 1)
        border.lineWidth = 5
        addChild(border)
        for x in [40, 800] {
            for y in [65, 477] {
                let bolt = SKShapeNode(circleOfRadius: 4)
                bolt.position = CGPoint(x: x, y: y)
                bolt.fillColor = NSColor(white: 0.65, alpha: 1)
                bolt.strokeColor = NSColor(white: 0.1, alpha: 1)
                bolt.lineWidth = 2
                addChild(bolt)
            }
        }
        let centerLine = CGMutablePath()
        centerLine.move(to: CGPoint(x: 42, y: 255))
        centerLine.addLine(to: CGPoint(x: 798, y: 255))
        let line = SKShapeNode(path: centerLine)
        line.strokeColor = NSColor.white.withAlphaComponent(0.35)
        addChild(line)
        let center = SKShapeNode(circleOfRadius: 50)
        center.position = CGPoint(x: 420, y: 255)
        center.strokeColor = NSColor.white.withAlphaComponent(0.35)
        addChild(center)
        for x in [45, 795] {
            for y in stride(from: 130, through: 220, by: 16) {
                let stripe = box(CGSize(width: 8, height: 7), at: CGPoint(x: x, y: y), fill: amber.withAlphaComponent(0.65), radius: 1)
                addChild(stripe)
            }
        }
        let start = SKShapeNode(circleOfRadius: 37)
        start.position = CGPoint(x: 420, y: 115)
        start.strokeColor = NSColor.white.withAlphaComponent(0.22)
        start.lineWidth = 2
        addChild(start)
        let label = SKLabelNode(text: "START")
        label.fontName = "AvenirNext-DemiBold"
        label.fontSize = 10
        label.fontColor = .white.withAlphaComponent(0.35)
        label.position = CGPoint(x: 420, y: 65)
        addChild(label)
    }

    private func buildRobot() {
        robot.zPosition = 3
        let shadow = box(CGSize(width: 64, height: 74), at: CGPoint(x: 4, y: -6), fill: .black.withAlphaComponent(0.35), radius: 14)
        robot.addChild(shadow)
        robot.addChild(chassis)
        let rover = SKSpriteNode(imageNamed: "Rover")
        rover.size = CGSize(width: 82, height: 82)
        chassis.addChild(rover)
        addChild(robot)
    }

    func configure(answers: [String], practice: Bool = false) {
        practiceMode = practice
        visited.removeAll()
        bays.removeAllChildren()
        zones.removeAll()
        for (index, answer) in answers.enumerated() {
            let zone = box(CGSize(width: 220, height: 136), at: destinations[index], fill: NSColor(red: 0.08, green: 0.15, blue: 0.24, alpha: 1), radius: 14)
            let bayColor: NSColor = [blue, .systemMint, .systemPurple][index]
            zone.strokeColor = bayColor.withAlphaComponent(0.8)
            zone.lineWidth = 2.5
            let entry = box(CGSize(width: 86, height: 5), at: CGPoint(x: 0, y: -68), fill: bayColor, radius: 1)
            zone.addChild(entry)
            let number = SKLabelNode(text: "\(index + 1)")
            number.fontName = "AvenirNext-Bold"
            number.fontSize = 23
            number.fontColor = bayColor
            number.position.y = 33
            zone.addChild(number)
            let label = SKLabelNode(text: answer)
            label.fontName = "AvenirNext-DemiBold"
            label.fontSize = 18
            label.numberOfLines = 3
            label.preferredMaxLayoutWidth = 194
            label.verticalAlignmentMode = .center
            label.position.y = -9
            zone.addChild(label)
            bays.addChild(zone)
            zones.append(zone)
        }
    }

    func reset() {
        robot.position = CGPoint(x: 420, y: 115)
        robot.zRotation = 0
        robot.removeAllActions()
        clearInput()
        instruction.text = practiceMode ? "EXPLORE ALL THREE BAYS" : "DRIVE INTO AN ANSWER BAY"
    }

    func showResult(selected: Int, correct: Int) {
        for (index, zone) in zones.enumerated() {
            let color = index == correct ? NSColor.systemMint : index == selected ? amber : blue.withAlphaComponent(0.25)
            zone.strokeColor = color
            zone.fillColor = color.withAlphaComponent(index == correct ? 0.22 : 0.08)
        }
        feedback(at: robot.position, correct: selected == correct)
        instruction.text = selected == correct ? "ANSWER COLLECTED" : "CHECK THE EXPLANATION, THEN KEEP GOING"
    }

    private func feedback(at point: CGPoint, correct: Bool) {
        if soundEnabled { NSSound(named: correct ? "Glass" : "Pop")?.play() }
        guard !reduceMotion else { return }
        let color: NSColor = correct ? .systemMint : amber
        let pulse = SKShapeNode(circleOfRadius: 32)
        pulse.position = point
        pulse.strokeColor = color
        pulse.lineWidth = 3
        pulse.zPosition = 5
        addChild(pulse)
        pulse.run(.sequence([.group([.scale(to: 2.8, duration: 0.55), .fadeOut(withDuration: 0.55)]), .removeFromParent()]))
        guard correct else { return }
        for index in 0..<12 {
            let angle = CGFloat(index) * .pi / 6
            let spark = box(CGSize(width: 4, height: 9), at: point, fill: color, radius: 2)
            spark.zPosition = 5
            spark.zRotation = angle
            addChild(spark)
            spark.run(.sequence([.group([.moveBy(x: cos(angle) * 85, y: sin(angle) * 85, duration: 0.45), .fadeOut(withDuration: 0.45)]), .removeFromParent()]))
        }
    }

    func clearInput() {
        controllerMotion = .zero
        keys.removeAll()
        velocity = .zero
        lastTime = 0
        dwell = 0
        hovering = nil
        progress.path = nil
    }
    func press(_ code: UInt16) { keys.insert(code) }
    func release(_ code: UInt16) { keys.remove(code) }

    override func update(_ currentTime: TimeInterval) {
        let delta = lastTime == 0 ? 0 : min(currentTime - lastTime, 0.04)
        lastTime = currentTime
        guard NSApp.isActive else { clearInput(); return }
        guard enabled else { return }
        var dx: CGFloat = 0
        var dy: CGFloat = 0
        if keys.contains(0) || keys.contains(123) { dx -= 1 }
        if keys.contains(2) || keys.contains(124) { dx += 1 }
        if keys.contains(13) || keys.contains(126) { dy += 1 }
        if keys.contains(1) || keys.contains(125) { dy -= 1 }
        dx += controllerMotion.dx
        dy += controllerMotion.dy
        move(delta: delta, horizontal: dx, vertical: dy)
    }

    func move(delta: TimeInterval, horizontal: CGFloat, vertical: CGFloat) {
        guard enabled else { return }
        var dx = horizontal
        var dy = vertical
        let length = hypot(dx, dy)
        if length > 1 { dx /= length; dy /= length }
        let blend = min(1, delta * (length > 0 ? 10 : 18))
        velocity.dx += (dx * 265 - velocity.dx) * blend
        velocity.dy += (dy * 265 - velocity.dy) * blend
        robot.position.x = min(781, max(59, robot.position.x + velocity.dx * delta))
        robot.position.y = min(434, max(78, robot.position.y + velocity.dy * delta))
        if length > 0.1 {
            let desired = atan2(-dx, dy)
            let difference = atan2(sin(desired - robot.zRotation), cos(desired - robot.zRotation))
            robot.zRotation += difference * min(1, delta * 15)
        }
        trailTime += delta
        if !reduceMotion && hypot(velocity.dx, velocity.dy) > 50 && trailTime > 0.08 {
            trailTime = 0
            for x: CGFloat in [-24, 24] {
                let track = box(CGSize(width: 7, height: 9), at: chassis.convert(CGPoint(x: x, y: -20), to: self), fill: .black.withAlphaComponent(0.20), radius: 2)
                track.zRotation = robot.zRotation
                track.zPosition = 1
                addChild(track)
                track.run(.sequence([.fadeOut(withDuration: 1.2), .removeFromParent()]))
            }
        }
        let target = destinations.firstIndex { abs(robot.position.x - $0.x) < 94 && abs(robot.position.y - $0.y) < 54 }
        if target != hovering { dwell = 0; hovering = target }
        guard let target else { progress.path = nil; instruction.text = practiceMode ? "EXPLORE ALL THREE BAYS" : "DRIVE INTO AN ANSWER BAY"; return }
        if practiceMode && visited.contains(target) {
            progress.path = nil
            instruction.text = "BAY REACHED — TRY ANOTHER"
            return
        }
        dwell += delta
        instruction.text = "HOLD IN THE BAY TO CHOOSE"
        let path = CGMutablePath()
        path.addArc(center: .zero, radius: 39, startAngle: .pi / 2, endAngle: .pi / 2 - 2 * .pi * min(1, dwell / 0.45), clockwise: true)
        progress.path = path
        progress.position = robot.position
        if dwell >= 0.45 {
            if practiceMode {
                visited.insert(target)
                zones[target].fillColor = NSColor.systemMint.withAlphaComponent(0.25)
                feedback(at: robot.position, correct: true)
                progress.path = nil
                onPracticeVisit?(visited.count)
            } else {
                enabled = false
                onAnswer?(target)
            }
        }
    }
}

@MainActor
final class DrivingView: SKView {
    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        guard let rally = scene as? RallyScene else { return }
        if event.keyCode == 53 { if !event.isARepeat { rally.onPause?() }; return }
        if event.keyCode == 36 { if !event.isARepeat { rally.onPrimary?() }; return }
        if [0, 1, 2, 13, 123, 124, 125, 126].contains(event.keyCode) { rally.press(event.keyCode) }
        else { super.keyDown(with: event) }
    }
    override func keyUp(with event: NSEvent) { (scene as? RallyScene)?.release(event.keyCode) }
    override func resignFirstResponder() -> Bool {
        (scene as? RallyScene)?.clearInput()
        return super.resignFirstResponder()
    }
    override func mouseDown(with event: NSEvent) { window?.makeFirstResponder(self) }
}

struct FieldView: NSViewRepresentable {
    let scene: RallyScene
    let active: Bool
    func makeNSView(context: Context) -> DrivingView {
        let view = DrivingView()
        view.preferredFramesPerSecond = 60
        view.presentScene(scene)
        return view
    }
    func updateNSView(_ view: DrivingView, context: Context) {
        if active {
            DispatchQueue.main.async { if scene.enabled { view.window?.makeFirstResponder(view) } }
        }
    }
}
