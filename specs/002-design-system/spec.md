# Feature Specification: Design System

**Feature Branch**: `002-design-system`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Start Phase 2" of `docs/roadmap.md`, expanded from the roadmap and the Design system section of `docs/frontend-blueprint.md`: a visual direction for the owner's approval, tokens, Arabic and Latin typography, an accessible component foundation with right-to-left support, shared components, and a private preview. Done when every shared component is demonstrated in both directions and themes, with accessibility checks passing.

## Clarifications

### Session 2026-11-06

- Q: Which shared components does this phase build, given that the blueprint lists them but the constitution says abstractions wait for two real uses? → A: All blueprint components except `Can` and `CursorPager`. `Can` moves to Phase 3 with the permissions map. `CursorPager` moves to Phase 11, where its only consumer is. Each remaining component has at least two consumers planned in the roadmap. These aren't yet real uses, so the owner approved this as an exception to constitution principles IV and IX, recorded in the plan's Complexity Tracking.
- Q: How do numbers appear in the Arabic interface? → A: Western digits (`123`) everywhere, controlled by one setting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve the visual direction before it is built (Priority: P1)

The project owner sees a concrete proposal for how the application will look, in Arabic and English and in light and dark, using realistic synthetic clinic content. They approve one direction or ask for changes before any component is built on it.

**Why this priority**: Every later screen inherits this look. Changing it after components exist means redoing them, and the roadmap requires approval.

**Independent Test**: Give the owner the proposal, with no application code needed. They can choose a direction, and the choice is recorded.

**Acceptance Scenarios**:

1. **Given** the proposal, **When** the owner reviews it, **Then** it shows at least two distinct directions, each with color, type, and a dense front-desk sample in both languages and both themes.
2. **Given** the proposal, **When** the owner reads it, **Then** each direction's trade-offs are stated, with one recommended.
3. **Given** an approved direction, **When** implementation starts, **Then** the decision is recorded as an architecture decision with its reasons.
4. **Given** no approval yet, **When** work would move on to building components, **Then** it stops and waits.

---

### User Story 2 - Review every component in both directions and themes (Priority: P1)

A reviewer opens a private preview and sees every shared component in each of its states. They can move between Arabic and English and between light and dark, and check each one by eye and by keyboard. All content is clearly fake.

**Why this priority**: This is the phase's acceptance evidence. It's also how later phases find out what already exists.

**Independent Test**: Enable the preview, then open it in each of the four language and theme combinations and confirm that every component and state appears correctly.

**Acceptance Scenarios**:

1. **Given** the preview is enabled, **When** a reviewer opens it in either language, **Then** every shared component appears with all of its states, in the right direction.
2. **Given** the preview is open, **When** the reviewer switches language or theme, **Then** the page updates and the same components stay on view.
3. **Given** the preview isn't enabled, **When** anyone requests its address, **Then** they get the application's ordinary not-found page, and nothing shows that a preview exists.
4. **Given** any preview content, **When** it is inspected, **Then** all names, numbers, and clinical-looking text are synthetic and obviously fake.

---

### User Story 3 - Read clinic values correctly, in any language (Priority: P1)

A staff member reads an amount of money, a clinic date, a time, or a recorded moment. Each one is correct and unambiguous, wherever they are and whatever their computer's time zone, and it stays readable inside Arabic text.

**Why this priority**: A wrong day or a garbled amount at reception causes real harm, such as a missed appointment or a wrong payment. Every later phase depends on these displays.

**Independent Test**: Render each display with synthetic values, with the browser set to a time zone far from the clinic's, in both languages, and compare with the expected output.

**Acceptance Scenarios**:

1. **Given** an amount sent as a string, **When** it is displayed, **Then** no digit changes through rounding, including very large amounts and negative amounts.
2. **Given** a clinic date, **When** it is displayed in a browser west of the clinic's time zone, **Then** it shows the same calendar day as sent.
3. **Given** a wall-clock time, including the end-of-day value `24:00`, **When** it is displayed, **Then** it appears as sent, with no conversion.
4. **Given** a recorded moment in either of the backend's two spellings, **When** it is displayed, **Then** it appears in the clinic's time zone, not the browser's, and both spellings give the same result.
5. **Given** a phone number, national ID, code, date, or time inside Arabic text, **When** it is displayed, **Then** it keeps its left-to-right order and doesn't disturb the sentence around it.
6. **Given** an amount inside Arabic text, **When** it is displayed, **Then** its digits keep their order, its currency sits where Arabic readers expect it, and it doesn't disturb the sentence around it.
7. **Given** the Arabic interface, **When** any number is displayed by these components, **Then** it uses Western digits.

---

### User Story 4 - Recognize a status at a glance, without relying on color (Priority: P2)

A receptionist or doctor scans a list and understands each row's status. Each status looks the same everywhere and always has a text label, so people with color vision differences get the same information.

**Why this priority**: Status drives the front-desk workflow, but this only pays off once feature screens exist.

**Independent Test**: Show every status value in the preview, in grayscale, and confirm each can be identified from its label.

**Acceptance Scenarios**:

1. **Given** any appointment, queue, charge, or record status, **When** it is displayed, **Then** it shows a translated label and the tone assigned in FR-018.
2. **Given** the same status on two screens, **When** they are compared, **Then** they look the same.
3. **Given** the page in grayscale, **When** a person reads the statuses, **Then** all information is still available.
4. **Given** a new status value added to the contract's types, **When** the mapping doesn't cover it, **Then** the project's quality checks fail.

---

### User Story 5 - Build feature screens from shared, complete parts (Priority: P2)

A developer building a later phase composes a screen from shared parts, and the loading, error, empty, not-allowed, not-found, and success states already exist. Confirmations and form fields already meet the accessibility rules and the project's rules on irreversible actions.

**Why this priority**: The constitution requires these states on every screen. Providing them once keeps the screens consistent.

**Independent Test**: Compose a sample list and a sample form in the preview using only shared parts, then confirm that every state is reachable and passes the accessibility checks.

**Acceptance Scenarios**:

1. **Given** a data table, **When** it is given loading, error, empty, or populated input, **Then** it shows the matching state and offers no column sorting.
2. **Given** a populated table on a narrow screen, **When** it is viewed, **Then** rows become readable cards, with no sideways scrolling of the page.
3. **Given** a filter bar, **When** filters are applied, **Then** filters declared for the address appear there and survive reload and the back button, and filters declared to stay out never appear there.
4. **Given** a confirmation for an irreversible action, **When** it opens, **Then** it says the action can't be undone, starts with focus on a safe choice, and returns focus to where it came from when it closes.
5. **Given** a confirmation in progress, **When** the person tries to confirm again, **Then** a second submission isn't possible, and a failure is shown without the dialog closing.
6. **Given** a form field with an error, **When** the error appears, **Then** it is tied to its input for assistive technology and is announced.
7. **Given** an error with no matching field, **When** it appears, **Then** it is shown at form level and not dropped.
8. **Given** a field that must not hold medical details, **When** it is displayed, **Then** the standard "no medical details" hint is visible and tied to its input.

---

### User Story 6 - Work in a comfortable theme (Priority: P3)

A staff member uses the application in light or dark. It follows their device's setting unless they choose otherwise, and their choice is remembered on that device.

**Why this priority**: The owner has chosen both themes, but the application is usable in either one alone.

**Independent Test**: Open the application with the device set to dark, confirm dark, choose light, reload, and confirm light with no flash of the other theme.

**Acceptance Scenarios**:

1. **Given** no saved choice, **When** the application opens, **Then** it follows the device's setting.
2. **Given** a saved choice, **When** any page loads, **Then** it appears in that theme from the first paint.
3. **Given** the theme switch, **When** it is used by keyboard or assistive technology, **Then** its current state and purpose are announced in the active language.
4. **Given** the saved choice, **When** it is inspected, **Then** it holds only the theme and no personal data.

---

### Edge Cases

- **Mixed-direction content:** a Latin name in Arabic text, or an Arabic name in English text, displays in its own direction without reordering its neighbors. User-written text sets its direction from its own content.
- **Long content:** a very long name or unbroken string wraps or truncates without breaking the layout, and truncated content stays readable to keyboard and assistive-technology users.
- **Empty values:** a value the API allows to be null, such as a visit's balance, shows a consistent, accessible "no value" display, and is never shown as `0` or an empty gap.
- **Malformed values:** a date, time, instant, or amount that doesn't match its documented form is never shown as a wrong value and never crashes the page. It shows the "no value" display.
- **Unknown status:** a status the frontend doesn't know, for instance from a newer backend, shows a neutral badge with a generic translated label and doesn't crash the page.
- **Zero results vs. no data:** the empty state can say either "nothing yet" or "nothing matches these filters", with the matching action.
- **Not-found wording:** the not-found state doesn't imply that a record exists or doesn't, because for medical records the backend deliberately doesn't distinguish.
- **Magnification and motion:** content stays usable at 200% zoom, and motion is removed or reduced when the device asks for that.
- **Font failure:** if a web font fails to load, text stays readable in a fallback font for both scripts.
- **Scripts disabled:** the existing notice still appears. Interactive components aren't expected to work without JavaScript, as the application will require it from Phase 3.

## Requirements *(mandatory)*

### Functional Requirements

**Visual direction**

- **FR-001**: A visual direction proposal MUST be presented for the owner's approval before shared components are built. It MUST be original and neutral, calm and clinical, dense enough for a front desk, and legible in both scripts, and MUST follow the owner's decisions of light and dark themes and no print design.
- **FR-002**: The approved direction, and the Arabic numeral decision, MUST be recorded as an architecture decision, with reasons.

**Tokens and typography**

- **FR-003**: All color MUST come from named semantic tokens covering surfaces, text, borders, primary action, focus, and each status tone, with values for both themes. Components MUST NOT use raw color values, with one exception: the CSS system colors `Canvas` and `CanvasText` on native select options, whose list is drawn by the operating system.
- **FR-004**: Text and essential interface colors MUST meet WCAG 2.2 AA contrast in both themes: at least 4.5:1 for normal text, and 3:1 for large text, controls, and focus indicators. This MUST be checked automatically for every token pair the system defines as text on a background.
- **FR-005**: Typefaces MUST cover both Arabic and Latin, MUST be served from the application rather than fetched from a third party at runtime, and MUST have a readable fallback.
- **FR-006**: A consistent type, spacing, and corner-radius scale MUST be defined, and MUST be used by every shared component.
- **FR-007**: Line height and sizing MUST keep Arabic text legible without clipping its marks.

**Theme and direction**

- **FR-008**: The application MUST offer light and dark themes, following the device's setting until a person chooses, and remembering that choice on the device with no personal data.
- **FR-009**: Pages MUST show the correct theme from first paint, without flashing the other one.
- **FR-010**: Every shared component MUST render correctly in both directions, using direction-neutral layout only. Directional icons MUST mirror in right-to-left, and non-directional icons MUST NOT.
- **FR-011**: The landing, not-found, and error pages from Phase 1 MUST adopt the tokens and typography, with no change to their behavior or text.

**Value displays**

- **FR-012**: A money display MUST show the API's string value without converting it to a floating-point number, keeping every digit and any negative sign, with the currency identified in the active language.
- **FR-013**: A clinic date display MUST show the date as sent, and MUST NOT shift it by any time zone.
- **FR-014**: A wall-clock time display MUST show the time as sent, including `24:00`.
- **FR-015**: A moment-in-time display MUST accept both of the backend's spellings, and MUST show the moment in the configured clinic time zone regardless of the browser's.
- **FR-016**: All value displays MUST be isolated from the direction of the text around them, and MUST show the "no value" display for null or malformed input. Dates, times, phone numbers, IDs, and codes MUST display left-to-right. Money MUST keep its digits in order, with the currency placed as the active language expects.
- **FR-017**: Numbers these components format MUST use Western digits in both languages, controlled by one setting.

**Status**

- **FR-018**: One status badge MUST map every value of these enumerations to one tone and one translated label, always showing the text:

  | Tone | Appointment | Queue | Charge | Record |
  |---|---|---|---|---|
  | Neutral | `scheduled` | `waiting` | `none` | `none` |
  | Active | `checked_in` | `with_doctor` | `partially_paid` | `draft` |
  | Success | `completed` | `seen` | `paid` | `finalized` |
  | Warning | `no_show` | `left` | `unpaid` | |
  | Muted | `cancelled` | | `cancelled` | |

- **FR-019**: The status values MUST come from the generated contract types where the contracts define them, so that an unmapped value fails the quality checks. Where a contract doesn't expose a value as a type, the value MUST be verified against the contract's text and the source recorded.
- **FR-020**: An unrecognized status at runtime MUST show as neutral with a generic translated label.

**Shared components**

- **FR-021**: A page header MUST present a title, an optional description, and optional actions.
- **FR-022**: A data table MUST display rows handed to it with real table headers. It MUST offer loading, error, empty, and populated states and page navigation with totals, MUST offer no sorting because the API has none, and MUST become cards on narrow screens. It MUST NOT fetch data itself.
- **FR-023**: A filter bar MUST keep filters in the page's address, so that they survive reload and the back button. Every filter MUST state explicitly whether it goes in the address, with no default, as the constitution restricts patient details in addresses.
- **FR-024**: Shared state views MUST cover loading, empty, error with retry, not allowed, and a neutral not-found. Each MUST be announced appropriately to assistive technology.
- **FR-025**: A confirmation dialog MUST support destructive and irreversible actions as FR-030 and US5 describe. It MUST state when an action can't be undone, show progress, prevent double submission, show failure without closing, and return focus when closed.
- **FR-026**: Form field wrappers MUST provide a label, an optional hint, and an error tied to the input, and MUST announce errors. A form-level error display MUST exist for errors with no matching field. A standard "no medical details" hint MUST be available in both languages.
- **FR-027**: A transient notice MUST confirm success or report failure, MUST be announced to assistive technology, and MUST NOT be the only place an error appears.
- **FR-028**: The underlying building blocks (buttons, inputs, selects, dialogs, tables, badges, and similar) MUST be limited to what the components above and the preview use.

**Accessibility**

- **FR-029**: Every component MUST meet WCAG 2.2 AA, including keyboard operation, visible focus that isn't hidden by other content, and interactive targets of at least 24 by 24 CSS pixels.
- **FR-030**: Dialogs MUST keep focus inside while open, close with the Escape key unless an action is in progress, and return focus on closing.
- **FR-031**: Status, errors, and required fields MUST NOT rely on color alone.

**Preview**

- **FR-032**: A preview page MUST demonstrate every shared component and state, in both languages and both themes, using synthetic data only.
- **FR-033**: The preview MUST be off unless enabled by an explicit server-side setting. When off, its address MUST behave exactly like any unknown address, and its demonstration content MUST NOT be sent to browsers.
- **FR-034**: The preview MUST NOT call the backend, and MUST NOT be indexed by search engines.

**Internationalization**

- **FR-035**: All visible and assistive text, including status labels, MUST come from the translation files for both languages, with identical keys. Text the API stores MUST be shown unchanged.

**Quality and documentation**

- **FR-036**: Automated tests MUST cover value displays and their edge cases, status mapping, the component states, focus behavior, theme persistence, and the preview being off by default. End-to-end checks MUST run automated accessibility checks across all four language and theme combinations.
- **FR-037**: The project documents MUST be updated to match what is built: the dependency list with reasons, the blueprint's status table and component list, the roadmap, and the rules for using the tokens.

**Scope limits**

- **FR-038**: This feature MUST NOT include authentication, a browser-to-backend proxy, a client data-fetching library, role-based navigation or visibility, an application shell, feature screens, real API calls from these components, a cursor pager, or print design.
- **FR-039**: This feature MUST NOT modify the backend.

### Key Entities

- **Design token**: A named semantic value, with a value for each theme where applicable.
- **Status mapping**: For one enumeration value, its tone and translated label.
- **Theme choice**: Light, dark, or following the device, saved on the device and tied to no person.
- **Visual direction decision**: The direction the owner approved, with reasons and date.
- **Preview setting**: The server-side switch that makes the preview available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner has approved a visual direction, recorded with its date, before any shared component is built.
- **SC-002**: 100% of shared components and their states appear in the preview, in all four language and theme combinations.
- **SC-003**: Automated accessibility checks report zero serious or critical issues in all four combinations of the preview, and on the restyled Phase 1 pages.
- **SC-004**: 100% of defined text and background token pairs meet the required contrast in both themes.
- **SC-005**: A reviewer can reach and operate every interactive element in the preview with a keyboard alone, with visible focus throughout, in both directions.
- **SC-006**: Every value display gives the expected result across a test set of at least three browser time zones, including one west of UTC, and with amounts too large to survive floating-point conversion.
- **SC-007**: Every appointment, queue, charge, and record status can be identified in grayscale from its label alone.
- **SC-008**: With the preview off, its address is indistinguishable from an unknown address, and a search of everything sent to the browser finds none of its content.
- **SC-009**: Preview pages show no sideways page scrolling at widths from 768 to 1920 pixels in either direction, and stay usable at 200% zoom.
- **SC-010**: All project quality checks pass, and the results are recorded.

## Assumptions

- **Clinic dates and times are shown literally as sent**, such as `2026-11-08` and `09:20`, following the project's rule. Friendlier forms, such as month names or a 12-hour clock, would be a later decision. Moments in time keep the localized style from Phase 1, so the two kinds of value look different by design.
- **Charge status `none`** is added to the blueprint's table. It's a real value on visit lists (`contracts/payments.openapi.yaml`, line 440) that the table omitted. Neutral is assumed, matching record status `none`.
- **Audit outcomes and other enumerations** get status treatment in the phase that shows them, and aren't part of this mapping. Roles, days, and payment methods are plain labels, not statuses.
- **"Private" preview** means off by default through server configuration, since no authentication exists until Phase 3. It holds synthetic data only, so a mistaken enablement exposes nothing sensitive.
- **Form components are presentational here.** Connecting them to a form library, and the mapping of API errors onto fields, comes with the first real form in Phase 3.
- **The data table's paging is given as plain values.** The API's pagination fields are unconfirmed until the live checks in Phase 3, so this phase doesn't bind to them.
- **The theme switch and language switch** appear on the preview and on Phase 1 pages. Their place in the application's top bar comes with the shell in Phase 3.
- **Screen sizes:** desktop first, down to tablet width, as in the blueprint. Phones are not a target, but narrow widths must degrade to cards rather than break.
- **Each remaining component has two or more consumers planned** in the roadmap. That doesn't satisfy constitution principles IV and IX, which ask for real uses, so it's a recorded exception (see the plan's Complexity Tracking). `CursorPager` didn't have even that, and was moved to Phase 11.
- **Technology choices** recorded in `docs/tech-stack.md` are starting points. Open items there, namely the component foundation's base library and how complete its right-to-left support is, are settled in the plan.
