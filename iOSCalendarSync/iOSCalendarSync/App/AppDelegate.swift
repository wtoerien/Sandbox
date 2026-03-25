import UIKit
import BackgroundTasks
import EventKit

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        registerBackgroundTasks()
        return true
    }

    // MARK: - Background Tasks

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.example.iOSCalendarSync.background-sync",
            using: nil
        ) { task in
            self.handleBackgroundSync(task: task as! BGAppRefreshTask)
        }
    }

    private func handleBackgroundSync(task: BGAppRefreshTask) {
        scheduleBackgroundSync()

        let calendarManager = CalendarManager()
        let syncManager = SyncManager(calendarManager: calendarManager)

        task.expirationHandler = {
            syncManager.cancelSync()
        }

        Task {
            do {
                let rules = SyncRule.loadAll()
                for rule in rules where rule.isEnabled {
                    _ = try await syncManager.performSync(rule: rule)
                }
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
    }

    func scheduleBackgroundSync() {
        let request = BGAppRefreshTaskRequest(
            identifier: "com.example.iOSCalendarSync.background-sync"
        )
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes

        try? BGTaskScheduler.shared.submit(request)
    }
}

class SceneDelegate: NSObject, UIWindowSceneDelegate {
    var window: UIWindow?
}
