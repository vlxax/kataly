# КАТАЛЫ V0.1

Отдельный экспериментальный модуль для Poker Swipe.

## Что уже работает
- Главный экран «Каталы».
- Внутренняя валюта (localStorage demo).
- Создание 6-max / 9-max стола.
- Бай-ин 1 000 / 5 000.
- Стартовый стек 50 / 100 BB.
- Приглашение пользователя по нику (пока локальный mock).
- Автозаполнение свободных мест ботами.
- Лобби real + bot.
- Создание демо-сессии.
- История демо-сессий.
- Каркас будущей статистики.
- Модульная структура, чтобы позже встраивать в Poker Swipe.

## Что намеренно НЕ реализовано в V0.1
- Настоящая синхронизация нескольких устройств.
- Настоящие Supabase-инвайты.
- Poker engine / раздача карт.
- Betting rounds, 3-bet/4-bet, side pots, all-in.
- Hand evaluator.
- Выбывание игроков.
- Выплата призов.
- Poker Brain-анализ реальных решений.

## V0.2 — следующий шаг
1. Полноценная NL Hold'em hand state machine.
2. Колода / dealer button / SB / BB.
3. Preflop → flop → turn → river → showdown.
4. Fold / Check / Call / Bet / Raise / All-in.
5. Минимальный raise и legal-action validation.
6. Hand evaluator.
7. Боты, которые реально принимают решения.
8. Запись каждого action в hand history.

## V0.3
- Supabase Realtime.
- Настоящие real-user invites.
- Синхронизация стола.
- Reconnect.
- Session analytics.
- Poker Brain report.


## V0.3 — PLAYABLE TABLE
Добавлен первый реально играемый single-device NL Hold'em стол:
- 6-max / 9-max из текущего лобби.
- Реальный Hero + боты.
- Колода и раздача hole cards.
- Dealer / SB / BB.
- Preflop → flop → turn → river → showdown.
- Fold / Check / Call / Raise.
- Слайдер рейза.
- Боты принимают базовые решения.
- Банк и стеки меняются.
- Hand evaluator определяет победителя на showdown.
- Следующая раздача.
- Завершение тестовой сессии и запись результата в историю.

Важно: это V0.3 — локальный прототип движка. Side pots, полноценные all-in edge cases,
турнирное выбывание до одного победителя, настоящая сеть и Poker Brain-анализ будут дальше.


## V0.4 — TABLE → RESULT → HISTORY → STATS
- Исправлен реальный переход из лобби на игровой стол.
- После завершения тестовой сессии показывается итог.
- Сохраняются руки, стартовый/финальный стек, BB-результат и игровая награда.
- История сессий стала отдельными карточками.
- Добавлен экран агрегированной статистики.
- Добавлены точки входа в будущий подробный разбор Poker Brain.


## V0.5 — POKER BRAIN / HAND HISTORY
- Сессия теперь хранит все сыгранные руки, а не только последнюю.
- Каждое действие Hero сохраняется с улицей, банком, ценой колла, сайзингом, стеком, картами и бордом.
- После сессии автоматически строится учебная оценка решений.
- Раздельные оценки: префлоп / постфлоп / сайзинг / дисциплина.
- Карточки ошибок и спорных решений.
- Детальный просмотр конкретной раздачи и всей линии действий.
- Первые автоматически найденные лики.
- Кнопка «Лечить» подготовлена под связь с персональными упражнениями.
- Важно: текущий анализ — эвристический прототип, не GTO solver.


## V0.6 — TOURNAMENT MODE
- Blind levels теперь растут автоматически каждые 3 руки.
- Уровни: 1/2 → 2/4 → 3/6 → 5/10 → 8/16 → 12/24 → 20/40.
- Игроки с нулевым стеком реально вылетают.
- На столе показываются текущий уровень, блайнды и сколько игроков осталось.
- Hero-сессия заканчивается при вылете Hero или при победе.
- Рассчитывается итоговое место.
- Призовой фонд распределяется по 1/2/3 местам.
- Приз возвращается во внутренний банкролл.
- В истории сохраняются место, приз, блайнды и турнирный результат.
- В статистике появились победы, ITM и лучшее место.

Ограничения прототипа:
- Side pots и сложные multi-way all-in пока не реализованы.
- Боты пока эвристические, не GTO.
- Реальный realtime multiplayer будет отдельным этапом.

## V0.7 — POKER ENGINE CORE
- Blind levels now advance by real time (5 min demo levels), not by hand count.
- Big Blind Ante.
- Chips + BB display, average stack and tournament clock in engine snapshot.
- 6-max positions and rotating dealer button; heads-up BTN/SB handling.
- Legal action context includes call, min/max raise, pot, BB values and position.
- Raise presets + all-in in the table UI.
- Side-pot construction and split-pot payouts.
- Decision logs now store position, effective stack, BB, pot context and decision time.
- Poker Brain can later consume the richer hand/action log without pretending current heuristic scores are GTO.


## V0.7.2 — SAFARI FIX
- Исправлен Safari/WebKit parse crash.
- Конструкции `pair?.25`, `suited?.07`, `condition?.08` были двусмысленно записанными ternary-выражениями.
- Они заменены на обычные `condition ? value : 0`.


## V0.7.3 — LEGACY SAFARI
- Удалены ВСЕ optional chaining `?.` и nullish coalescing `??`.
- Убраны `flatMap` из критического пути.
- Цель: совместимость со старым Safari/WebKit, а не только современным Chrome.


## V0.7.5 — ENGINE PARSE FIX
- Найдена реальная причина Safari BOOT ERROR.
- В `js/poker/engine.js`, функция `botAction()`, у третьего `return {type:'raise'...}` не хватало одной закрывающей `)`.
- Из-за этого следующий `return` воспринимался Safari как синтаксическая ошибка.
- `botAction()` переписан многострочно, чтобы такая ошибка больше не пряталась в одной гигантской строке.
- Добавлен cache-bust `app.js?v=075-engine-parse-fix`.
