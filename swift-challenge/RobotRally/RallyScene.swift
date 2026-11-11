import AppKit
import SpriteKit
import SwiftUI
import GameController

@MainActor
final class RallyScene: SKScene {
    var onAnswer: ((Int) -> Void)?
    var enabled = false { didSet { if !enabled { keys.removeAll() } } }
    private var keys = Set<UInt16>()
    private var lastTime: TimeInterval = 0
    private let robot = SKShapeNode(rectOf: CGSize(width: 34, height: 42), cornerRadius: 8)
    private var destinations: [CGPoint] = []

    override init(size: CGSize) {
        super.init(size: size)
        scaleMode = .aspectFit
        backgroundColor = NSColor(red: 0.08, green: 0.12, blue: 0.14, alpha: 1)
        for x in stride(from: 40, through: 800, by: 40) {
            let line = CGMutablePath()
            line.move(to: CGPoint(x: x, y: 0)); line.addLine(to: CGPoint(x: x, y: 440))
            let node = SKShapeNode(path: line)
            node.strokeColor = NSColor.white.withAlphaComponent(0.045)
            addChild(node)
        }
        for y in stride(from: 0, through: 440, by: 40) {
            let line = CGMutablePath()
            line.move(to: CGPoint(x: 0, y: y)); line.addLine(to: CGPoint(x: 840, y: y))
            let node = SKShapeNode(path: line)
            node.strokeColor = NSColor.white.withAlphaComponent(0.045)
            addChild(node)
        }
        for index in 0..<3 {
            let point = CGPoint(x: 160 + index * 260, y: 325)
            destinations.append(point)
            let zone = SKShapeNode(rectOf: CGSize(width: 174, height: 96), cornerRadius: 16)
            zone.position = point
            zone.fillColor = NSColor(red: 0.13, green: 0.22, blue: 0.24, alpha: 1)
            zone.strokeColor = NSColor(red: 0.39, green: 0.70, blue: 0.67, alpha: 1)
            zone.lineWidth = 2
            addChild(zone)
            let label = SKLabelNode(text: String(index + 1))
            label.fontName = "AvenirNext-DemiBold"
            label.fontSize = 32
            label.verticalAlignmentMode = .center
            zone.addChild(label)
        }
        robot.fillColor = NSColor(red: 0.96, green: 0.71, blue: 0.32, alpha: 1)
        robot.strokeColor = .clear
        robot.position = CGPoint(x: 420, y: 80)
        let eye = SKShapeNode(circleOfRadius: 4)
        eye.fillColor = .black
        eye.strokeColor = .clear
        eye.position = CGPoint(x: 0, y: 10)
        robot.addChild(eye)
        addChild(robot)
    }

    required init?(coder: NSCoder) { fatalError("Use init(size:)") }

    func reset() {
        robot.position = CGPoint(x: 420, y: 80)
        robot.zRotation = 0
        keys.removeAll()
        lastTime = 0
    }

    func clearInput() { keys.removeAll(); lastTime = 0 }
    func press(_ code: UInt16) { keys.insert(code) }
    func release(_ code: UInt16) { keys.remove(code) }

    override func update(_ currentTime: TimeInterval) {
        let delta = lastTime == 0 ? 0 : min(currentTime - lastTime, 0.05)
        lastTime = currentTime
        guard enabled, NSApp.isActive else { clearInput(); return }
        var dx: CGFloat = 0
        var dy: CGFloat = 0
        if keys.contains(0) || keys.contains(123) { dx -= 1 }
        if keys.contains(2) || keys.contains(124) { dx += 1 }
        if keys.contains(13) || keys.contains(126) { dy += 1 }
        if keys.contains(1) || keys.contains(125) { dy -= 1 }
        if let pad = GCController.controllers().first?.extendedGamepad {
            let x = CGFloat(pad.leftThumbstick.xAxis.value)
            let y = CGFloat(pad.leftThumbstick.yAxis.value)
            if abs(x) > 0.18 { dx += x }
            if abs(y) > 0.18 { dy += y }
            dx += CGFloat(pad.dpad.xAxis.value)
            dy += CGFloat(pad.dpad.yAxis.value)
        }
        let length = hypot(dx, dy)
        if length > 1 { dx /= length; dy /= length }
        robot.position.x = min(817, max(23, robot.position.x + dx * 245 * delta))
        robot.position.y = min(417, max(23, robot.position.y + dy * 245 * delta))
        if length > 0 { robot.zRotation = atan2(-dx, dy) }
        for (index, destination) in destinations.enumerated() {
            if abs(robot.position.x - destination.x) < 80 && abs(robot.position.y - destination.y) < 42 {
                enabled = false
                onAnswer?(index)
                break
            }
        }
    }
}

@MainActor
final class DrivingView: SKView {
    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        if [0, 1, 2, 13, 123, 124, 125, 126].contains(event.keyCode) {
            (scene as? RallyScene)?.press(event.keyCode)
        } else { super.keyDown(with: event) }
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
        view.presentScene(scene)
        return view
    }
    func updateNSView(_ view: DrivingView, context: Context) {
        if active {
            DispatchQueue.main.async { if scene.enabled { view.window?.makeFirstResponder(view) } }
        }
    }
}
