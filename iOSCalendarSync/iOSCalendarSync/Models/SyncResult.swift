import Foundation

/// The outcome status of a sync operation.
enum SyncStatus: String, Codable {
    case success = "success"
    case partialSuccess = "partial_success"
    case failed = "failed"
    case cancelled = "cancelled"
}

/// Records an individual event action taken during sync.
struct SyncEventAction: Identifiable, Codable {
    var id: UUID
    var eventTitle: String
    var eventStartDate: Date
    var action: ActionType
    var calendarName: String

    enum ActionType: String, Codable {
        case added = "added"
        case updated = "updated"
        case deleted = "deleted"
        case skipped = "skipped"
        case failed = "failed"
    }

    init(eventTitle: String, eventStartDate: Date, action: ActionType, calendarName: String) {
        self.id = UUID()
        self.eventTitle = eventTitle
        self.eventStartDate = eventStartDate
        self.action = action
        self.calendarName = calendarName
    }
}

/// The complete result of running a sync rule.
struct SyncResult: Identifiable, Codable {
    var id: UUID
    var ruleID: UUID
    var ruleName: String
    var status: SyncStatus
    var startedAt: Date
    var completedAt: Date?
    var eventsAdded: Int
    var eventsUpdated: Int
    var eventsDeleted: Int
    var eventsSkipped: Int
    var eventsFailed: Int
    var errorMessage: String?
    var actions: [SyncEventAction]

    init(ruleID: UUID, ruleName: String) {
        self.id = UUID()
        self.ruleID = ruleID
        self.ruleName = ruleName
        self.status = .success
        self.startedAt = Date()
        self.eventsAdded = 0
        self.eventsUpdated = 0
        self.eventsDeleted = 0
        self.eventsSkipped = 0
        self.eventsFailed = 0
        self.actions = []
    }

    var totalEventsProcessed: Int {
        eventsAdded + eventsUpdated + eventsDeleted + eventsSkipped + eventsFailed
    }

    var summary: String {
        var parts: [String] = []
        if eventsAdded > 0 { parts.append("\(eventsAdded) added") }
        if eventsUpdated > 0 { parts.append("\(eventsUpdated) updated") }
        if eventsDeleted > 0 { parts.append("\(eventsDeleted) deleted") }
        if eventsSkipped > 0 { parts.append("\(eventsSkipped) skipped") }
        if eventsFailed > 0 { parts.append("\(eventsFailed) failed") }
        return parts.isEmpty ? "No changes" : parts.joined(separator: ", ")
    }

    // MARK: - Persistence

    private static let storageKey = "com.example.iOSCalendarSync.syncHistory"
    private static let maxHistoryCount = 100

    static func loadHistory() -> [SyncResult] {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let results = try? JSONDecoder().decode([SyncResult].self, from: data) else {
            return []
        }
        return results.sorted { $0.startedAt > $1.startedAt }
    }

    static func appendToHistory(_ result: SyncResult) {
        var history = loadHistory()
        history.insert(result, at: 0)
        if history.count > maxHistoryCount {
            history = Array(history.prefix(maxHistoryCount))
        }
        if let data = try? JSONEncoder().encode(history) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    static func clearHistory() {
        UserDefaults.standard.removeObject(forKey: storageKey)
    }
}
