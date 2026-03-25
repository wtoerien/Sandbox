import XCTest
@testable import iOSCalendarSync

final class CalendarSyncTests: XCTestCase {

    // MARK: - SyncRule Tests

    func testSyncRuleDefaultValues() {
        let rule = SyncRule(
            name: "Test Rule",
            sourceCalendarID: "source-id",
            destinationCalendarID: "dest-id"
        )
        XCTAssertEqual(rule.direction, .oneWay)
        XCTAssertEqual(rule.duplicateHandling, .skip)
        XCTAssertEqual(rule.deletionHandling, .ignore)
        XCTAssertTrue(rule.isEnabled)
        XCTAssertFalse(rule.syncPastEvents)
        XCTAssertTrue(rule.syncFutureEvents)
        XCTAssertEqual(rule.futureDaysToSync, 365)
        XCTAssertNil(rule.lastSyncedAt)
    }

    func testSyncRuleDateRangeFutureOnly() {
        var rule = SyncRule(name: "Test", sourceCalendarID: "s", destinationCalendarID: "d")
        rule.syncPastEvents = false
        rule.syncFutureEvents = true
        rule.futureDaysToSync = 30

        let (start, end) = rule.dateRange
        let now = Date()
        XCTAssertTrue(start <= now.addingTimeInterval(1))
        XCTAssertTrue(end > now)

        let expectedEnd = Calendar.current.date(byAdding: .day, value: 30, to: now)!
        XCTAssertEqual(end.timeIntervalSince1970, expectedEnd.timeIntervalSince1970, accuracy: 60)
    }

    func testSyncRuleDateRangeWithPast() {
        var rule = SyncRule(name: "Test", sourceCalendarID: "s", destinationCalendarID: "d")
        rule.syncPastEvents = true
        rule.pastDaysToSync = 7
        rule.syncFutureEvents = true
        rule.futureDaysToSync = 14

        let (start, end) = rule.dateRange
        let now = Date()
        let expectedStart = Calendar.current.date(byAdding: .day, value: -7, to: now)!
        let expectedEnd = Calendar.current.date(byAdding: .day, value: 14, to: now)!

        XCTAssertEqual(start.timeIntervalSince1970, expectedStart.timeIntervalSince1970, accuracy: 60)
        XCTAssertEqual(end.timeIntervalSince1970, expectedEnd.timeIntervalSince1970, accuracy: 60)
    }

    func testSyncRulePersistence() {
        let rule = SyncRule(
            name: "Persistence Test",
            sourceCalendarID: "src-123",
            destinationCalendarID: "dst-456",
            direction: .twoWay
        )

        SyncRule.saveAll([rule])
        let loaded = SyncRule.loadAll()

        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded.first?.name, "Persistence Test")
        XCTAssertEqual(loaded.first?.sourceCalendarID, "src-123")
        XCTAssertEqual(loaded.first?.direction, .twoWay)

        // Cleanup
        SyncRule.saveAll([])
    }

    // MARK: - SyncResult Tests

    func testSyncResultSummaryEmpty() {
        let result = SyncResult(ruleID: UUID(), ruleName: "Test")
        XCTAssertEqual(result.summary, "No changes")
    }

    func testSyncResultSummaryWithChanges() {
        var result = SyncResult(ruleID: UUID(), ruleName: "Test")
        result.eventsAdded = 3
        result.eventsSkipped = 1
        XCTAssertEqual(result.summary, "3 added, 1 skipped")
    }

    func testSyncResultTotalEventsProcessed() {
        var result = SyncResult(ruleID: UUID(), ruleName: "Test")
        result.eventsAdded = 5
        result.eventsUpdated = 2
        result.eventsSkipped = 3
        result.eventsFailed = 1
        XCTAssertEqual(result.totalEventsProcessed, 11)
    }

    func testSyncResultHistoryPersistence() {
        var result = SyncResult(ruleID: UUID(), ruleName: "History Test")
        result.eventsAdded = 2
        result.status = .success
        result.completedAt = Date()

        SyncResult.appendToHistory(result)
        let history = SyncResult.loadHistory()

        XCTAssertFalse(history.isEmpty)
        XCTAssertEqual(history.first?.ruleName, "History Test")
        XCTAssertEqual(history.first?.eventsAdded, 2)

        SyncResult.clearHistory()
        XCTAssertTrue(SyncResult.loadHistory().isEmpty)
    }

    // MARK: - SyncEventAction Tests

    func testSyncEventActionCreation() {
        let date = Date()
        let action = SyncEventAction(
            eventTitle: "Team Meeting",
            eventStartDate: date,
            action: .added,
            calendarName: "Work"
        )
        XCTAssertEqual(action.eventTitle, "Team Meeting")
        XCTAssertEqual(action.action, .added)
        XCTAssertEqual(action.calendarName, "Work")
    }

    // MARK: - Enum Display Names

    func testSyncDirectionDisplayNames() {
        XCTAssertFalse(SyncDirection.oneWay.displayName.isEmpty)
        XCTAssertFalse(SyncDirection.twoWay.displayName.isEmpty)
    }

    func testDuplicateHandlingDisplayNames() {
        for option in DuplicateHandling.allCases {
            XCTAssertFalse(option.displayName.isEmpty)
        }
    }

    func testDeletionHandlingDisplayNames() {
        for option in DeletionHandling.allCases {
            XCTAssertFalse(option.displayName.isEmpty)
        }
    }
}
