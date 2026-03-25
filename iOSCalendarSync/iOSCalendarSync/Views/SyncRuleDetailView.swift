import SwiftUI
import EventKit

enum RuleMode {
    case add
    case edit(SyncRule)
}

struct SyncRuleDetailView: View {
    @EnvironmentObject var calendarManager: CalendarManager
    @EnvironmentObject var syncManager: SyncManager
    @Environment(\.dismiss) private var dismiss

    let mode: RuleMode

    @State private var name: String = ""
    @State private var sourceCalendarID: String = ""
    @State private var destinationCalendarID: String = ""
    @State private var direction: SyncDirection = .oneWay
    @State private var duplicateHandling: DuplicateHandling = .skip
    @State private var deletionHandling: DeletionHandling = .ignore
    @State private var syncPastEvents = false
    @State private var pastDaysToSync = 30
    @State private var syncFutureEvents = true
    @State private var futureDaysToSync = 365

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var canSave: Bool {
        !name.isEmpty
            && !sourceCalendarID.isEmpty
            && !destinationCalendarID.isEmpty
            && sourceCalendarID != destinationCalendarID
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Rule Name") {
                    TextField("e.g. Work → Personal", text: $name)
                }

                Section("Calendars") {
                    calendarPicker(title: "Source Calendar", selection: $sourceCalendarID, exclude: destinationCalendarID)
                    calendarPicker(title: "Destination Calendar", selection: $destinationCalendarID, exclude: sourceCalendarID)
                }

                Section("Sync Options") {
                    Picker("Direction", selection: $direction) {
                        ForEach(SyncDirection.allCases, id: \.self) { dir in
                            Text(dir.displayName).tag(dir)
                        }
                    }
                    Picker("Duplicates", selection: $duplicateHandling) {
                        ForEach(DuplicateHandling.allCases, id: \.self) { opt in
                            Text(opt.displayName).tag(opt)
                        }
                    }
                    Picker("Deletions", selection: $deletionHandling) {
                        ForEach(DeletionHandling.allCases, id: \.self) { opt in
                            Text(opt.displayName).tag(opt)
                        }
                    }
                }

                Section("Date Range") {
                    Toggle("Include Past Events", isOn: $syncPastEvents)
                    if syncPastEvents {
                        Stepper("Past \(pastDaysToSync) days", value: $pastDaysToSync, in: 1...365)
                    }
                    Toggle("Include Future Events", isOn: $syncFutureEvents)
                    if syncFutureEvents {
                        Stepper("Next \(futureDaysToSync) days", value: $futureDaysToSync, in: 1...730)
                    }
                }

                if !canSave && !sourceCalendarID.isEmpty && !destinationCalendarID.isEmpty
                    && sourceCalendarID == destinationCalendarID {
                    Section {
                        Label("Source and destination cannot be the same calendar.", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Rule" : "New Rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!canSave)
                }
            }
            .onAppear { populateFromMode() }
        }
    }

    private func calendarPicker(title: String, selection: Binding<String>, exclude: String) -> some View {
        Picker(title, selection: selection) {
            Text("Select a calendar").tag("")
            ForEach(calendarManager.calendars.filter { $0.calendarIdentifier != exclude }, id: \.calendarIdentifier) { cal in
                HStack {
                    Circle()
                        .fill(Color(cgColor: cal.cgColor))
                        .frame(width: 10, height: 10)
                    Text(cal.title)
                }
                .tag(cal.calendarIdentifier)
            }
        }
    }

    private func populateFromMode() {
        if case .edit(let rule) = mode {
            name = rule.name
            sourceCalendarID = rule.sourceCalendarID
            destinationCalendarID = rule.destinationCalendarID
            direction = rule.direction
            duplicateHandling = rule.duplicateHandling
            deletionHandling = rule.deletionHandling
            syncPastEvents = rule.syncPastEvents
            pastDaysToSync = rule.pastDaysToSync
            syncFutureEvents = rule.syncFutureEvents
            futureDaysToSync = rule.futureDaysToSync
        }
    }

    private func save() {
        switch mode {
        case .add:
            var rule = SyncRule(
                name: name,
                sourceCalendarID: sourceCalendarID,
                destinationCalendarID: destinationCalendarID,
                direction: direction,
                duplicateHandling: duplicateHandling,
                deletionHandling: deletionHandling
            )
            rule.syncPastEvents = syncPastEvents
            rule.pastDaysToSync = pastDaysToSync
            rule.syncFutureEvents = syncFutureEvents
            rule.futureDaysToSync = futureDaysToSync
            syncManager.addRule(rule)

        case .edit(var rule):
            rule.name = name
            rule.sourceCalendarID = sourceCalendarID
            rule.destinationCalendarID = destinationCalendarID
            rule.direction = direction
            rule.duplicateHandling = duplicateHandling
            rule.deletionHandling = deletionHandling
            rule.syncPastEvents = syncPastEvents
            rule.pastDaysToSync = pastDaysToSync
            rule.syncFutureEvents = syncFutureEvents
            rule.futureDaysToSync = futureDaysToSync
            syncManager.updateRule(rule)
        }
        dismiss()
    }
}
