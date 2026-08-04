import Combine
import Foundation
import HealthKit

@MainActor
final class HealthKitManager: ObservableObject {
    private let store = HKHealthStore()

    @Published var isAuthorized = false
    @Published var latestRun: LatestRun?
    @Published var errorMessage: String?

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
            types.insert(heartRate)
        }
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            types.insert(energy)
        }
        return types
    }

    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            errorMessage = "이 기기에서는 HealthKit을 사용할 수 없습니다."
            return
        }

        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            isAuthorized = true
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refresh() async {
        do {
            latestRun = try await fetchLatestRunningWorkout()
            errorMessage = latestRun == nil ? "최근 러닝 기록이 없습니다." : nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func fetchLatestRunningWorkout() async throws -> LatestRun? {
        let running = HKQuery.predicateForWorkouts(with: .running)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        let workout: HKWorkout? = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: .workoutType(),
                predicate: running,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples?.first as? HKWorkout)
            }
            store.execute(query)
        }

        guard let workout else { return nil }

        let meters = workout.totalDistance?.doubleValue(for: .meter())
        let kilometers = meters.map { $0 / 1000 }
        let durationMinutes = workout.duration / 60
        let pace: Double? = {
            guard let kilometers, kilometers > 0 else { return nil }
            return durationMinutes / kilometers
        }()
        let calories = workout.statistics(for: HKQuantityType(.activeEnergyBurned))?
            .sumQuantity()?
            .doubleValue(for: .kilocalorie())
        let avgHeartRate = try await fetchAverageHeartRate(
            from: workout.startDate,
            to: workout.endDate
        )

        return LatestRun(
            start: workout.startDate,
            end: workout.endDate,
            durationMinutes: Int(durationMinutes),
            distanceKm: kilometers,
            paceMinPerKm: pace,
            calories: calories,
            avgHeartRate: avgHeartRate
        )
    }

    private func fetchAverageHeartRate(from start: Date, to end: Date) async throws -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            return nil
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, statistics, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let bpm = statistics?
                    .averageQuantity()?
                    .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
                continuation.resume(returning: bpm)
            }
            store.execute(query)
        }
    }
}
