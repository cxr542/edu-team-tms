import SwiftUI

struct LatestRunView: View {
    @StateObject private var health = HealthKitManager()

    var body: some View {
        NavigationStack {
            Group {
                if let run = health.latestRun {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 28) {
                            Text(
                                run.start,
                                format: .dateTime.month().day().weekday().hour().minute()
                            )
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                            VStack(alignment: .leading, spacing: 6) {
                                Text("평균 페이스")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .textCase(.uppercase)

                                Text(formatPace(run.paceMinPerKm))
                                    .font(.system(size: 56, weight: .semibold, design: .rounded))
                                    .monospacedDigit()
                                    .minimumScaleFactor(0.6)
                                    .lineLimit(1)
                            }

                            LazyVGrid(
                                columns: [GridItem(.flexible()), GridItem(.flexible())],
                                spacing: 20
                            ) {
                                MetricCell(
                                    label: "거리",
                                    value: run.distanceKm.map { String(format: "%.2f", $0) } ?? "-",
                                    unit: "km"
                                )
                                MetricCell(
                                    label: "시간",
                                    value: "\(run.durationMinutes)",
                                    unit: "분"
                                )
                                MetricCell(
                                    label: "평균 심박",
                                    value: run.avgHeartRate.map { "\(Int($0))" } ?? "-",
                                    unit: "bpm"
                                )
                                MetricCell(
                                    label: "칼로리",
                                    value: run.calories.map { "\(Int($0))" } ?? "-",
                                    unit: "kcal"
                                )
                            }

                            Button("새로고침") {
                                Task { await health.refresh() }
                            }
                            .buttonStyle(.bordered)
                        }
                        .padding(24)
                    }
                } else {
                    ContentUnavailableView {
                        Label("최근 러닝 없음", systemImage: "figure.run")
                    } description: {
                        Text(health.errorMessage ?? "Health에서 러닝 기록을 불러오세요.")
                    } actions: {
                        Button(health.isAuthorized ? "새로고침" : "Health 권한 허용") {
                            Task {
                                if health.isAuthorized {
                                    await health.refresh()
                                } else {
                                    await health.requestAuthorization()
                                }
                            }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
            .navigationTitle("최근 러닝")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                if health.isAuthorized {
                    await health.refresh()
                }
            }
        }
    }
}

private struct MetricCell: View {
    let label: String
    let value: String
    let unit: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.title2.weight(.semibold))
                    .monospacedDigit()
                Text(unit)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    LatestRunView()
}
