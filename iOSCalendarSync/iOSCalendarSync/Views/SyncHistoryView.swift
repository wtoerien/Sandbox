import SwiftUI

struct SyncHistoryView: View {
    @EnvironmentObject var syncManager: SyncManager
    @State private var selectedResult: SyncResult?
    @State private var showingClearConfirmation = false

    var body: some View {
        NavigationStack {
            Group {
                if syncManager.history.isEmpty {
                    emptyState
                } else {
                    historyList
                }
            }
            .navigationTitle("Sync History")
            .toolbar {
                if !syncManager.history.isEmpty {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Clear") {
                            showingClearConfirmation = true
                        }
                        .foregroundStyle(.red)
                    }
                }
            }
            .sheet(item: $selectedResult) { result in
                SyncResultDetailView(result: result)
            }
            .confirmationDialog(
                "Clear all sync history?",
                isPresented: $showingClearConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear History", role: .destructive) {
                    SyncResult.clearHistory()
                    syncManager.history = []
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var historyList: some View {
        List {
            ForEach(syncManager.history) { result in
                Button {
                    selectedResult = result
                } label: {
                    SyncHistoryRow(result: result)
                }
                .buttonStyle(.plain)
            }
        }
        .listStyle(.insetGrouped)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("No Sync History")
                .font(.title2.bold())
            Text("Sync history will appear here after you run a sync.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - History Row

struct SyncHistoryRow: View {
    let result: SyncResult

    var statusColor: Color {
        switch result.status {
        case .success: return .green
        case .partialSuccess: return .orange
        case .failed: return .red
        case .cancelled: return .secondary
        }
    }

    var statusIcon: String {
        switch result.status {
        case .success: return "checkmark.circle.fill"
        case .partialSuccess: return "exclamationmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelled: return "minus.circle.fill"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: statusIcon)
                .foregroundStyle(statusColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 4) {
                Text(result.ruleName)
                    .font(.headline)
                Text(result.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(result.startedAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Sync Result Detail

struct SyncResultDetailView: View {
    let result: SyncResult
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Overview") {
                    resultRow("Status", value: result.status.rawValue.capitalized)
                    resultRow("Rule", value: result.ruleName)
                    resultRow("Started", value: result.startedAt.formatted(date: .abbreviated, time: .shortened))
                    if let completed = result.completedAt {
                        resultRow("Completed", value: completed.formatted(date: .abbreviated, time: .shortened))
                        let duration = completed.timeIntervalSince(result.startedAt)
                        resultRow("Duration", value: String(format: "%.1f seconds", duration))
                    }
                }

                Section("Changes") {
                    if result.eventsAdded > 0 {
                        resultRow("Added", value: "\(result.eventsAdded)")
                    }
                    if result.eventsUpdated > 0 {
                        resultRow("Updated", value: "\(result.eventsUpdated)")
                    }
                    if result.eventsDeleted > 0 {
                        resultRow("Deleted", value: "\(result.eventsDeleted)")
                    }
                    if result.eventsSkipped > 0 {
                        resultRow("Skipped", value: "\(result.eventsSkipped)")
                    }
                    if result.eventsFailed > 0 {
                        resultRow("Failed", value: "\(result.eventsFailed)")
                    }
                    if result.totalEventsProcessed == 0 {
                        Text("No changes were made.")
                            .foregroundStyle(.secondary)
                    }
                }

                if let error = result.errorMessage {
                    Section("Error") {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }

                if !result.actions.isEmpty {
                    Section("Event Log (\(result.actions.count))") {
                        ForEach(result.actions) { action in
                            EventActionRow(action: action)
                        }
                    }
                }
            }
            .navigationTitle("Sync Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func resultRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).fontWeight(.medium)
        }
    }
}

// MARK: - Event Action Row

struct EventActionRow: View {
    let action: SyncEventAction

    var actionColor: Color {
        switch action.action {
        case .added: return .green
        case .updated: return .blue
        case .deleted: return .red
        case .skipped: return .secondary
        case .failed: return .orange
        }
    }

    var actionIcon: String {
        switch action.action {
        case .added: return "plus.circle"
        case .updated: return "pencil.circle"
        case .deleted: return "minus.circle"
        case .skipped: return "forward.circle"
        case .failed: return "exclamationmark.circle"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: actionIcon)
                .foregroundStyle(actionColor)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(action.eventTitle)
                    .font(.subheadline)
                    .lineLimit(1)
                Text("\(action.calendarName) • \(action.eventStartDate, style: .date)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(action.action.rawValue.capitalized)
                .font(.caption)
                .foregroundStyle(actionColor)
        }
    }
}
