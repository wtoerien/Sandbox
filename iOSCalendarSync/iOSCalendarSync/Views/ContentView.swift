import SwiftUI
import EventKit

struct ContentView: View {
    @EnvironmentObject var calendarManager: CalendarManager
    @EnvironmentObject var syncManager: SyncManager
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if !calendarManager.isAuthorized {
                PermissionRequestView()
            } else {
                mainTabView
            }
        }
        .task {
            if !calendarManager.isAuthorized {
                await calendarManager.requestAccess()
            }
        }
    }

    private var mainTabView: some View {
        TabView(selection: $selectedTab) {
            SyncRulesView()
                .tabItem {
                    Label("Sync Rules", systemImage: "arrow.triangle.2.circlepath")
                }
                .tag(0)

            SyncHistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .tag(1)

            CalendarListView()
                .tabItem {
                    Label("Calendars", systemImage: "calendar")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(3)
        }
        .overlay(alignment: .bottom) {
            if syncManager.isSyncing {
                SyncProgressBanner()
                    .padding(.bottom, 50)
            }
        }
    }
}

// MARK: - Permission Request View

struct PermissionRequestView: View {
    @EnvironmentObject var calendarManager: CalendarManager

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 80))
                .foregroundStyle(.blue)

            VStack(spacing: 12) {
                Text("Calendar Sync")
                    .font(.largeTitle.bold())

                Text("Sync events between your iOS calendars automatically. Keep multiple calendars in harmony.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            VStack(spacing: 16) {
                featureRow(icon: "arrow.triangle.2.circlepath", title: "Bidirectional Sync",
                           description: "One-way or two-way syncing between any calendars")
                featureRow(icon: "clock.arrow.circlepath", title: "Automatic Sync",
                           description: "Runs in the background to keep calendars up to date")
                featureRow(icon: "slider.horizontal.3", title: "Flexible Rules",
                           description: "Set date ranges, duplicate handling, and more")
            }
            .padding(.horizontal, 24)

            Spacer()

            Button {
                Task { await calendarManager.requestAccess() }
            } label: {
                Text("Allow Calendar Access")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(.blue)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
    }

    private func featureRow(icon: String, title: String, description: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.blue)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(description).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

// MARK: - Sync Progress Banner

struct SyncProgressBanner: View {
    @EnvironmentObject var syncManager: SyncManager

    var body: some View {
        HStack(spacing: 12) {
            ProgressView(value: syncManager.syncProgress)
                .progressViewStyle(.circular)
                .scaleEffect(0.8)

            Text("Syncing...")
                .font(.subheadline.weight(.medium))

            Spacer()

            Button("Cancel") {
                syncManager.cancelSync()
            }
            .font(.subheadline)
            .foregroundStyle(.red)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
        .shadow(radius: 4)
    }
}
