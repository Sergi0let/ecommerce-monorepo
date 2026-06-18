# Codex у VS Code

## Базовий режим роботи

Використовуй Codex у VS Code як агента для роботи з репозиторієм, а не тільки як чат.

- `Agent` - основний режим для задач із кодом: читання файлів, редагування, запуск команд у workspace.
- `Chat` - для пояснень, планування і рев'ю без змін у файлах.
- `Agent (Full Access)` - тільки для довірених репозиторіїв, коли потрібен network або доступ поза workspace.

## Контекст у промпті

Хороший промпт має містити:

- `Goal` - що саме треба зробити.
- `Context` - які файли, папки, помилки або приклади важливі.
- `Constraints` - що не можна змінювати або які правила треба зберегти.
- `Done when` - як Codex має перевірити результат.

Приклад:

```text
Goal: fix the failing build in this Turbo repo.
Context: use @turbo.json, @package.json, and package configs.
Constraints: do not change dependency versions unless required.
Done when: the relevant build/check command passes and the diff is summarized.
```

## Корисні команди VS Code

Команди можна знайти через Command Palette і забіндити на гарячі клавіші:

- `chatgpt.addToThread` - додати виділений код у поточний тред.
- `chatgpt.addFileToThread` - додати весь файл у контекст.
- `chatgpt.implementTodo` - попросити Codex реалізувати вибраний TODO.
- `chatgpt.newChat` - створити новий тред.
- `chatgpt.openSidebar` - відкрити Codex sidebar.

## AGENTS.md для репозиторію

Найкорисніше покращення - додати `AGENTS.md` у корінь репозиторію, щоб Codex автоматично знав правила проєкту.

Приклад стартового вмісту:

```md
# AGENTS.md

## Repo

- This is a Turbo monorepo.
- Prefer the existing package manager and scripts.
- Keep changes scoped to the requested task.

## Commands

- Run the relevant lint/build/test command after changing code.
- Do not add production dependencies without explaining why.

## Style

- Preserve existing architecture and naming.
- Prefer local patterns over new abstractions.
- Report commands run and any failures.
```

## Базовий config.toml

Особисті дефолти варто тримати у `~/.codex/config.toml`:

```toml
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"
approval_policy = "on-request"
```

Для складного дебагу або архітектурного рев'ю можна тимчасово піднімати reasoning до `high`.

## Практичні промпти для цього репозиторію

```text
Inspect this Turbo monorepo starting from @turbo.json. Explain the build/test/lint pipeline and identify suspicious config. Do not edit files yet.
```

```text
Review the current uncommitted changes for bugs, regressions, and missing checks. Prioritize findings with file references.
```

```text
Implement the selected task, keep the diff scoped, run relevant checks, and summarize what changed.
```

## Робочий цикл

1. Для складних задач спочатку проси план без редагування файлів.
2. Після плану проси реалізацію з чіткими обмеженнями.
3. Завжди проси Codex запустити релевантні перевірки.
4. Наприкінці проси коротке рев'ю власного diff.
