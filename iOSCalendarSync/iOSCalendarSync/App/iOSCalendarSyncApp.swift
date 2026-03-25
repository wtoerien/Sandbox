import SwiftUI
import BackgroundTasks

@main
struct iOSCalendarSyncApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var calendarManager = CalendarManager()
    @StateObject private var syncManager: SyncManager

    init() {
        let calManager = CalendarManager()
        _calendarManager = StateObject(wrappedValue: calManager)
        _syncManager = StateObject(wrappedValue: SyncManager(calendarManager: calManager))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(calendarManager)
                .environmentObject(syncManager)
        }
    }
}
