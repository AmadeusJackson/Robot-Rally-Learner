import Foundation

struct Challenge {
    let topic: String
    let lesson: String
    let question: String
    let answers: [String]
    let correct: Int
    let explanation: String

    static let sample: [Challenge] = [
        Challenge(
            topic: "Getting moving",
            lesson: "Acceleration describes how quickly velocity changes. For the same robot mass, doubling the net force doubles acceleration. This follows from F = ma.",
            question: "A robot keeps the same mass. Its net forward force doubles. What happens to its acceleration?",
            answers: ["It halves", "It doubles", "It stays the same"],
            correct: 1,
            explanation: "The acceleration doubles. Since a = F ÷ m, doubling F while keeping m fixed doubles a. Net force means the force remaining after opposing forces are accounted for."
        ),
        Challenge(
            topic: "Trading speed for torque",
            lesson: "In an ideal gear reduction, a small driving gear turns a larger output gear. The output turns more slowly and provides more torque. A 2:1 reduction halves speed and doubles torque, ignoring losses.",
            question: "A motor runs at the same speed and torque. Its drive changes from 1:1 to an ideal 2:1 reduction. What happens at the output?",
            answers: ["Half speed · double torque", "Double speed · half torque", "Half speed · half torque"],
            correct: 0,
            explanation: "The output has half the speed and twice the torque. The gears trade rotational speed for torque. In this ideal model, output power equals input power."
        ),
        Challenge(
            topic: "Staying in the match",
            lesson: "Energy is power multiplied by time. At a constant average power, ideal runtime is usable battery energy divided by power. A 60 Wh battery supplying 120 W lasts half an hour.",
            question: "A robot has 60 Wh of usable battery energy. Its average power falls from 120 W to 60 W. How does its ideal runtime change?",
            answers: ["30 minutes to 15 minutes", "30 minutes to 30 minutes", "30 minutes to 60 minutes"],
            correct: 2,
            explanation: "Runtime doubles from 30 to 60 minutes. At 120 W, 60 Wh ÷ 120 W is 0.5 hours. At 60 W, it is 1 hour. Real runtime also depends on usable capacity and operating conditions."
        )
    ]
}
