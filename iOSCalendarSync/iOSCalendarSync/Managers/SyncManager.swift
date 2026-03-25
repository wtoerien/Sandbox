import Foundation
import EventKit
import Combine

/// Errors that can occur during a sync operation.
enum SyncError: LocalizedError {
    case calendarNotFound(String)
    case accessDenied
    case eventStoreFailed(Error)
    case cancelled

    var errorDescription: String? {
        switch self {
        case .calendarNotFound(let id): return "Calendar not found: \(id)"
        case .accessDenied: return "Calendar access was denied. Please allow access in Settings."
        case .eventStoreFailed(let error): return "Event store error: \(error.localizedDescription)"
        case .cancelled: return "Sync was cancelled."
        }
    }
}

/// Orchestrates syncing events between calendars according to a SyncRule.
@MainActor
class SyncManager: ObservableObject {
    private let calendarManager: CalendarManager

    @Published var isSyncing = false
    @Published var currentRuleID: UUID?
    @Published var syncProgress: Double = 0
    @Published var rules: [SyncRule] = []
    @Published var history: [SyncResult] = []

    private var cancellationToken = false

    init(calendarManager: CalendarManager) {
        self.calendarManager = calendarManager
        rules = SyncRule.loadAll()
        history = SyncResult.loadHistory()
    }

    // MARK: - Rule Management

    func addRule(_ rule: SyncRule) {
        rules.append(rule)
        persistRules()
    }

    func updateRule(_ rule: SyncRule) {
        if let index = rules.firstIndex(where: { $0.id == rule.id }) {
            rules[index] = rule
            persistRules()
        }
    }

    func deleteRule(at offsets: IndexSet) {
        rules.remove(atOffsets: offsets)
        persistRules()
    }

    func deleteRule(_ rule: SyncRule) {
        rules.removeAll { $0.id == rule.id }
        persistRules()
    }

    func toggleRule(_ rule: SyncRule) {
        if let index = rules.firstIndex(where: { $0.id == rule.id }) {
            rules[index].isEnabled.toggle()
            persistRules()
        }
    }

    private func persistRules() {
        SyncRule.saveAll(rules)
    }

    // MARK: - Sync Execution

    func cancelSync() {
        cancellationToken = true
    }

    /// Runs all enabled rules sequentially.
    func syncAll() async {
        let enabledRules = rules.filter { $0.isEnabled }
        for rule in enabledRules {
            guard !cancellationToken else { break }
            _ = try? await performSync(rule: rule)
        }
    }

    /// Performs sync for a single rule and returns the result.
    func performSync(rule: SyncRule) async throws -> SyncResult {
        guard calendarManager.isAuthorized else {
            throw SyncError.accessDenied
        }

        guard !isSyncing else { return SyncResult(ruleID: rule.id, ruleName: rule.name) }

        cancellationToken = false
        isSyncing = true
        currentRuleID = rule.id
        syncProgress = 0

        var result = SyncResult(ruleID: rule.id, ruleName: rule.name)

        defer {
            isSyncing = false
            currentRuleID = nil
            syncProgress = 1.0

            result.completedAt = Date()
            SyncResult.appendToHistory(result)
            history = SyncResult.loadHistory()

            // Update rule's lastSyncedAt
            if let index = rules.firstIndex(where: { $0.id == rule.id }) {
                rules[index].lastSyncedAt = Date()
                persistRules()
            }
        }

        do {
            guard let sourceCalendar = calendarManager.calendar(withID: rule.sourceCalendarID) else {
                throw SyncError.calendarNotFound(rule.sourceCalendarID)
            }
            guard let destCalendar = calendarManager.calendar(withID: rule.destinationCalendarID) else {
                throw SyncError.calendarNotFound(rule.destinationCalendarID)
            }

            let (startDate, endDate) = rule.dateRange

            // Fetch source and destination events
            let sourceEvents = calendarManager.fetchEvents(
                from: startDate, to: endDate, in: [sourceCalendar]
            )
            let destEvents = calendarManager.fetchEvents(
                from: startDate, to: endDate, in: [destCalendar]
            )

            try await syncForward(
                from: sourceEvents,
                to: destCalendar,
                existingDestEvents: destEvents,
                rule: rule,
                result: &result
            )

            syncProgress = 0.5

            if rule.direction == .twoWay {
                guard !cancellationToken else {
                    result.status = .cancelled
                    return result
                }
                try await syncForward(
                    from: destEvents,
                    to: sourceCalendar,
                    existingDestEvents: sourceEvents,
                    rule: rule,
                    result: &result
                )
            }

            result.status = result.eventsFailed > 0 ? .partialSuccess : .success

        } catch is CancellationError {
            result.status = .cancelled
            calendarManager.reset()
        } catch let error as SyncError {
            result.status = .failed
            result.errorMessage = error.localizedDescription
            calendarManager.reset()
        } catch {
            result.status = .failed
            result.errorMessage = error.localizedDescription
            calendarManager.reset()
            throw error
        }

        return result
    }

    // MARK: - Private Sync Logic

    private func syncForward(
        from sourceEvents: [EKEvent],
        to destCalendar: EKCalendar,
        existingDestEvents: [EKEvent],
        rule: SyncRule,
        result: inout SyncResult
    ) async throws {
        // Build a lookup of destination events by their sync source ID
        var destBySyncSource: [String: EKEvent] = [:]
        for event in existingDestEvents {
            if let sourceID = calendarManager.syncSourceID(from: event) {
                destBySyncSource[sourceID] = event
            }
        }

        let total = sourceEvents.count
        for (index, sourceEvent) in sourceEvents.enumerated() {
            if cancellationToken { throw CancellationError() }

            // Yield to keep UI responsive
            if index % 10 == 0 {
                await Task.yield()
                syncProgress = Double(index) / Double(max(total, 1)) * 0.5
            }

            let eventID = sourceEvent.eventIdentifier ?? ""

            if let existingDest = destBySyncSource[eventID] {
                // Event already synced to destination
                let needsUpdate = existingDest.title != sourceEvent.title
                    || existingDest.startDate != sourceEvent.startDate
                    || existingDest.endDate != sourceEvent.endDate
                    || existingDest.location != sourceEvent.location

                switch rule.duplicateHandling {
                case .skip:
                    result.eventsSkipped += 1
                    result.actions.append(SyncEventAction(
                        eventTitle: sourceEvent.title ?? "Untitled",
                        eventStartDate: sourceEvent.startDate,
                        action: .skipped,
                        calendarName: destCalendar.title
                    ))
                case .overwrite:
                    if needsUpdate {
                        do {
                            try calendarManager.updateEvent(existingDest, from: sourceEvent)
                            result.eventsUpdated += 1
                            result.actions.append(SyncEventAction(
                                eventTitle: sourceEvent.title ?? "Untitled",
                                eventStartDate: sourceEvent.startDate,
                                action: .updated,
                                calendarName: destCalendar.title
                            ))
                        } catch {
                            result.eventsFailed += 1
                            result.actions.append(SyncEventAction(
                                eventTitle: sourceEvent.title ?? "Untitled",
                                eventStartDate: sourceEvent.startDate,
                                action: .failed,
                                calendarName: destCalendar.title
                            ))
                        }
                    } else {
                        result.eventsSkipped += 1
                    }
                case .keepBoth:
                    // Always add a new copy
                    do {
                        try calendarManager.copyEvent(sourceEvent, to: destCalendar)
                        result.eventsAdded += 1
                        result.actions.append(SyncEventAction(
                            eventTitle: sourceEvent.title ?? "Untitled",
                            eventStartDate: sourceEvent.startDate,
                            action: .added,
                            calendarName: destCalendar.title
                        ))
                    } catch {
                        result.eventsFailed += 1
                        result.actions.append(SyncEventAction(
                            eventTitle: sourceEvent.title ?? "Untitled",
                            eventStartDate: sourceEvent.startDate,
                            action: .failed,
                            calendarName: destCalendar.title
                        ))
                    }
                }
            } else {
                // New event — copy to destination
                do {
                    try calendarManager.copyEvent(sourceEvent, to: destCalendar)
                    result.eventsAdded += 1
                    result.actions.append(SyncEventAction(
                        eventTitle: sourceEvent.title ?? "Untitled",
                        eventStartDate: sourceEvent.startDate,
                        action: .added,
                        calendarName: destCalendar.title
                    ))
                } catch {
                    result.eventsFailed += 1
                    result.actions.append(SyncEventAction(
                        eventTitle: sourceEvent.title ?? "Untitled",
                        eventStartDate: sourceEvent.startDate,
                        action: .failed,
                        calendarName: destCalendar.title
                    ))
                }
            }
        }

        // Handle deletions: find destination events whose source no longer exists
        if rule.deletionHandling == .propagate {
            let sourceIDs = Set(sourceEvents.compactMap { $0.eventIdentifier })
            for destEvent in existingDestEvents {
                guard let originID = calendarManager.syncSourceID(from: destEvent),
                      !sourceIDs.contains(originID) else { continue }
                do {
                    try calendarManager.deleteEvent(destEvent)
                    result.eventsDeleted += 1
                    result.actions.append(SyncEventAction(
                        eventTitle: destEvent.title ?? "Untitled",
                        eventStartDate: destEvent.startDate,
                        action: .deleted,
                        calendarName: destCalendar.title
                    ))
                } catch {
                    result.eventsFailed += 1
                }
            }
        }

        // Commit all pending changes in one shot
        do {
            try calendarManager.commit()
        } catch {
            result.status = .failed
            result.errorMessage = error.localizedDescription
            calendarManager.reset()
        }
    }
}
