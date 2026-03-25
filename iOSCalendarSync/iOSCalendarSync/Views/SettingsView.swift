import SwiftUI
import EventKit

struct SettingsView: View {
    @EnvironmentObject var calendarManager: CalendarManager
    @EnvironmentObject var syncManager: SyncManager
    @State private var showingClearHistoryConfirmation = false
    @State private var showingClearRulesConfirmation = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Calendar Access") {
                    HStack {
                        Label("Status", systemImage: "calendar.badge.checkmark")
                        Spacer()
                        Text(authorizationStatusLabel)
                            .foregroundStyle(authorizationStatusColor)
                            .font(.subheadline)
                    }

                    if calendarManager.authorizationStatus != .fullAccess {
                        Button {
                            Task { await calendarManager.requestAccess() }
                        } label: {
                            Label("Request Calendar Access", systemImage: "lock.open")
                        }
                    } else {
                        Button {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            Label("Open Settings", systemImage: "gear")
                        }
                    }
                }

                Section("Sync") {
                    HStack {
                        Label("Active Rules", systemImage: "checkmark.circle")
                        Spacer()
                        Text("\(syncManager.rules.filter(\.isEnabled).count) of \(syncManager.rules.count)")
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Label("Total Syncs", systemImage: "clock.arrow.circlepath")
                        Spacer()
                        Text("\(syncManager.history.count)")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Background Sync") {
                    HStack {
                        Label("Background Refresh", systemImage: "arrow.clockwise.icloud")
                        Spacer()
                        Text("Every 15 min")
                            .foregroundStyle(.secondary)
                            .font(.subheadline)
                    }
                    Text("Background sync runs automatically while Calendar Sync is allowed to refresh in the background. Enable Background App Refresh in iOS Settings for best results.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Data") {
                    Button(role: .destructive) {
                        showingClearHistoryConfirmation = true
                    } label: {
                        Label("Clear Sync History", systemImage: "trash")
                    }

                    Button(role: .destructive) {
                        showingClearRulesConfirmation = true
                    } label: {
                        Label("Delete All Sync Rules", systemImage: "trash.fill")
                    }
                }

                Section("About") {
                    HStack {
                        Label("Version", systemImage: "info.circle")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Label("Build", systemImage: "hammer")
                        Spacer()
                        Text("1")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog(
                "Clear all sync history?",
                isPresented: $showingClearHistoryConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear History", role: .destructive) {
                    SyncResult.clearHistory()
                    syncManager.history = []
                }
                Button("Cancel", role: .cancel) {}
            }
            .confirmationDialog(
                "Delete all sync rules? This cannot be undone.",
                isPresented: $showingClearRulesConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete All Rules", role: .destructive) {
                    syncManager.rules.removeAll()
                    SyncRule.saveAll([])
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var authorizationStatusLabel: String {
        switch calendarManager.authorizationStatus {
        case .notDetermined: return "Not Determined"
        case .restricted: return "Restricted"
        case .denied: return "Denied"
        case .fullAccess: return "Full Access"
        case .writeOnly: return "Write Only"
        @unknown default: return "Unknown"
        }
    }

    private var authorizationStatusColor: Color {
        switch calendarManager.authorizationStatus {
        case .fullAccess: return .green
        case .writeOnly: return .orange
        default: return .red
        }
    }
}
