import Foundation
import EventKit
import Combine

/// Wraps EKEventStore with async/await and publishes state changes via Combine.
@MainActor
class CalendarManager: ObservableObject {
    private let store = EKEventStore()

    @Published var authorizationStatus: EKAuthorizationStatus = .notDetermined
    @Published var calendars: [EKCalendar] = []
    @Published var isLoading = false

    init() {
        authorizationStatus = EKEventStore.authorizationStatus(for: .event)
        if authorizationStatus == .fullAccess {
            loadCalendars()
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeChanged),
            name: .EKEventStoreChanged,
            object: store
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Authorization

    func requestAccess() async {
        do {
            let granted = try await store.requestFullAccessToEvents()
            authorizationStatus = EKEventStore.authorizationStatus(for: .event)
            if granted {
                loadCalendars()
            }
        } catch {
            authorizationStatus = EKEventStore.authorizationStatus(for: .event)
        }
    }

    var isAuthorized: Bool {
        authorizationStatus == .fullAccess
    }

    // MARK: - Calendars

    func loadCalendars() {
        calendars = store.calendars(for: .event)
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    func calendar(withID id: String) -> EKCalendar? {
        store.calendar(withIdentifier: id)
    }

    // MARK: - Events

    func fetchEvents(
        from startDate: Date,
        to endDate: Date,
        in calendars: [EKCalendar]
    ) -> [EKEvent] {
        let predicate = store.predicateForEvents(
            withStart: startDate,
            end: endDate,
            calendars: calendars
        )
        return store.events(matching: predicate)
    }

    func event(withIdentifier id: String) -> EKEvent? {
        store.event(withIdentifier: id)
    }

    // MARK: - Sync Metadata

    /// The key stored in the event's notes to track its sync origin.
    private static let syncSourceKey = "[CalendarSync-Source:"
    private static let syncSourceSuffix = "]"

    /// Embeds the source event identifier into a synced event's notes.
    func setSyncSource(_ sourceID: String, on event: EKEvent) {
        let tag = "\(CalendarManager.syncSourceKey)\(sourceID)\(CalendarManager.syncSourceSuffix)"
        if let notes = event.notes {
            if !notes.contains(CalendarManager.syncSourceKey) {
                event.notes = notes + "\n" + tag
            }
        } else {
            event.notes = tag
        }
    }

    /// Extracts the source event identifier from synced event's notes.
    func syncSourceID(from event: EKEvent) -> String? {
        guard let notes = event.notes,
              let start = notes.range(of: CalendarManager.syncSourceKey)?.upperBound,
              let end = notes[start...].range(of: CalendarManager.syncSourceSuffix)?.lowerBound
        else { return nil }
        return String(notes[start..<end])
    }

    // MARK: - Mutations

    /// Copies a source event into the destination calendar, tagging it with its origin.
    @discardableResult
    func copyEvent(_ source: EKEvent, to destination: EKCalendar) throws -> EKEvent {
        let copy = EKEvent(eventStore: store)
        copy.calendar = destination
        copy.title = source.title
        copy.startDate = source.startDate
        copy.endDate = source.endDate
        copy.isAllDay = source.isAllDay
        copy.location = source.location
        copy.notes = source.notes
        copy.url = source.url
        copy.recurrenceRules = source.recurrenceRules

        setSyncSource(source.eventIdentifier, on: copy)

        try store.save(copy, span: .thisEvent, commit: false)
        return copy
    }

    /// Updates an existing synced event with current source data.
    func updateEvent(_ existing: EKEvent, from source: EKEvent) throws {
        existing.title = source.title
        existing.startDate = source.startDate
        existing.endDate = source.endDate
        existing.isAllDay = source.isAllDay
        existing.location = source.location

        // Preserve notes but update the sync tag with latest data
        let currentNotes = existing.notes ?? ""
        let tagRange = currentNotes.range(of: "\n\(CalendarManager.syncSourceKey)")
            ?? currentNotes.range(of: CalendarManager.syncSourceKey)

        if let range = tagRange {
            existing.notes = String(currentNotes[..<range.lowerBound])
        } else {
            existing.notes = source.notes
        }
        setSyncSource(source.eventIdentifier, on: existing)
        existing.url = source.url

        try store.save(existing, span: .thisEvent, commit: false)
    }

    func deleteEvent(_ event: EKEvent) throws {
        try store.remove(event, span: .thisEvent, commit: false)
    }

    func commit() throws {
        try store.commit()
    }

    func reset() {
        store.reset()
    }

    // MARK: - Notifications

    @objc private func storeChanged() {
        Task { @MainActor in
            loadCalendars()
        }
    }
}
