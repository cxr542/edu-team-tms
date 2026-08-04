import Foundation

struct LatestRun {
    let start: Date
    let end: Date
    let durationMinutes: Int
    let distanceKm: Double?
    let paceMinPerKm: Double?
    let calories: Double?
    let avgHeartRate: Double?
}

func formatPace(_ minPerKm: Double?) -> String {
    guard let minPerKm else { return "-" }
    let minutes = Int(minPerKm)
    let seconds = Int((minPerKm - Double(minutes)) * 60)
    return String(format: "%d'%02d\"/km", minutes, seconds)
}
