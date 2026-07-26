# Fixture and Demo Data

## 1. Purpose

Một bộ fixture thống nhất dùng cho development, tests, screenshots và demos. Không dùng fixture ngẫu nhiên khác nhau giữa phase.

## 2. Organizations

### Org A: Aurora Hospitality

Properties:

1. Aurora City Hotel
2. Aurora Bay Cruise
3. Aurora Forest Resort

### Org B: Nomad Homes

Properties:

1. Old Quarter Loft
2. Riverside Villa

## 3. Core users

- owner@aurora.test
- admin@aurora.test
- manager.hotel@aurora.test
- manager.cruise@aurora.test
- content@aurora.test
- staff.hotel@aurora.test
- staff.cruise@aurora.test
- viewer@aurora.test
- owner@nomad.test

Credentials only in local test seed, never production.

## 4. Knowledge fixture

Vietnamese source includes:

- Breakfast 06:30–09:30.
- Wi-Fi instructions.
- Spa hours.
- Cruise itinerary.
- Safety instructions.
- Late checkout policy.
- Local recommendations.

Queries labeled in:

- Vietnamese
- English
- Korean
- Japanese
- French

Each query maps to expected source/chunk IDs.

## 5. Catalog fixture

Hotel:

- Extra towel request.
- Bottled water.
- Club sandwich.
- Airport transfer.
- Spa massage.

Cruise:

- Cocktail.
- Wine.
- Massage.
- Kayak registration.
- Private dinner.

Airbnb:

- Mid-stay cleaning.
- Airport pickup.
- Late checkout request.

## 6. Portal fixture

Each property has:

- Logo.
- Cover.
- Brand color.
- Greeting VI/EN.
- Quick actions.
- Explore sections.
- Guide.
- Services.

Use non-trademark fictional brands.

## 7. Operational fixture

- New request.
- Accepted request.
- In-progress request.
- Completed request.
- New order.
- Preparing order.
- Delivering order.
- Handoff conversation.
- Unanswered AI query.

## 8. Reset

Provide commands:

- `db:seed:test`
- `db:seed:demo`
- `db:reset:test`

Seed must be deterministic and idempotent.
