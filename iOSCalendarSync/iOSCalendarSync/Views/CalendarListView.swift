import SwiftUI
import EventKit

struct CalendarListView: View {
    @EnvironmentObject var calendarManager: CalendarManager
    @EnvironmentObject var syncManager: SyncManager

    var body: some View {
        NavigationStack {
            List {
                if calendarManager.calendars.isEmpty {
                    ContentUnavailableView(
                        "No Calendars Found",
                        systemImage: "calendar.badge.exclamationmark",
                        description: Text("No calendars are available on this device.")
                    )
                } else {
                    ForEach(groupedCalendars, id: \.0) { source, cals in
                        Section(source) {
                            ForEach(cals, id: \.calendarIdentifier) { calendar in
                                CalendarRow(calendar: calendar)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Calendars")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        calendarManager.loadCalendars()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }

    private var groupedCalendars: [(String, [EKCalendar])] {
        var groups: [String: [EKCalendar]] = [:]
        for calendar in calendarManager.calendars {
            let source = calendar.source?.title ?? "Other"
            groups[source, default: []].append(calendar)
        }
        return groups.sorted { $0.key < $1.key }
    }
}

struct CalendarRow: View {
    let calendar: EKCalendar
    @EnvironmentObject var syncManager: SyncManager

    private var rulesUsingCalendar: [SyncRule] {
        syncManager.rules.filter {
            $0.sourceCalendarID == calendar.calendarIdentifier
                || $0.destinationCalendarID == calendar.calendarIdentifier
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(cgColor: calendar.cgColor))
                .frame(width: 28, height: 28)
                .overlay {
                    Image(systemName: "calendar")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                }

            VStack(alignment: .leading, spacing: 3) {
                Text(calendar.title)
                    .font(.headline)
                HStack(spacing: 6) {
                    Text(calendar.source?.title ?? "Unknown source")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !calendar.allowsContentModifications {
                        Label("Read-only", systemImage: "lock")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                            .labelStyle(.titleAndIcon)
                    }
                }
            }

            Spacer()

            if !rulesUsingCalendar.isEmpty {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(rulesUsingCalendar.count)")
                        .font(.caption.bold())
                        .padding(6)
                        .background(.blue.opacity(0.15), in: Circle())
                        .foregroundStyle(.blue)
                    Text("rules")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
