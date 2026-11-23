import AppKit
let folder = URL(fileURLWithPath: CommandLine.arguments[1])
let width = 1000, height = 760
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor(calibratedWhite: 0.94, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()
func text(_ value: String, _ x: CGFloat, _ y: CGFloat, size: CGFloat = 14, dark: Bool = false) {
    (value as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: [.font: NSFont.systemFont(ofSize: size, weight: .medium), .foregroundColor: dark ? NSColor.white : NSColor.darkGray])
}
func icon(_ rendition: String, _ sourceSize: Int, x: CGFloat, y: CGFloat, size: CGFloat) {
    NSImage(contentsOf: folder.appendingPathComponent("\(rendition)-\(sourceSize).png"))!.draw(in: NSRect(x: x, y: y, width: size, height: size))
}
text("ROBOT RALLY  /  NATIVE ICON PROOFS", 28, 716, size: 24)
text("Apple Icon Composer renders · macOS · same vector geometry in every appearance", 28, 687)
let variants = ["Default", "Dark", "ClearLight", "ClearDark", "TintedLight", "TintedDark"]
for (i, variant) in variants.enumerated() {
    let x = CGFloat(28 + i * 162)
    NSColor(calibratedWhite: i % 2 == 0 ? 1 : 0.16, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: x-4, y: 500, width: 148, height: 154), xRadius: 16, yRadius: 16).fill()
    icon(variant, i < 2 ? 128 : 256, x: x+6, y: 515, size: 128)
    text(variant, x, 473, size: 13)
}
text("Construction and color", 28, 432, size: 18)
icon("Default", 1024, x: 28, y: 135, size: 270)
icon("Dark", 1024, x: 324, y: 135, size: 270)
text("Actual pixel sizes (no enlargement)", 640, 432, size: 18)
for (row, variant) in ["Default", "Dark"].enumerated() {
    let y = CGFloat(280 - row * 155)
    NSColor(calibratedWhite: row == 0 ? 1 : 0.12, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 628, y: y-35, width: 345, height: 170), xRadius: 12, yRadius: 12).fill()
    var x: CGFloat = 645
    for size in [16,32,64,128] {
        icon(variant, size, x: x, y: y, size: CGFloat(size))
        text("\(size)", x, y-22, size: 12, dark: row == 1)
        x += CGFloat(size + 20)
    }
}
text("Original vector artwork · no embedded typography, raster texture, baked lighting, or corner mask", 28, 64, size: 15)
text("Native light, dark, clear, and tinted renders. The system supplies the material and outer shape.", 28, 37, size: 14)
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent("icon-proof-sheet.png"))
