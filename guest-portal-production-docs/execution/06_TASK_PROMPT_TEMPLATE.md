# Prompt Template for One Task

Copy this prompt and replace `<TASK_ID>` only.

```text
Execute exactly task <TASK_ID> from the QR Guest Portal production documentation.

Mandatory rules:
1. Keep the existing 11-phase roadmap unchanged.
2. Treat Phase 01 as an inherited baseline; do not reimplement it.
3. Read execution/00_EXECUTION_README.md first.
4. Read execution/01_PHASE_01_BASELINE_AND_TRANSITION.md.
5. Read execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md.
6. Read execution/03_IMPLEMENTATION_ORDER_AND_DEPENDENCIES.md.
7. Read the current phase document and execution/tasks/<TASK_ID>_*.md.
8. Read only the canonical documents listed by that task manifest.
9. Inspect existing code before editing.
10. Modify only allowed paths unless a scope exception is documented.
11. Run every required test and generate required evidence.
12. Write the task result to the required evidence path.
13. Never claim PASS without executed evidence.
14. Stop after this task. Do not start the next task.
```
