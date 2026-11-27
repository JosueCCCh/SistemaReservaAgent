# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **URP engineering students**, between classes, on phone or lab desktop, who want a free hour in a reservable lab — they check availability, book with their university code, and cancel their own bookings.
- **Laboratory staff / administrators**, who monitor reservations, availability, inventory of equipment, and the audit trail of the booking system.

## Product Purpose

A web system for managing and booking free hours in the laboratories of the Universidad Ricardo Palmo (URP), integrated with an AI agent that can consult availability, register and cancel reservations, and answer regulation questions in conversation. Success means a reservation is created exactly once, never double-booked, and both parties are informed about it by email.

## Positioning

Two mechanisms carry equal weight, confirmed as binding:

1. **The real-time availability engine.** Free hours are computed live as `attention hours − (breaks ∪ occupied classes ∪ active reservations)`, filtered past dates in `America/Lima` — the student sees exactly what is bookable now, not a static schedule.
2. **The AI agent with Function Calling + RAG (Google Gemini).** Reserving, cancelling, checking availability, and citing regulations happen conversationally, with verifiable citations in the form *Document + Article*.

A neighboring product could ship a booking calendar; neither the computed free-hours model nor the citation-grade RAG over URP regulations comes for free.

## Operating Context

- Single-page React dashboard with a sidebar of six destinations: Inicio, Laboratorios, Disponibilidad y Reserva, Mis Reservas, Inventario de Equipos, Reglamentos (RAG), plus a floating AI chat widget.
- No login: identity is validated by the university code; bookings and cancellations are tied to that code.
- Email notifications through Nodemailer (Gmail SMTP) with a `real`/`simulado` mode; reminders reference URP Articles 20 and 28.
- Data lives in SQLite (WAL mode) with transactional concurrency control; seedable via `npm run db:seed`.
- Server runs on `http://localhost:3000`, client dev on `http://localhost:5173`; all dates and times resolve in `America/Lima` (UTC-5).
- Google AI Studio API key (`gemini-3.5-flash-lite`) is required for the agent.

## Capabilities and Constraints

**Domain rules (binding):**

- Reservable for free hours: *Circuitos y Dispositivos* and *Sistemas Digitales*.
- Consultation-only (no individual student reservations): *Telecomunicaciones*, *CIM*, *Metal Mecánica*.
- Cancellations only by the titular student, using the registered university code.
- Visible regulation reminders: current university card (Art. 28 a), control sheet (Art. 28 c), no food or drinks (Art. 20).

**Confirmed functionality:** availability lookup by lab and date; reservation creation with server-side rejection reasons; reservation lookup/cancellation by code; equipment inventory listing; semantic + textual regulation search with citations; conversational agent for availability, booking, cancelling, and regulation lookups.

**Confirmed constraints:** all product copy in Spanish; identity by university code rather than accounts (no-login model is by design); past dates and hours are never offered; free hours are computed against breaks, occupied classes, and active reservations together, never overlapping.

**Explicitly undecided:** no staff/admin role or dashboard is specified yet — how lab staff monitor and manage reservations is an open product question.

## Brand Commitments

- Name in use: *Sistema de Reserva de Laboratorios URP* / *Laboratorios URP — Sistema de Reservas*, with a `URP` wordmark in the sidebar.
- University affiliation: Universidad Ricardo Palmo; URP regulations and their article numbers must stay accurate.
- Voice: formal-institutional but plain, student-facing Spanish (existing copy such as "Disponibilidad y Creación de Reservas", "Mis Reservas / Cancelación" is the incumbent register).
- Existing assets: `client/src/assets/hero.png`, `client/public/favicon.svg`, `client/public/icons.svg`; Lucide icons are the icon set.

## Evidence on Hand

- `README.md` — full product/architecture description, stack, domain rules, env configuration.
- `server/src/db/seed.ts` — seeded laboratories, equipment, schedules, and regulation fragments.
- `server/test/sistema.test.ts` — Vitest suite covering the reservation and availability logic.
- `client/src/assets/hero.png`, `client/public/favicon.svg`, `client/public/icons.svg` — current visual assets.

**Absences future work must not fabricate:** no testimonials, no published customer or faculty names, no pricing, no benchmarks, no press or case studies.

## Product Principles

1. **Never promise an hour the system cannot honor.** Availability, booking, and cancellation all resolve against the same transactional source of truth; a confirmed reservation is exactly one.
2. **Every claim is traceable.** Normative answers carry *Document + Article* citations; conversational answers stay answerable from the system's own data.
3. **The student's identity is their university code.** Keep the no-login model; never grow a credential system it was not designed for.
4. **Domain rules are not UX copy.** Reservable vs. consultation-only labs, titular-only cancellation, and Art. 20/28 reminders are rules enforced in the product, not decoration.
5. **Speed to a bookable hour is the measure of the interface.** From open to confirmed reservation should take as few steps as the domain allows.
