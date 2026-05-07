import Foundation

let PREFIX = "hello"

func greet(_ name: String) -> String {
    return "\(PREFIX), \(name)!"
}

func classify(_ n: Int) -> String {
    switch n {
    case 0: return "zero"
    case 1, 2: return "small"
    default: return "other"
    }
}

private func privateHelper() -> Int {
    return 42
}
