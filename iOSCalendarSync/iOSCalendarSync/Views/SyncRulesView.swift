import SwiftUI
import EventKit

struct SyncRulesView: View {
    @EnvironmentObject var calendarManager: CalendarManager
    @EnvironmentObject var syncManager: SyncManager
    @State private var showingAddRule = false
    @State private var ruleToEdit: SyncRule?
    @State private var syncingRuleID: UUID?
    @State private var alertError: String?

    var body: some View {
        NavigationStack {
            Group {
                if syncManager.rules.isEmpty {
                    emptyState
                } else {
                    rulesList
                }
            }
            .navigationTitle("Sync Rules")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if !syncManager.isSyncing && !syncManager.rules.filter(\.isEnabled).isEmpty {
                        Button {
                            Task { await syncManager.syncAll() }
                        } label: {
                            Label("Sync All", systemImage: "arrow.triangle.2.circlepath")
                        }
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingAddRule = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddRule) {
                SyncRuleDetailView(mode: .add)
            }
            .sheet(item: $ruleToEdit) { rule in
                SyncRuleDetailView(mode: .edit(rule))
            }
            .alert("Sync Error", isPresented: Binding(
                get: { alertError != nil },
                set: { if !$0 { alertError = nil } }
            )) {
                Button("OK") { alertError = nil }
            } message: {
                Text(alertError ?? "")
            }
        }
    }

    private var rulesList: some View {
        List {
            ForEach(syncManager.rules) { rule in
                SyncRuleRow(
                    rule: rule,
                    isSyncing: syncingRuleID == rule.id || (syncManager.isSyncing && syncManager.currentRuleID == rule.id),
                    onSync: { await runSync(rule: rule) },
                    onEdit: { ruleToEdit = rule },
                    onToggle: { syncManager.toggleRule(rule) }
                )
            }
            .onDelete { offsets in
                syncManager.deleteRule(at: offsets)
            }
        }
        .listStyle(.insetGrouped)
    }

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "arrow.triangle.2.circlepath.circle")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("No Sync Rules")
                .font(.title2.bold())
            Text("Create a sync rule to start keeping your calendars in sync.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Create First Rule") {
                showingAddRule = true
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @MainActor
    private func runSync(rule: SyncRule) async {
        syncingRuleID = rule.id
        defer { syncingRuleID = nil }
        do {
            _ = try await syncManager.performSync(rule: rule)
        } catch {
            alertError = error.localizedDescription
        }
    }
}

// MARK: - Sync Rule Row

struct SyncRuleRow: View {
    let rule: SyncRule
    let isSyncing: Bool
    let onSync: () async -> Void
    let onEdit: () -> Void
    let onToggle: () -> Void

    @EnvironmentObject var calendarManager: CalendarManager

    var sourceCalendar: EKCalendar? { calendarManager.calendar(withID: rule.sourceCalendarID) }
    var destCalendar: EKCalendar? { calendarManager.calendar(withID: rule.destinationCalendarID) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(rule.name)
                        .font(.headline)
                        .foregroundStyle(rule.isEnabled ? .primary : .secondary)
                    Text(rule.direction.displayName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("", isOn: Binding(get: { rule.isEnabled }, set: { _ in onToggle() }))
                    .labelsHidden()
            }

            HStack(spacing: 8) {
                calendarPill(calendar: sourceCalendar, name: "Unknown Source")
                Image(systemName: rule.direction == .twoWay ? "arrow.left.arrow.right" : "arrow.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                calendarPill(calendar: destCalendar, name: "Unknown Dest")
            }

            HStack {
                if let lastSync = rule.lastSyncedAt {
                    Text("Last synced \(lastSync, style: .relative) ago")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Never synced")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if isSyncing {
                    ProgressView()
                        .scaleEffect(0.8)
                } else if rule.isEnabled {
                    Button {
                        Task { await onSync() }
                    } label: {
                        Label("Sync Now", systemImage: "arrow.clockwise")
                            .font(.caption.weight(.medium))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
                }
                Button("Edit") { onEdit() }
                    .font(.caption.weight(.medium))
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
            }
        }
        .padding(.vertical, 4)
        .opacity(rule.isEnabled ? 1 : 0.6)
    }

    private func calendarPill(calendar: EKCalendar?, name: String) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(cgColor: calendar?.cgColor ?? .init(gray: 0.5, alpha: 1)))
                .frame(width: 8, height: 8)
            Text(calendar?.title ?? name)
                .font(.caption)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(.quaternary, in: Capsule())
    }
}
