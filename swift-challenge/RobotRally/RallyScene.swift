import AppKit
import SpriteKit
import SwiftUI
import GameController

@MainActor
final class RallyScene: SKScene {
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
    private var aHeld = false
    private var bHeld = false
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
        for x in stride(from: 40, through: 800, by: 40) {
            for y in stride(from: 40, through: 480, by: 40) {
                let dot = SKShapeNode(circleOfRadius: 1)
                dot.position = CGPoint(x: x, y: y)
                dot.fillColor = NSColor.white.withAlphaComponent(0.10)
                dot.strokeColor = .clear
                addChild(dot)
            }
        }
        let border = SKShapeNode(rect: CGRect(x: 22, y: 46, width: 796, height: 450), cornerRadius: 22)
        border.strokeColor = NSColor.white.withAlphaComponent(0.17)
        border.lineWidth = 2
        addChild(border)
        let centerLine = CGMutablePath()
        centerLine.move(to: CGPoint(x: 42, y: 255))
        centerLine.addLine(to: CGPoint(x: 798, y: 255))
        let line = SKShapeNode(path: centerLine)
        line.strokeColor = NSColor.white.withAlphaComponent(0.14)
        addChild(line)
        let center = SKShapeNode(circleOfRadius: 50)
        center.position = CGPoint(x: 420, y: 255)
        center.strokeColor = NSColor.white.withAlphaComponent(0.14)
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
        let shadow = box(CGSize(width: 53, height: 65), at: CGPoint(x: 3, y: -5), fill: .black.withAlphaComponent(0.3), radius: 14)
        robot.addChild(shadow)
        robot.addChild(chassis)
        for x: CGFloat in [-25, 25] {
            for y: CGFloat in [-17, 17] {
                let wheel = box(CGSize(width: 12, height: 22), at: CGPoint(x: x, y: y), fill: NSColor(white: 0.035, alpha: 1), radius: 4)
                chassis.addChild(wheel)
                for offset in [-6, 0, 6] {
                    wheel.addChild(box(CGSize(width: 9, height: 2), at: CGPoint(x: 0, y: offset), fill: NSColor(white: 0.28, alpha: 1), radius: 0))
                }
            }
        }
        chassis.addChild(box(CGSize(width: 43, height: 56), at: .zero, fill: amber, radius: 11))
        chassis.addChild(box(CGSize(width: 31, height: 25), at: CGPoint(x: 0, y: -4), fill: NSColor(red: 0.74, green: 0.28, blue: 0.14, alpha: 1), radius: 5))
        chassis.addChild(box(CGSize(width: 26, height: 9), at: CGPoint(x: 0, y: 16), fill: NSColor(white: 0.09, alpha: 1), radius: 4))
        for x: CGFloat in [-7, 7] {
            let eye = SKShapeNode(circleOfRadius: 2.3)
            eye.fillColor = NSColor(red: 0.77, green: 0.91, blue: 1, alpha: 1)
            eye.strokeColor = .clear
            eye.position = CGPoint(x: x, y: 16)
            chassis.addChild(eye)
        }
        let number = SKLabelNode(text: "R")
        number.fontName = "AvenirNext-Heavy"
        number.fontSize = 17
        number.verticalAlignmentMode = .center
        number.position.y = -5
        chassis.addChild(number)
        addChild(robot)
    }

    func configure(answers: [String]) {
        bays.removeAllChildren()
        zones.removeAll()
        for (index, answer) in answers.enumerated() {
            let zone = box(CGSize(width: 220, height: 136), at: destinations[index], fill: blue.withAlphaComponent(0.09), radius: 14)
            zone.strokeColor = blue.withAlphaComponent(0.5)
            zone.lineWidth = 1.5
            let number = SKLabelNode(text: "\(index + 1)")
            number.fontName = "AvenirNext-Bold"
            number.fontSize = 23
            number.fontColor = blue
            number.position.y = 33
            zone.addChild(number)
            let label = SKLabelNode(text: answer)
            label.fontName = "AvenirNext-DemiBold"
            label.fontSize = 16
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
        instruction.text = "DRIVE INTO AN ANSWER BAY"
    }

    func showResult(selected: Int, correct: Int) {
        for (index, zone) in zones.enumerated() {
            let color = index == correct ? NSColor.systemMint : index == selected ? amber : blue.withAlphaComponent(0.25)
            zone.strokeColor = color
            zone.fillColor = color.withAlphaComponent(index == correct ? 0.22 : 0.08)
        }
        let pulse = SKShapeNode(circleOfRadius: 32)
        pulse.position = robot.position
        pulse.strokeColor = selected == correct ? .systemMint : amber
        pulse.lineWidth = 3
        addChild(pulse)
        pulse.run(.sequence([.group([.scale(to: 2.8, duration: 0.55), .fadeOut(withDuration: 0.55)]), .removeFromParent()]))
        instruction.text = selected == correct ? "ANSWER COLLECTED" : "CHECK THE EXPLANATION, THEN KEEP GOING"
    }

    func clearInput() {
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
        let pad = GCController.controllers().first?.extendedGamepad
        let a = pad?.buttonA.isPressed ?? false
        let b = pad?.buttonB.isPressed ?? false
        if a && !aHeld { onPrimary?() }
        if b && !bHeld { onPause?() }
        aHeld = a
        bHeld = b
        guard enabled else { return }
        var dx: CGFloat = 0
        var dy: CGFloat = 0
        if keys.contains(0) || keys.contains(123) { dx -= 1 }
        if keys.contains(2) || keys.contains(124) { dx += 1 }
        if keys.contains(13) || keys.contains(126) { dy += 1 }
        if keys.contains(1) || keys.contains(125) { dy -= 1 }
        if let pad {
            let x = CGFloat(pad.leftThumbstick.xAxis.value)
            let y = CGFloat(pad.leftThumbstick.yAxis.value)
            if abs(x) > 0.18 { dx += x }
            if abs(y) > 0.18 { dy += y }
            dx += CGFloat(pad.dpad.xAxis.value)
            dy += CGFloat(pad.dpad.yAxis.value)
        }
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
        if hypot(velocity.dx, velocity.dy) > 50 && trailTime > 0.08 {
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
        guard let target else { progress.path = nil; instruction.text = "DRIVE INTO AN ANSWER BAY"; return }
        dwell += delta
        instruction.text = "HOLD IN THE BAY TO CHOOSE"
        let path = CGMutablePath()
        path.addArc(center: .zero, radius: 39, startAngle: .pi / 2, endAngle: .pi / 2 - 2 * .pi * min(1, dwell / 0.45), clockwise: true)
        progress.path = path
        progress.position = robot.position
        if dwell >= 0.45 {
            enabled = false
            onAnswer?(target)
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
