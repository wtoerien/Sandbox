import Foundation
import EventKit

/// Defines the direction of a sync operation.
enum SyncDirection: String, Codable, CaseIterable {
    case oneWay = "one_way"
    case twoWay = "two_way"

    var displayName: String {
        switch self {
        case .oneWay: return "One-way (Source → Destination)"
        case .twoWay: return "Two-way (Bidirectional)"
        }
    }
}

/// Controls how duplicate events are handled during sync.
enum DuplicateHandling: String, Codable, CaseIterable {
    case skip = "skip"
    case overwrite = "overwrite"
    case keepBoth = "keep_both"

    var displayName: String {
        switch self {
        case .skip: return "Skip duplicates"
        case .overwrite: return "Overwrite with source"
        case .keepBoth: return "Keep both copies"
        }
    }
}

/// Controls what happens to deleted events during sync.
enum DeletionHandling: String, Codable, CaseIterable {
    case propagate = "propagate"
    case ignore = "ignore"

    var displayName: String {
        switch self {
        case .propagate: return "Propagate deletions"
        case .ignore: return "Ignore deletions"
        }
    }
}

/// A rule that defines how calendars should be synced.
struct SyncRule: Identifiable, Codable {
    var id: UUID
    var name: String
    var sourceCalendarID: String
    var destinationCalendarID: String
    var direction: SyncDirection
    var isEnabled: Bool
    var syncPastEvents: Bool
    var pastDaysToSync: Int
    var syncFutureEvents: Bool
    var futureDaysToSync: Int
    var duplicateHandling: DuplicateHandling
    var deletionHandling: DeletionHandling
    var createdAt: Date
    var lastSyncedAt: Date?

    init(
        name: String,
        sourceCalendarID: String,
        destinationCalendarID: String,
        direction: SyncDirection = .oneWay,
        duplicateHandling: DuplicateHandling = .skip,
        deletionHandling: DeletionHandling = .ignore
    ) {
        self.id = UUID()
        self.name = name
        self.sourceCalendarID = sourceCalendarID
        self.destinationCalendarID = destinationCalendarID
        self.direction = direction
        self.isEnabled = true
        self.syncPastEvents = false
        self.pastDaysToSync = 30
        self.syncFutureEvents = true
        self.futureDaysToSync = 365
        self.duplicateHandling = duplicateHandling
        self.deletionHandling = deletionHandling
        self.createdAt = Date()
    }

    /// The date range to search for events based on rule settings.
    var dateRange: (start: Date, end: Date) {
        let now = Date()
        let calendar = Calendar.current
        let start = syncPastEvents
            ? calendar.date(byAdding: .day, value: -pastDaysToSync, to: now) ?? now
            : now
        let end = syncFutureEvents
            ? calendar.date(byAdding: .day, value: futureDaysToSync, to: now) ?? now
            : now
        return (start, end)
    }

    // MARK: - Persistence

    private static let storageKey = "com.example.iOSCalendarSync.syncRules"

    static func loadAll() -> [SyncRule] {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let rules = try? JSONDecoder().decode([SyncRule].self, from: data) else {
            return []
        }
        return rules
    }

    static func saveAll(_ rules: [SyncRule]) {
        if let data = try? JSONEncoder().encode(rules) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }
}
