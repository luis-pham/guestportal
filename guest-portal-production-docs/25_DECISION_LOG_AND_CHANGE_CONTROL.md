# Decision Log and Change Control

## 1. ADR

Architecture decisions stored in:

```text
docs/adr/ADR-XXXX-title.md
```

ADR contains:

- Context.
- Decision.
- Alternatives.
- Consequences.
- Status.
- Date.
- Owners.

## 2. Changes requiring ADR

- Change framework.
- Change database.
- Introduce service.
- Change auth strategy.
- Change tenant model.
- Change voice transport.
- Change embedding model/dimension.
- Change storage.
- Change API style.
- Major UI architecture change.

## 3. Specification change

When implementation reveals missing requirement:

1. Do not silently invent.
2. Record decision/question.
3. Update canonical spec.
4. Update tests.
5. Implement.
6. Link commit to spec change.

## 4. Compatibility

Any contract/schema change must state:

- Backward compatibility.
- Migration.
- Rollback.
- Affected clients.
- Release order.
